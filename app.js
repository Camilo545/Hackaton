(() => {
  const STORAGE_KEY = "cuenta-clara-sales-v1";
  const salesTable = document.getElementById("salesTable");
  const imageInput = document.getElementById("imageInput");
  const uploadZone = document.getElementById("uploadZone");
  const draftList = document.getElementById("draftList");
  const form = document.getElementById("saleForm");
  const formMessage = document.getElementById("formMessage");
  let sales = loadSales();
  let drafts = [];

  function loadSales() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored.filter(isValidSale) : [];
    } catch (error) {
      console.error("No fue posible leer las ventas guardadas.", error);
      return [];
    }
  }

  function isValidSale(sale) {
    return sale && typeof sale.product === "string" && sale.product.trim() &&
      Number.isInteger(sale.quantity) && sale.quantity > 0 &&
      Number.isFinite(sale.unitPrice) && sale.unitPrice > 0 &&
      typeof sale.createdAt === "string";
  }

  function saveSales() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
    } catch (error) {
      console.error("No fue posible guardar las ventas.", error);
      showMessage("No se pudo guardar en este dispositivo. Revisa el espacio disponible.", false);
      return false;
    }
    return true;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(value);
  }

  function parseAmount(value) {
    const input = String(value).trim().replace(/[\s$]/g, "");
    if (!input || !/^\d[\d.,]*$/.test(input)) return NaN;

    const lastSeparator = Math.max(input.lastIndexOf("."), input.lastIndexOf(","));
    if (lastSeparator < 0) return Number(input);

    const fractionLength = input.length - lastSeparator - 1;
    const integerPart = input.slice(0, lastSeparator);
    const fractionPart = input.slice(lastSeparator + 1);
    const groupedInteger = /^\d{1,3}(?:[.,]\d{3})*$/.test(integerPart);

    if (fractionLength >= 1 && fractionLength <= 2 && groupedInteger) {
      return Number(`${integerPart.replace(/[.,]/g, "")}.${fractionPart}`);
    }
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(input)) {
      return Number(input.replace(/[.,]/g, ""));
    }
    if (/^\d+[.,]\d{1,2}$/.test(input)) {
      return Number(input.replace(",", "."));
    }
    return NaN;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function render() {
    const revenue = sales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
    const units = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const productTotals = new Map();
    sales.forEach((sale) => {
      const key = sale.product.trim().toLocaleLowerCase("es");
      const current = productTotals.get(key) || { name: sale.product.trim(), quantity: 0 };
      current.quantity += sale.quantity;
      productTotals.set(key, current);
    });
    const ranking = [...productTotals.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "es"));
    document.getElementById("totalRevenue").textContent = formatMoney(revenue);
    document.getElementById("transactionCount").textContent = sales.length.toLocaleString("es-CO");
    document.getElementById("unitCount").textContent = units.toLocaleString("es-CO");
    document.getElementById("topProduct").textContent = ranking[0]?.name || "—";
    document.getElementById("topProductFoot").textContent = ranking.length ? `${ranking[0].quantity} unidades vendidas` : "Aún sin ventas";
    document.getElementById("historyCount").textContent = `${sales.length} ${sales.length === 1 ? "registro" : "registros"}`;
    renderRanking(ranking);
    renderHistory();
  }

  function renderRanking(ranking) {
    const container = document.getElementById("ranking");
    if (!ranking.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-illustration">✳</span><strong>Todo empieza con una venta</strong><span>Registra tu primera y aquí verás<br />qué producto es el favorito.</span></div>';
      return;
    }
    const max = ranking[0].quantity;
    container.innerHTML = ranking.slice(0, 5).map((item, index) => `
      <div class="rank-item">
        <div class="rank-top"><span class="rank-name"><span class="rank-number">${index + 1}</span><strong>${escapeHtml(item.name)}</strong></span><span class="rank-quantity">${item.quantity} uds.</span></div>
        <div class="rank-track"><div class="rank-bar" style="width:${Math.max(8, (item.quantity / max) * 100)}%"></div></div>
      </div>`).join("");
  }

  function renderHistory() {
    if (!sales.length) {
      salesTable.innerHTML = '<tr class="empty-row"><td colspan="5"><span class="empty-table-icon">▤</span> Aún no hay ventas. ¡Registra la primera!</td></tr>';
      return;
    }
    salesTable.innerHTML = [...sales].reverse().map((sale) => {
      const date = new Date(sale.createdAt);
      const dateLabel = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
      return `<tr>
        <td><span class="product-cell"><span class="product-token">${escapeHtml(sale.product.trim().charAt(0).toUpperCase())}</span>${escapeHtml(sale.product.trim())}</span></td>
        <td>${sale.quantity} uds.</td><td>${formatMoney(sale.unitPrice)}</td><td>${escapeHtml(dateLabel)}</td>
        <td class="amount-cell">${formatMoney(sale.quantity * sale.unitPrice)}</td>
      </tr>`;
    }).join("");
  }

  function showPage(pageId) {
    const page = document.querySelector(`.app-page[data-page="${pageId}"]`) || document.querySelector('.app-page[data-page="resumen"]');
    document.querySelectorAll(".app-page").forEach((item) => item.classList.toggle("active", item === page));
    document.querySelectorAll(".nav-link").forEach((link) => {
      const isActive = link.hash === `#${page.id}`;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.addEventListener("hashchange", () => showPage(location.hash.slice(1)));

  function showMessage(message, success, global = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("success", success);
    if (global) document.getElementById("globalMessage").textContent = message;
  }

  function readSaleForm() {
    const product = document.getElementById("productName").value.trim();
    const quantityValue = document.getElementById("quantity").value;
    const priceValue = document.getElementById("unitPrice").value;
    const quantity = Number(quantityValue);
    const unitPrice = parseAmount(priceValue);
    if (!product) return { error: "Escribe el nombre del producto." };
    if (!Number.isInteger(quantity) || quantity <= 0) return { error: "La cantidad debe ser un número entero mayor que cero." };
    if (!Number.isFinite(unitPrice)) return { error: "Escribe un precio válido, por ejemplo 1.500 o 1,500." };
    if (unitPrice <= 0) return { error: "El precio unitario debe ser mayor que cero." };
    return { sale: { id: createId(), product, quantity, unitPrice, createdAt: new Date().toISOString() } };
  }

  function createId() {
    return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = readSaleForm();
    if (result.error) {
      showMessage(result.error, false);
      return;
    }
    sales.push(result.sale);
    if (!saveSales()) {
      sales.pop();
      return;
    }
    render();
    form.reset();
    showMessage("Venta guardada. ¡Las cuentas están al día!", true);
  });

  document.getElementById("unitPrice").addEventListener("blur", (event) => {
    const input = event.currentTarget;
    const amount = parseAmount(input.value);
    if (Number.isFinite(amount) && amount > 0) {
      input.value = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(amount);
    }
  });

  document.getElementById("browseButton").addEventListener("click", () => imageInput.click());
  uploadZone.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    imageInput.click();
  });
  imageInput.addEventListener("change", () => {
    addFiles([...imageInput.files]);
    imageInput.value = "";
  });
  ["dragenter", "dragover"].forEach((type) => uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.add("drag-over");
  }));
  ["dragleave", "drop"].forEach((type) => uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.remove("drag-over");
  }));
  uploadZone.addEventListener("drop", (event) => addFiles([...event.dataTransfer.files]));

  function addFiles(files) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length !== files.length) showMessage("Solo se admiten archivos de imagen.", false);
    images.forEach((file) => drafts.push({ id: createId(), file, url: URL.createObjectURL(file), status: "Pendiente de lectura", busy: false }));
    renderDrafts();
  }

  function renderDrafts() {
    draftList.innerHTML = drafts.map((draft) => `
      <article class="draft-card" data-draft-id="${draft.id}">
        <img class="draft-thumb" src="${draft.url}" alt="Vista previa de ${escapeHtml(draft.file.name)}" />
        <div class="draft-info"><strong title="${escapeHtml(draft.file.name)}">${escapeHtml(draft.file.name)}</strong><small class="draft-status">${escapeHtml(draft.status)}</small></div>
        <div class="draft-actions">
          <button type="button" class="small-button read-draft" ${draft.busy ? "disabled" : ""}>${draft.busy ? "Leyendo…" : "Leer imagen"}</button>
          <button type="button" class="small-button remove-draft" aria-label="Quitar imagen">×</button>
        </div>
      </article>`).join("");
    draftList.querySelectorAll(".read-draft").forEach((button, index) => button.addEventListener("click", () => readDraft(drafts[index])));
    draftList.querySelectorAll(".remove-draft").forEach((button, index) => button.addEventListener("click", () => {
      URL.revokeObjectURL(drafts[index].url);
      drafts.splice(index, 1);
      renderDrafts();
    }));
  }

  async function readDraft(draft) {
    if (!globalThis.Tesseract) {
      draft.status = "No se cargó el lector. Ingresa los datos manualmente.";
      renderDrafts();
      return;
    }
    draft.busy = true;
    draft.status = "Reconociendo texto en español…";
    renderDrafts();
    try {
      const result = await Tesseract.recognize(draft.file, "spa", {
        logger: (message) => {
          if (message.status === "recognizing text" && message.progress) {
            draft.status = `Leyendo imagen… ${Math.round(message.progress * 100)}%`;
            const status = draftList.querySelector(`[data-draft-id="${draft.id}"] .draft-status`);
            if (status) status.textContent = draft.status;
          }
        }
      });
      const suggestion = parseReceipt(result.data.text);
      draft.status = suggestion ? "Lectura lista. Revisa y completa los campos." : "Imagen leída. Completa los campos manualmente.";
      if (suggestion.product) document.getElementById("productName").value = suggestion.product;
      if (suggestion.quantity) document.getElementById("quantity").value = suggestion.quantity;
      if (suggestion.unitPrice) document.getElementById("unitPrice").value = suggestion.unitPrice;
      showMessage(suggestion ? "Revisa los datos sugeridos antes de guardar la venta." : "No encontramos datos suficientes; puedes ingresarlos manualmente.", suggestion);
    } catch (error) {
      console.error("Falló la lectura de la imagen.", error);
      draft.status = "No se pudo leer. Completa los campos manualmente.";
      showMessage("No se pudo leer esta imagen. Ingresa los datos manualmente.", false);
    } finally {
      draft.busy = false;
      renderDrafts();
    }
  }

  function parseReceipt(text) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const numericValues = [];
    for (const line of lines) {
      const matches = line.match(/(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?/g) || [];
      for (const match of matches) {
        const value = parseAmount(match);
        if (Number.isFinite(value) && value > 0) numericValues.push(value);
      }
    }
    const product = lines.find((line) => /[a-záéíóúñ]{3,}/i.test(line) && !/total|subtotal|cambio|efectivo|gracias|factura|recibo|fecha|nit|iva/i.test(line));
    const quantityMatch = text.match(/(?:cant(?:idad)?|unid(?:ades)?)\s*[:x]?\s*(\d+)/i);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 0;
    const priceMatch = text.match(/(?:precio|valor\s*unitario|unitario)\D{0,12}(\d[\d.,]*)/i);
    let unitPrice = 0;
    if (priceMatch) {
      const raw = priceMatch[1];
      unitPrice = parseAmount(raw);
    } else if (numericValues.length) {
      unitPrice = numericValues.sort((a, b) => a - b)[0];
    }
    return { product: product ? product.replace(/^[\d\s.,$-]+/, "").slice(0, 80) : "", quantity, unitPrice };
  }

  document.getElementById("clearData").addEventListener("click", () => {
    if (!sales.length) {
      showMessage("No hay registros para limpiar.", false, true);
      return;
    }
    if (!window.confirm("¿Seguro que quieres borrar todas las ventas guardadas en este dispositivo?")) return;
    const previousSales = sales;
    sales = [];
    if (!saveSales()) {
      sales = previousSales;
      return;
    }
    render();
    showMessage("Se borraron las ventas de este dispositivo.", true, true);
  });

  showPage(location.hash.slice(1) || "resumen");
  render();
})();
