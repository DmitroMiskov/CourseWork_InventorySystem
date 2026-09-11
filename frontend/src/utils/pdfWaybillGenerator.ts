import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface WaybillItem {
  id?: string;
  sku?: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
}

export interface WaybillCustomer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
}

export interface WaybillData {
  documentNumber: string;
  date: Date | string;
  customer?: WaybillCustomer | null;
  reason?: string;
  storekeeperName?: string;
  items: WaybillItem[];
  organizationName?: string;
}

// Кеш для шрифту, щоб не завантажувати повторно при кожному виклику
let cachedFontBase64: string | null = null;

/**
 * Завантажує шрифт Roboto-Regular з public/fonts та повертає Base64 рядок
 */
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

/**
 * Перетворює числове значення суми в українські слова (сума прописом)
 */
export function numberToUkrainianWords(amount: number): string {
  const unitsF = ['', 'одна', 'дві', 'три', 'чотири', "п'ять", 'шість', 'сім', 'вісім', "дев'ять"];
  const unitsM = ['', 'один', 'два', 'три', 'чотири', "п'ять", 'шість', 'сім', 'вісім', "дев'ять"];
  const teens = [
    'десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять',
    "п'ятнадцять", 'шістнадцять', 'сімнадцять', 'вісімнадцять', "дев'ятнадцять"
  ];
  const tens = [
    '', '', 'двадцять', 'тридцять', 'сорок', "п'ятдесят",
    'шістдесят', 'сімдесят', 'вісімдесят', "дев'яносто"
  ];
  const hundreds = [
    '', 'сто', 'двісті', 'триста', 'чотириста',
    "п'ятсот", 'шістсот', 'сімсот', 'вісімсот', "дев'ятсот"
  ];

  const hryvnias = Math.floor(Math.abs(amount));
  const kopecks = Math.round((Math.abs(amount) - hryvnias) * 100);

  function getWord(n: number, w1: string, w2: string, w5: string): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return w5;
    if (mod10 === 1) return w1;
    if (mod10 >= 2 && mod10 <= 4) return w2;
    return w5;
  }

  function triadToWords(num: number, isFemale: boolean): string {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    const res: string[] = [];
    if (h > 0) res.push(hundreds[h]);
    if (t === 1) {
      res.push(teens[u]);
    } else {
      if (t > 1) res.push(tens[t]);
      if (u > 0) res.push(isFemale ? unitsF[u] : unitsM[u]);
    }
    return res.join(' ');
  }

  if (hryvnias === 0) {
    return `Нуль гривень ${String(kopecks).padStart(2, '0')} копійок`;
  }

  const millions = Math.floor(hryvnias / 1000000);
  const thousands = Math.floor((hryvnias % 1000000) / 1000);
  const ones = hryvnias % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(triadToWords(millions, false));
    parts.push(getWord(millions, 'мільйон', 'мільйони', 'мільйонів'));
  }
  if (thousands > 0) {
    parts.push(triadToWords(thousands, true));
    parts.push(getWord(thousands, 'тисяча', 'тисячі', 'тисяч'));
  }
  if (ones > 0) {
    parts.push(triadToWords(ones, true));
  }
  parts.push(getWord(hryvnias, 'гривня', 'гривні', 'гривень'));

  const words = parts.filter(Boolean).join(' ').trim();
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} ${String(kopecks).padStart(2, '0')} ${getWord(kopecks, 'копійка', 'копійки', 'копійок')}`;
}

/**
 * Форматує число як суму в гривнях
 */
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

/**
 * Генерує документ видаткової накладної у форматі jsPDF
 */
export async function generateWaybillPdf(data: WaybillData): Promise<jsPDF> {
  const fontBase64 = await loadFontBase64();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Реєстрація кириличного шрифту
  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Верхній колонтитул
  doc.setFontSize(8);
  doc.setTextColor(110, 120, 135);
  doc.text(data.organizationName || 'ТОВ "Складська Система Інвентаризації" | ЄДРПОУ 41234567 | м. Київ', margin, 12);
  doc.text('Типова форма № М-11', pageWidth - margin, 12, { align: 'right' });

  // Лінія під верхнім колонтитулом
  doc.setDrawColor(220, 226, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, 14, pageWidth - margin, 14);

  // 2. Заголовок документа
  doc.setFontSize(15);
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(26, 36, 54);
  doc.text(`ВИДАТКОВА НАКЛАДНА № ${data.documentNumber}`, pageWidth / 2, 23, { align: 'center' });

  const docDate = typeof data.date === 'string' ? new Date(data.date) : data.date;
  const formattedDate = docDate.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  doc.setFontSize(9);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(80, 90, 105);
  doc.text(`від ${formattedDate} р.`, pageWidth / 2, 28, { align: 'center' });

  // 3. Інформаційні блоки: Постачальник та Одержувач
  let currentY = 34;

  // Блок Постачальника
  doc.setFontSize(8.5);
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(40, 50, 70);
  doc.text('Постачальник (Відправник):', margin, currentY);
  doc.setFont('Roboto', 'normal');
  doc.text(
    'ТОВ "Складська Система Інвентаризації", Головний розподільчий склад №1 (м. Київ, вул. Складська, 10)',
    margin + 42,
    currentY,
    { maxWidth: contentWidth - 42 }
  );

  currentY += 7;

  // Блок Одержувача
  doc.setFont('Roboto', 'bold');
  doc.text('Одержувач (Покупець):', margin, currentY);
  doc.setFont('Roboto', 'normal');

  let customerStr = data.customer?.name || 'Внутрішній підрозділ / Клієнт';
  if (data.customer?.phone) {
    customerStr += ` (тел.: ${data.customer.phone})`;
  }
  if (data.customer?.address) {
    customerStr += `, адреса: ${data.customer.address}`;
  }
  doc.text(customerStr, margin + 42, currentY, { maxWidth: contentWidth - 42 });

  currentY += 7;

  // Блок Підстави
  doc.setFont('Roboto', 'bold');
  doc.text('Підстава / Замовлення:', margin, currentY);
  doc.setFont('Roboto', 'normal');
  doc.text(
    data.reason?.trim() || 'Видача матеріальних цінностей зі складу',
    margin + 42,
    currentY,
    { maxWidth: contentWidth - 42 }
  );

  currentY += 8;

  // 4. Таблиця товарів через autoTable
  let totalQuantity = 0;
  let totalPrice = 0;

  const tableBody = data.items.map((item, index) => {
    const sum = item.quantity * item.price;
    totalQuantity += item.quantity;
    totalPrice += sum;

    return [
      String(index + 1),
      item.sku || '—',
      item.name,
      item.unit || 'шт',
      String(item.quantity),
      formatCurrency(item.price),
      formatCurrency(sum)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['№', 'Артикул', 'Найменування товару', 'Од.', 'К-сть', 'Ціна, грн', 'Сума, грн']],
    body: tableBody,
    foot: [
      ['', '', 'РАЗОМ:', '', String(totalQuantity), '', `${formatCurrency(totalPrice)} грн`]
    ],
    theme: 'grid',
    styles: {
      font: 'Roboto',
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [210, 218, 228],
      lineWidth: 0.2
    },
    headStyles: {
      font: 'Roboto',
      fontStyle: 'bold',
      fillColor: [37, 99, 235], // Primary Blue
      textColor: [255, 255, 255],
      halign: 'center'
    },
    footStyles: {
      font: 'Roboto',
      fontStyle: 'bold',
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 28 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Отримуємо позицію після таблиці
  interface AutoTableDoc extends jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
  const typedDoc = doc as AutoTableDoc;
  let finalY = (typedDoc.lastAutoTable?.finalY || currentY + 40) + 7;

  // Перевірка чи поміщається підвал на поточній сторінці
  const pageHeight = doc.internal.pageSize.getHeight();
  if (finalY + 45 > pageHeight - margin) {
    doc.addPage();
    finalY = margin + 10;
  }

  // 5. Підсумковий текстовий блок
  doc.setFontSize(9);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(30, 41, 59);

  doc.text(
    `Всього відпущено найменувань: ${data.items.length}, у загальній кількості ${totalQuantity} од.`,
    margin,
    finalY
  );
  finalY += 5;

  doc.setFont('Roboto', 'bold');
  doc.text(
    `На загальну суму: ${formatCurrency(totalPrice)} грн`,
    margin,
    finalY
  );
  finalY += 5;

  doc.setFont('Roboto', 'normal');
  doc.text(
    `Сума прописом: ${numberToUkrainianWords(totalPrice)}`,
    margin,
    finalY,
    { maxWidth: contentWidth }
  );

  finalY += 12;

  // 6. Блок підписів
  const colWidth = (contentWidth - 10) / 2;

  // Ліва колонка: Відпустив (Комірник)
  doc.setFont('Roboto', 'bold');
  doc.text('Відпустив (Комірник / Відповідальна особа):', margin, finalY);
  doc.setFont('Roboto', 'normal');
  doc.text('___________________ / ' + (data.storekeeperName || 'Адміністратор'), margin, finalY + 8);
  doc.setFontSize(7.5);
  doc.setTextColor(130, 140, 155);
  doc.text('(підпис)                     (П.І.Б.)', margin + 10, finalY + 12);
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 125);
  doc.text('М.П.', margin, finalY + 18);

  // Права колонка: Отримав (Одержувач)
  const rightX = margin + colWidth + 10;
  doc.setTextColor(30, 41, 59);
  doc.setFont('Roboto', 'bold');
  doc.text('Прийняв (Одержувач / Покупець):', rightX, finalY);
  doc.setFont('Roboto', 'normal');
  const recipientName = data.customer?.contactPerson || data.customer?.name || 'Представник одержувача';
  doc.text('___________________ / ' + recipientName, rightX, finalY + 8);
  doc.setFontSize(7.5);
  doc.setTextColor(130, 140, 155);
  doc.text('(підпис)                     (П.І.Б.)', rightX + 10, finalY + 12);
  doc.setFontSize(8.5);
  doc.setTextColor(80, 90, 105);
  doc.text('За довіреністю: № ________ від ___.___.202__ р.', rightX, finalY + 18);

  // 7. Нижній системний колонтитул
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 150, 165);
    doc.text(
      `Складено в Inventory System | Документ № ${data.documentNumber}`,
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
 * Генерує та завантажує файл PDF у браузері
 */
export async function downloadWaybillPdf(data: WaybillData, filename?: string): Promise<void> {
  const doc = await generateWaybillPdf(data);
  const name = filename || `Накладна_${data.documentNumber.replace(/[\/\\]/g, '-')}.pdf`;
  doc.save(name);
}

/**
 * Генерує PDF та відкриває вікно попереднього перегляду / друку
 */
export async function printWaybillPdf(data: WaybillData): Promise<void> {
  const doc = await generateWaybillPdf(data);
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  const printWindow = window.open(blobUrl, '_blank');
  if (printWindow) {
    printWindow.focus();
  }
}
