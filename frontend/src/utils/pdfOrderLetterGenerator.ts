import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToUkrainianWords } from './pdfWaybillGenerator';

export interface OrderLetterItem {
  index: number;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
}

export interface OrderLetterData {
  outgoingNumber: string;
  date: string;
  supplierName: string;
  senderOrganization: string;
  subject: string;
  items: OrderLetterItem[];
  totalCost: number;
  deliveryTerms?: string;
  rawText?: string;
}

// Кеш для шрифту
let cachedFontBase64: string | null = null;

async function loadFontBase64(): Promise<string> {
  if (cachedFontBase64) {
    return cachedFontBase64;
  }

  const response = await fetch('/fonts/Roboto-Regular.ttf');
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити шрифт для PDF (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      cachedFontBase64 = base64Data;
      resolve(base64Data);
    };
    reader.onerror = () => reject(new Error('Помилка зчитування шрифту'));
    reader.readAsDataURL(blob);
  });
}

function formatCurrency(val: number): string {
  return val.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Парсер текстового шаблону листа, сформованого AI-Копілотом
 */
export function parseOrderLetterFromText(text: string): OrderLetterData {
  const numMatch = text.match(/Вихідний\s+№\s*([\w\d-]+)\s+від\s*([\d\.]+)/i);
  const outgoingNumber = numMatch ? numMatch[1].trim() : `№ ${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`;
  const date = numMatch ? numMatch[2].trim() : new Date().toLocaleDateString('uk-UA');

  const toMatch = text.match(/Кому:\s*([^\n\r]+)/i);
  const supplierName = toMatch ? toMatch[1].trim() : 'Відділ оптових продажів постачальника';

  const fromMatch = text.match(/Від кого:\s*([^\n\r]+)/i);
  const senderOrganization = fromMatch ? fromMatch[1].trim() : 'ТОВ "Складські Системи та Логістика"';

  const subjMatch = text.match(/Тема:\s*([^\n\r]+)/i);
  const subject = subjMatch ? subjMatch[1].trim() : 'Замовлення на поповнення складських запасів';

  // Парсинг рядків товарів
  // Зразок: 1. Ноутбук ASUS TUF Gaming A15 (Артикул: SKU-TUF-A15) — 7 шт. по ціні 45,999.00 ₴ (Сума: 321,993.00 ₴)
  const itemRegex = /(\d+)\.\s+(.*?)\s+\(Артикул:\s*([\w\d-]+)\)\s+[—\-]\s+(\d+)\s*шт\.\s+по ціні\s+([\d\s,\.]+)\s*₴\s+\(Сума:\s+([\d\s,\.]+)\s*₴\)/gi;
  const items: OrderLetterItem[] = [];
  let match;

  while ((match = itemRegex.exec(text)) !== null) {
    const idx = parseInt(match[1], 10);
    const name = match[2].trim();
    const sku = match[3].trim();
    const qty = parseInt(match[4], 10);
    const price = parseFloat(match[5].replace(/\s/g, '').replace(',', '.'));
    const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));

    items.push({
      index: idx,
      name,
      sku,
      quantity: qty,
      unitPrice: price,
      totalCost: total
    });
  }

  // Загальна сума
  const totalMatch = text.match(/Сукупна планова вартість[^:]*:\s*([\d\s,\.]+)\s*₴/i);
  let totalCost = 0;
  if (totalMatch) {
    totalCost = parseFloat(totalMatch[1].replace(/\s/g, '').replace(',', '.'));
  } else if (items.length > 0) {
    totalCost = items.reduce((sum, it) => sum + it.totalCost, 0);
  }

  return {
    outgoingNumber,
    date,
    supplierName,
    senderOrganization,
    subject,
    items,
    totalCost,
    rawText: text
  };
}

/**
 * Генерація офіційного листа-замовлення формату А4
 */
