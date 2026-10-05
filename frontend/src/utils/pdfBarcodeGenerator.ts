import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { Product } from '../types/inventory';

export type BarcodeFormat = 'CODE128' | 'QR' | 'COMBINED';
export type LabelSize = 'standard' | 'large' | 'compact'; // 58x40mm, 80x50mm, 40x25mm

export interface LabelOptions {
  format: BarcodeFormat;
  size: LabelSize;
  copies: number;
  showPrice: boolean;
  showCategory: boolean;
  showDate: boolean;
  showSku: boolean;
}

let cachedFontBase64: string | null = null;

async function loadFontBase64(): Promise<string | null> {
  if (cachedFontBase64) return cachedFontBase64;
  try {
    const response = await fetch('/fonts/Roboto-Regular.ttf');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        cachedFontBase64 = result.split(',')[1];
        resolve(cachedFontBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Генерує Base64 PNG зображення штрих-коду Code128 через canvas
 */
export function generateBarcodeDataUrl(text: string, height: number = 50): string {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 2,
      height: height,
      displayValue: true,
      fontSize: 13,
      font: 'monospace',
      textMargin: 3,
      margin: 4,
      background: '#ffffff',
      lineColor: '#000000'
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Barcode generation fallback:', err);
    // Fallback якщо в тексті є неприпустимі символи
    const canvas = document.createElement('canvas');
    const safeText = text.replace(/[^A-Za-z0-9-_]/g, '') || 'SKU-ITEM';
    JsBarcode(canvas, safeText, {
      format: 'CODE128',
      width: 2,
      height: height,
      displayValue: true,
      fontSize: 13,
      font: 'monospace',
      textMargin: 3,
      margin: 4,
      background: '#ffffff',
      lineColor: '#000000'
    });
    return canvas.toDataURL('image/png');
  }
}

/**
 * Генерує Base64 PNG зображення QR-коду
 */
export async function generateQrCodeDataUrl(text: string, width: number = 160): Promise<string> {
  return await QRCode.toDataURL(text, {
    width,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  });
}

/**
 * Формує текст для QR-коду товару
 */
export function buildProductQrPayload(product: Product): string {
  return JSON.stringify({
    sku: product.sku || product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
    id: product.id
  });
}

/**
 * Прямий друк етикеток у вікні браузера (підходить для термопринтерів етикеток 58x40 або 80x50)
 */
export async function printLabelsInBrowser(products: Product[], options: LabelOptions): Promise<void> {
  const printWindow = window.open('', '_blank', 'width=800,height=700');
  if (!printWindow) {
    alert('Будь ласка, дозвольте спливаючі вікна для друку етикеток');
    return;
  }

  // Готуємо список елементів з урахуванням кількості копій
  const itemsToPrint: Array<{
    product: Product;
    barcodeUrl: string;
    qrUrl: string;
  }> = [];

  for (const product of products) {
    const codeValue = product.sku && product.sku.trim() !== '' ? product.sku : `SKU-${product.id.slice(0, 8).toUpperCase()}`;
    const barcodeUrl = generateBarcodeDataUrl(codeValue, 45);
    const qrUrl = await generateQrCodeDataUrl(buildProductQrPayload(product), 130);

    for (let c = 0; c < (options.copies || 1); c++) {
      itemsToPrint.push({ product, barcodeUrl, qrUrl });
    }
  }

  const dateStr = new Date().toLocaleDateString('uk-UA');

  // Розміри етикеток
  const sizeStyles = {
    compact: { width: '40mm', height: '25mm', fontSize: '9px', titleSize: '10px' },
    standard: { width: '58mm', height: '40mm', fontSize: '11px', titleSize: '12px' },
    large: { width: '80mm', height: '50mm', fontSize: '12px', titleSize: '14px' }
  }[options.size];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Друк етикеток - Складський облік</title>
      <style>
        @page {
          size: auto;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 10px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          background: #f0f2f5;
          color: #111;
        }
        .labels-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }
        .label-card {
          width: ${sizeStyles.width};
          height: ${sizeStyles.height};
          border: 1px dashed #ccc;
          padding: 6px;
          box-sizing: border-box;
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-inside: avoid;
          break-inside: avoid;
          position: relative;
        }
        .label-header {
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 2px;
          margin-bottom: 2px;
        }
        .product-title {
          font-size: ${sizeStyles.titleSize};
          font-weight: bold;
          line-height: 1.1;
          max-height: 2.2em;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .product-meta {
          font-size: ${sizeStyles.fontSize};
          color: #444;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2px;
        }
        .product-price {
          font-weight: 800;
          font-size: calc(${sizeStyles.fontSize} + 2px);
          color: #000;
        }
        .code-area {
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 2px 0;
        }
        .barcode-img {
          max-width: 100%;
          max-height: 28mm;
          object-fit: contain;
        }
        .qr-img {
          max-width: 22mm;
          max-height: 22mm;
          object-fit: contain;
        }
        .combined-codes {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 4px;
        }
        .combined-codes .barcode-img {
          max-width: 65%;
          max-height: 24mm;
        }
        .combined-codes .qr-img {
          max-width: 18mm;
          max-height: 18mm;
        }
        .label-footer {
          font-size: 8px;
          color: #666;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #eee;
          padding-top: 2px;
        }
        @media print {
          body {
            background: transparent;
            padding: 0;
          }
          .label-card {
            border: none;
            page-break-after: always;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: center; margin-bottom: 16px; padding: 12px; background: #fff; border-bottom: 1px solid #ddd;">
        <button onclick="window.print()" style="padding: 10px 24px; font-size: 16px; font-weight: bold; background: #1976d2; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
          🖨️ Друкувати зараз (${itemsToPrint.length} шт.)
        </button>
        <button onclick="window.close()" style="padding: 10px 18px; font-size: 16px; margin-left: 10px; background: #eee; border: 1px solid #ccc; border-radius: 6px; cursor: pointer;">
          Закрити
        </button>
      </div>

      <div class="labels-container">
        ${itemsToPrint.map(({ product, barcodeUrl, qrUrl }) => `
          <div class="label-card">
            <div class="label-header">
              <div class="product-title">${escapeHtml(product.name)}</div>
              <div class="product-meta">
                ${options.showCategory && product.category?.name ? `<span>${escapeHtml(product.category.name)}</span>` : '<span></span>'}
                ${options.showPrice ? `<span class="product-price">${product.price.toFixed(2)} грн/${escapeHtml(product.unit)}</span>` : ''}
              </div>
            </div>

            <div class="code-area">
              ${options.format === 'CODE128' ? `
                <img class="barcode-img" src="${barcodeUrl}" alt="Barcode">
              ` : options.format === 'QR' ? `
                <img class="qr-img" src="${qrUrl}" alt="QR Code">
              ` : `
                <div class="combined-codes">
                  <img class="barcode-img" src="${barcodeUrl}" alt="Barcode">
                  <img class="qr-img" src="${qrUrl}" alt="QR">
                </div>
              `}
            </div>

            <div class="label-footer">
              <span>SKU: ${escapeHtml(product.sku || product.id.slice(0, 8).toUpperCase())}</span>
              ${options.showDate ? `<span>${dateStr}</span>` : '<span>Складський облік</span>'}
            </div>
          </div>
        `).join('')}
      </div>

      <script>
        // Автоматичний виклик діалогу друку після завантаження картинок
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Генерація та завантаження PDF-листа етикеток (сітка формату A4)
 */
export async function downloadBarcodePdfSheet(products: Product[], options: LabelOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const fontBase64 = await loadFontBase64();
  if (fontBase64) {
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
  }

  // Розміри сітки на листі A4 (210 x 297 мм)
  const cols = options.size === 'large' ? 2 : options.size === 'compact' ? 4 : 3;
  const labelWidth = options.size === 'large' ? 88 : options.size === 'compact' ? 44 : 58;
  const labelHeight = options.size === 'large' ? 52 : options.size === 'compact' ? 28 : 42;
  const marginX = 12;
  const marginY = 15;
  const gapX = 4;
  const gapY = 4;

  const rows = Math.floor((297 - marginY * 2) / (labelHeight + gapY));

  let currentX = marginX;
  let currentY = marginY;
  let colIndex = 0;
  let rowIndex = 0;
  let isFirstPage = true;

  const allItems: Product[] = [];
  for (const product of products) {
    for (let c = 0; c < (options.copies || 1); c++) {
      allItems.push(product);
    }
  }

  for (let i = 0; i < allItems.length; i++) {
    const product = allItems[i];

    if (!isFirstPage && colIndex === 0 && rowIndex === 0) {
      doc.addPage();
      if (fontBase64) doc.setFont('Roboto');
    }
    isFirstPage = false;

    // Рамка етикетки
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.roundedRect(currentX, currentY, labelWidth, labelHeight, 1.5, 1.5, 'S');

    // Назва товару
    doc.setFontSize(options.size === 'compact' ? 8 : 9);
    doc.setTextColor(30, 30, 30);
    const title = product.name.length > 28 ? product.name.slice(0, 26) + '...' : product.name;
    doc.text(title, currentX + 3, currentY + 5);

    // Ціна та категорія
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    if (options.showCategory && product.category?.name) {
      const catText = product.category.name.length > 18 ? product.category.name.slice(0, 16) + '..' : product.category.name;
      doc.text(catText, currentX + 3, currentY + 9);
    }
    if (options.showPrice) {
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      const priceText = `${product.price.toFixed(2)} грн`;
      doc.text(priceText, currentX + labelWidth - 3, currentY + 9, { align: 'right' });
    }

    const skuText = product.sku && product.sku.trim() !== '' ? product.sku : `SKU-${product.id.slice(0, 8).toUpperCase()}`;

    // Додаємо штрихкод або QR
    if (options.format === 'CODE128') {
      const barcodeDataUrl = generateBarcodeDataUrl(skuText, 40);
      const bWidth = labelWidth - 6;
      const bHeight = labelHeight - 17;
      doc.addImage(barcodeDataUrl, 'PNG', currentX + 3, currentY + 11, bWidth, bHeight);
    } else if (options.format === 'QR') {
      const qrDataUrl = await generateQrCodeDataUrl(buildProductQrPayload(product), 150);
      const qrSize = labelHeight - 16;
      doc.addImage(qrDataUrl, 'PNG', currentX + (labelWidth - qrSize) / 2, currentY + 11, qrSize, qrSize);
    } else {
      // COMBINED
      const barcodeDataUrl = generateBarcodeDataUrl(skuText, 35);
      const qrDataUrl = await generateQrCodeDataUrl(buildProductQrPayload(product), 120);
      const qrSize = labelHeight - 18;
      doc.addImage(barcodeDataUrl, 'PNG', currentX + 3, currentY + 12, labelWidth - qrSize - 8, labelHeight - 18);
      doc.addImage(qrDataUrl, 'PNG', currentX + labelWidth - qrSize - 3, currentY + 12, qrSize, qrSize);
    }

    // Нижній рядок (SKU)
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`SKU: ${skuText}`, currentX + 3, currentY + labelHeight - 2);

    colIndex++;
    if (colIndex >= cols) {
      colIndex = 0;
      rowIndex++;
      currentX = marginX;
      currentY += labelHeight + gapY;

      if (rowIndex >= rows) {
        rowIndex = 0;
        currentY = marginY;
      }
    } else {
      currentX += labelWidth + gapX;
    }
  }

  const fileName = products.length === 1 
    ? `barcode_${products[0].sku || 'label'}.pdf`
    : `barcodes_batch_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(fileName);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
