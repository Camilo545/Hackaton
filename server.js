require("dotenv").config();

const crypto = require("node:crypto");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const connectPgSimple = require("connect-pg-simple");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const session = require("express-session");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("Configura SESSION_SECRET con al menos 32 caracteres en .env.");
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("La factura debe ser una imagen."));
      return;
    }
    callback(null, true);
  }
});
const publicAssets = new Map([
  ["login.css", "text/css; charset=utf-8"],
  ["login.js", "text/javascript; charset=utf-8"],
  ["app.js", "text/javascript; charset=utf-8"],
  ["styles.css", "text/css; charset=utf-8"]
]);
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.SESSION_COOKIE_SECURE === "true",
  path: "/"
};

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use("/api", (request, response, next) => {
  if (!process.env.DATABASE_URL) {
    response.status(503).json({ error: "Falta configurar DATABASE_URL en el archivo .env." });
    return;
  }
  next();
});

app.get("/api/health", async (request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("PostgreSQL health check failed:", error.message);
    response.status(503).json({ status: "error", database: "unavailable" });
  }
});

const sessionMiddleware = session({
  name: "cuenta_clara.sid",
  secret: process.env.SESSION_SECRET,
  store: new (connectPgSimple(session))({
    pool,
    tableName: "session",
    createTableIfMissing: false
  }),
  resave: false,
  saveUninitialized: false,
  cookie: { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 }
});
app.use(sessionMiddleware);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." }
});

app.post("/api/auth/login", loginLimiter, async (request, response, next) => {
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || username.length > 64 || !password || password.length > 128) {
    response.status(400).json({ error: "Escribe tu usuario y contraseña." });
    return;
  }

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username]
    );
    const user = result.rows[0];
    const validPassword = user && await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      response.status(401).json({ error: "Usuario o contraseña incorrectos." });
      return;
    }

    request.session.regenerate((error) => {
      if (error) {
        next(error);
        return;
      }
      request.session.userId = user.id;
      request.session.username = user.username;
      request.session.save((saveError) => {
        if (saveError) {
          next(saveError);
          return;
        }
        response.json({ username: user.username });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    response.clearCookie("cuenta_clara.sid", cookieOptions);
    response.status(204).end();
  });
});

app.get("/api/auth/session", requireAuth, (request, response) => {
  response.json({ username: request.session.username });
});

app.use("/api", requireAuth);

