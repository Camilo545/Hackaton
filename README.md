# Cuenta Clara

Prototipo web para llevar las ventas de una feria universitaria. Permite registrar productos manualmente o cargar varias imágenes de facturas/recibos y usar OCR en español para sugerir datos. Las sugerencias siempre se pueden revisar y corregir antes de registrar la venta.

## Ejecutar

Abre `index.html` en un navegador moderno. Para habilitar la lectura de imágenes se necesita conexión a internet para cargar Tesseract.js y su modelo de español; el registro manual funciona sin OCR.

Las ventas se guardan en el almacenamiento local del navegador (`localStorage`) y se conservan en ese dispositivo. No se envían a un servidor.

## Funcionalidad

- Carga múltiple de imágenes JPG, PNG o WEBP.
- Lectura OCR de apoyo y captura manual de nombre, cantidad y precio unitario.
- El precio acepta separadores de miles con punto o coma (por ejemplo, `1.500` o `1,500`).
- Validación de campos antes de guardar.
- Pantallas separadas de resumen, registro de ventas e historial.
- Resumen de recaudo, transacciones, unidades vendidas y productos más vendidos.
- Historial local de todas las ventas registradas.