export async function generateOrderLetterPdf(dataOrText: OrderLetterData | string): Promise<jsPDF> {
  const data = typeof dataOrText === 'string' ? parseOrderLetterFromText(dataOrText) : dataOrText;
  const fontBase64 = await loadFontBase64();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Реєстрація шрифту
  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // 1. Верхній декоративний колонтитул
  doc.setFillColor(25, 118, 210); // Первинний корпоративний синій
  doc.rect(margin, 12, contentWidth, 2, 'F');

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(data.senderOrganization + ' | Відділ матеріально-технічного забезпечення', margin, 19);
  doc.text('Тел: +38 (044) 230-11-22 | order@inventory-system.ua', pageWidth - margin, 19, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, 22, pageWidth - margin, 22);

  // 2. Реквізити документа (Номер та дата)
  let currentY = 30;
  doc.setFontSize(9.5);
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Вихідний № ${data.outgoingNumber}`, margin, currentY);
  doc.setFont('Roboto', 'normal');
  doc.text(`від ${data.date} року`, margin, currentY + 5);

  // Адресат (Кому) у правій частині
  const rightColX = pageWidth / 2 + 10;
  doc.setFont('Roboto', 'bold');
  doc.text('Кому:', rightColX, currentY);
  doc.setFont('Roboto', 'normal');
  doc.text(data.supplierName, rightColX, currentY + 5, { maxWidth: pageWidth - margin - rightColX });

  currentY += 20;

  // 3. Заголовок листа
  doc.setFontSize(14);
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ОФІЦІЙНИЙ ЛИСТ-ЗАМОВЛЕННЯ', pageWidth / 2, currentY, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Тема: ${data.subject}`, pageWidth / 2, currentY + 6, { align: 'center' });

  currentY += 16;

  // 4. Текстова преамбула
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Шановні партнери!', margin, currentY);
  currentY += 6;
  doc.text(
    'Просимо виставити рахунок-фактуру та погодити графік відвантаження наступної номенклатури продукції відповідно до умов чинного договору постачання:',
    margin,
    currentY,
    { maxWidth: contentWidth }
  );

  currentY += 10;

  // 5. Таблиця замовлених товарів
  if (data.items.length > 0) {
    const tableBody = data.items.map((it, idx) => [
      String(idx + 1),
      it.name,
      it.sku,
      `${it.quantity} шт.`,
      `${formatCurrency(it.unitPrice)} ₴`,
      `${formatCurrency(it.totalCost)} ₴`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['№', 'Найменування продукції', 'Артикул', 'К-сть', 'Ціна без ПДВ', 'Сума з ПДВ']],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: {
        font: 'Roboto',
        fontSize: 8.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        cellPadding: 2.5
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 32 },
        5: { halign: 'right', cellWidth: 36, fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    interface AutoTableDoc extends jsPDF {
      lastAutoTable?: { finalY: number };
    }
    const typedDoc = doc as AutoTableDoc;
    currentY = (typedDoc.lastAutoTable?.finalY || currentY + 30) + 8;
  } else if (data.rawText) {
    // Якщо структурованих рядків не знайдено — друкуємо повний текст
    doc.setFontSize(9);
    doc.text(data.rawText, margin, currentY, { maxWidth: contentWidth });
    currentY += 50;
  }

  // 6. Підсумковий блок вартості та умов
  if (currentY + 60 > pageHeight - margin) {
    doc.addPage();
    currentY = margin + 10;
  }

  doc.setFontSize(10);
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Сукупна планова вартість поставки: ${formatCurrency(data.totalCost)} ₴ з ПДВ.`, margin, currentY);
  currentY += 6;

  doc.setFontSize(9);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Сума прописом: ${numberToUkrainianWords(data.totalCost)}`, margin, currentY, { maxWidth: contentWidth });
  currentY += 7;

  doc.text('• Бажаний термін прибуття товару на розподільчий склад: протягом 5–7 робочих днів.', margin, currentY);
  currentY += 5;
  doc.text('• Умови оплати: безготівковий розрахунок відповідно до умов чинного договору.', margin, currentY);
  currentY += 15;

  // 7. Зона підписів відповідальних осіб
  const colWidth = (contentWidth - 10) / 2;

  // Ліва колонка
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Керівник відділу МТЗ:', margin, currentY);
  doc.setFont('Roboto', 'normal');
  doc.text('___________________ / М. О. Коваленко', margin, currentY + 8);
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('(підпис)                     (П.І.Б.)', margin + 10, currentY + 12);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('М.П.', margin, currentY + 18);

  // Права колонка
  const rightX = margin + colWidth + 10;
  doc.setTextColor(30, 41, 59);
  doc.setFont('Roboto', 'bold');
  doc.text('Головний бухгалтер:', rightX, currentY);
  doc.setFont('Roboto', 'normal');
  doc.text('___________________ / О. В. Сидоренко', rightX, currentY + 8);
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('(підпис)                     (П.І.Б.)', rightX + 10, currentY + 12);

  // 8. Нижній колонтитул
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Сформовано модулем AI-Копілот Складу | Вихідний № ${data.outgoingNumber}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Сторінка ${i} з ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Генерує та завантажує PDF офіційного листа постачальнику
 */
export async function downloadOrderLetterPdf(dataOrText: OrderLetterData | string, filename?: string): Promise<void> {
  const doc = await generateOrderLetterPdf(dataOrText);
  const data = typeof dataOrText === 'string' ? parseOrderLetterFromText(dataOrText) : dataOrText;
  const cleanNum = data.outgoingNumber.replace(/[\/\\]/g, '-').replace(/\s+/g, '_');
  const name = filename || `Замовлення_постачальнику_${cleanNum}.pdf`;
  doc.save(name);
}