app.get("/api/sales", async (request, response, next) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.product, s.quantity, s.unit_price, s.created_at,
             i.sale_id AS invoice_id, i.file_name AS invoice_name
      FROM sales s
      LEFT JOIN invoices i ON i.sale_id = s.id
      ORDER BY s.created_at ASC, s.id ASC
    `);
    response.json(result.rows.map((row) => ({
      id: row.id,
      product: row.product,
      quantity: row.quantity,
      unitPrice: Number(row.unit_price),
      createdAt: row.created_at.toISOString(),
      invoiceId: row.invoice_id,
      invoiceName: row.invoice_name
    })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/sales", upload.single("invoice"), async (request, response, next) => {
  const product = typeof request.body.product === "string" ? request.body.product.trim() : "";
  const quantity = Number(request.body.quantity);
  const unitPrice = Number(request.body.unitPrice);

  if (!product || product.length > 80) {
    response.status(400).json({ error: "El producto debe tener entre 1 y 80 caracteres." });
    return;
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    response.status(400).json({ error: "La cantidad debe ser un entero positivo." });
    return;
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > 999999999999.99) {
    response.status(400).json({ error: "El precio unitario debe ser positivo y válido." });
    return;
  }

  const client = await pool.connect().catch(next);
  if (!client) return;

  const id = crypto.randomUUID();
  try {
    await client.query("BEGIN");
    const saleResult = await client.query(
      `INSERT INTO sales (id, product, quantity, unit_price)
       VALUES ($1, $2, $3, $4)
       RETURNING id, product, quantity, unit_price, created_at`,
      [id, product, quantity, unitPrice]
    );
    const invoice = request.file;
    if (invoice) {
      await client.query(
        `INSERT INTO invoices (sale_id, file_name, mime_type, image_data)
         VALUES ($1, $2, $3, $4)`,
        [id, path.basename(invoice.originalname.replace(/\\/g, "/")).slice(0, 255), invoice.mimetype, invoice.buffer]
      );
    }
    await client.query("COMMIT");

    const sale = saleResult.rows[0];
    response.status(201).json({
      id: sale.id,
      product: sale.product,
      quantity: sale.quantity,
      unitPrice: Number(sale.unit_price),
      createdAt: sale.created_at.toISOString(),
      invoiceId: invoice ? id : null,
      invoiceName: invoice ? path.basename(invoice.originalname.replace(/\\/g, "/")).slice(0, 255) : null
    });
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      console.error("Failed to roll back sale transaction:", rollbackError.message);
    });
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/sales/:id/invoice", async (request, response, next) => {
  if (!cryptoValidateUuid(request.params.id)) {
    response.status(400).json({ error: "Identificador de venta inválido." });
    return;
  }
  try {
    const result = await pool.query(
      "SELECT file_name, mime_type, image_data FROM invoices WHERE sale_id = $1",
      [request.params.id]
    );
    if (!result.rowCount) {
      response.status(404).json({ error: "No hay factura adjunta a esta venta." });
      return;
    }
    const invoice = result.rows[0];
    response.set({
      "Content-Type": invoice.mime_type,
      "Content-Disposition": `inline; filename="${invoice.file_name.replace(/["\\\r\n]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    });
    response.send(invoice.image_data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/sales", async (request, response, next) => {
  const client = await pool.connect().catch(next);
  if (!client) return;
  try {
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM sales");
    await client.query("COMMIT");
    response.json({ deleted: result.rowCount });
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      console.error("Failed to roll back deletion:", rollbackError.message);
    });
    next(error);
  } finally {
    client.release();
  }
});

app.get("/login", (request, response, next) => {
  if (request.session.userId) {
    response.redirect("/");
    return;
  }
  response.sendFile(path.join(__dirname, "login.html"), (error) => {
    if (error) next(error);
  });
});

app.get("/:asset", (request, response) => {
  const contentType = publicAssets.get(request.params.asset);
  if (!contentType) {
    response.status(404).end();
    return;
  }
  if (request.params.asset === "app.js" || request.params.asset === "styles.css") {
    if (!request.session || !request.session.userId) {
      response.status(404).end();
      return;
    }
  }
  response.type(contentType).sendFile(path.join(__dirname, request.params.asset));
});

app.get("/", (request, response, next) => {
  if (!request.session.userId) {
    response.redirect("/login");
    return;
  }
  response.sendFile(path.join(__dirname, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((request, response, next) => {
  if (request.path.startsWith("/api/") && request.path !== "/api/health") {
    response.status(404).json({ error: "Ruta no encontrada." });
    return;
  }
  next();
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof multer.MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: error.code === "LIMIT_FILE_SIZE" ? "La imagen no puede superar 5 MB." : "No se pudo procesar la imagen."
    });
    return;
  }
  if (error.message === "La factura debe ser una imagen.") {
    response.status(400).json({ error: error.message });
    return;
  }
  console.error("API request failed:", error.message);
  response.status(500).json({ error: "Ocurrió un error en el servidor. Revisa la conexión y las tablas de PostgreSQL." });
});

function cryptoValidateUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requireAuth(request, response, next) {
  if (request.session && request.session.userId) {
    next();
    return;
  }
  if (request.originalUrl.startsWith("/api/")) {
    response.status(401).json({ error: "Inicia sesión para continuar." });
    return;
  }
  response.redirect("/login");
}

const server = app.listen(port, host, () => {
  console.log(`Cuenta Clara available at http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
