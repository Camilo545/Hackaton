# Cuenta Clara

Prototipo web para llevar las ventas de una feria universitaria. Permite registrar productos manualmente o cargar varias imágenes de facturas/recibos y usar OCR en español para sugerir datos. Las sugerencias siempre se pueden revisar y corregir antes de registrar la venta.

La interfaz tiene una identidad visual propia inspirada en ferias: verde oscuro, lima y coral, con tipografía editorial.

## Ejecutar con PostgreSQL

Requisitos: Node.js 18 o posterior y PostgreSQL 14 o posterior.

1. Crea la base de datos `cuenta_clara`:

   ```powershell
   psql -U postgres -c "CREATE DATABASE cuenta_clara;"
   ```

2. Ejecuta `schema.sql` dentro de esa base. Por ejemplo, desde PowerShell:

   ```powershell
   psql -U postgres -d cuenta_clara -f .\schema.sql
   ```

3. Copia `.env.example` a `.env` y reemplaza usuario, contraseña y host de PostgreSQL en `DATABASE_URL`. No subas `.env` a Git.
   Configura también `SESSION_SECRET` con un valor aleatorio privado de al menos 32 caracteres. Puedes generarlo con `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
4. Instala dependencias y arranca el servidor:

   ```powershell
   Copy-Item .env.example .env
   npm install
   npm start
   ```

5. Ejecuta `seed-admin.sql` en la base de datos para crear el usuario inicial y abre `http://localhost:3000`. No abras `index.html` directamente: la aplicación requiere su API y una sesión iniciada.

Para una base administrada que requiera TLS, configura `DATABASE_SSL=true` en `.env` y `SESSION_COOKIE_SECURE=true` cuando la aplicación esté publicada con HTTPS. Si la contraseña de PostgreSQL contiene caracteres especiales, codifícala para URL antes de ponerla en `DATABASE_URL`.

El endpoint `/api/health` comprueba la conexión. Las ventas se guardan en PostgreSQL y las facturas se almacenan como `BYTEA` en la tabla `invoices` (máximo 5 MB por imagen). Las rutas de ventas y facturas requieren una sesión; las contraseñas se almacenan con hash bcrypt y las sesiones en PostgreSQL. Por defecto, el servidor solo escucha en el equipo local; en un proveedor de hosting configura `HOST=0.0.0.0` y usa HTTPS.

## Funcionalidad

- Carga múltiple de imágenes JPG, PNG o WEBP.
- Asociación de una imagen de factura a una venta y vista previa de la factura desde el historial.
- Lectura OCR de apoyo y captura manual de nombre, cantidad y precio unitario.
- El precio acepta separadores de miles con punto o coma (por ejemplo, `1.500` o `1,500`).
- Validación de campos antes de guardar.
- Pantallas separadas de resumen, registro de ventas e historial.
- Resumen de recaudo, transacciones, unidades vendidas y productos más vendidos.
- Historial de todas las ventas almacenadas en PostgreSQL.

## Tablas

- `sales`: una fila por transacción con producto, cantidad, precio unitario y fecha.
- `invoices`: imagen y metadatos de la factura, vinculada a una venta mediante `sale_id`. Su llave foránea elimina la factura si se elimina la venta.
- `users`: cuentas autorizadas con hash de contraseña bcrypt; nunca almacena la contraseña original.
- `session`: sesiones de inicio de sesión con expiración.

El script `schema.sql` crea las tablas, las restricciones de validación y los índices para fecha, producto y expiración de sesiones. `seed-admin.sql` agrega el usuario administrador inicial. No compartas ni publiques las credenciales.
