import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import {
  MilkEntry,
  DashboardSummary,
  Payment,
  Language,
  formatPaise
} from '@family-milk/shared';

export interface MilkBillExportData {
  familyName: string;
  yearMonth: string;
  entries: MilkEntry[];
  summary: DashboardSummary;
  payments?: Payment[];
  lang?: Language;
}

/**
 * Formats ISO timestamps or raw date strings into clean DD-MM-YYYY in Asia/Kolkata timezone.
 */
export function formatKolkataDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).formatToParts(d);
      const day = parts.find((p) => p.type === 'day')?.value || '01';
      const month = parts.find((p) => p.type === 'month')?.value || '01';
      const year = parts.find((p) => p.type === 'year')?.value || '2026';
      return `${day}-${month}-${year}`;
    }
  } catch {
    // fallback
  }
  return dateStr.substring(0, 10);
}

function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

function mlToL(ml: number): number {
  return Math.round(ml) / 1000;
}

function t(key: string, lang: Language): string {
  const strings: Record<string, Record<Language, string>> = {
    monthlyStatement: { en: 'Monthly Milk Statement', ta: 'மாதாந்திர பால் அறிக்கை', ml: 'പ്രതിമാസ പാൽ സ്റ്റേറ്റ്മെന്റ്' },
    familyName: { en: 'Family / Account', ta: 'குடும்பம் / கணக்கு', ml: 'കുടുംബം / അക്കൗണ്ട്' },
    statementMonth: { en: 'Statement Month', ta: 'அறிக்கை மாதம்', ml: 'സ്റ്റേറ്റ്മെന്റ് മാസം' },
    generatedOn: { en: 'Generated On', ta: 'உருவாக்கப்பட்ட தேதி', ml: 'തയ്യാറാക്കിയ തീയതി' },
    totalRecords: { en: 'Total Records', ta: 'மொத்த பதிவுகள்', ml: 'ആകെ രേഖകൾ' },
    purchaseDays: { en: 'Purchase Days', ta: 'வாங்கிய நாட்கள்', ml: 'വാങ്ങിയ ദിവസങ്ങൾ' },
    totalMilk: { en: 'Total Milk', ta: 'மொத்த பால்', ml: 'ആകെ പാൽ' },
    ratePerLitre: { en: 'Rate per Litre', ta: 'லிட்டர் விலை', ml: 'ലിറ്ററിന് വില' },
    openingBalance: { en: 'Opening Balance', ta: 'தொடக்க பாக்கி', ml: 'ആരംഭ ബാലൻസ്' },
    totalMilkCharges: { en: 'Total Milk Charges', ta: 'மொத்த பால் கட்டணம்', ml: 'ആകെ പാൽ ചാർജ്' },
    totalPayments: { en: 'Total Payments', ta: 'மொத்த செலுத்தியது', ml: 'ആകെ നൽകിയത്' },
    closingBalance: { en: 'Closing Balance', ta: 'இறுதி பாக்கி', ml: 'ക്ലോസിംഗ് ബാലൻസ്' },
    balanceDue: { en: 'Balance Due', ta: 'பாக்கி தொகை', ml: 'കുടിശ്ശിക' },
    advanceCredit: { en: 'Advance Credit', ta: 'முன்பணம்', ml: 'മുൻകൂർ' },
    allSettled: { en: 'All Settled', ta: 'முழுமையாக செலுத்தப்பட்டது', ml: 'പൂർണ്ണമായും തീർത്തു' },
    serial: { en: '#', ta: '#', ml: '#' },
    date: { en: 'Date', ta: 'தேதி', ml: 'തീയതി' },
    quantity: { en: 'Quantity (L)', ta: 'அளவு (L)', ml: 'അളവ് (L)' },
    rate: { en: 'Rate/L (₹)', ta: 'விலை/லி (₹)', ml: 'വില/ലി (₹)' },
    amount: { en: 'Amount (₹)', ta: 'தொகை (₹)', ml: 'തുക (₹)' },
    status: { en: 'Status', ta: 'நிலை', ml: 'നില' },
    notes: { en: 'Notes', ta: 'குறிப்பு', ml: 'കുറിപ്പ്' },
    paid: { en: 'Paid', ta: 'செலுத்தியது', ml: 'നൽകി' },
    pending: { en: 'Pending', ta: 'பாக்கி', ml: 'ബാക്കി' },
    partial: { en: 'Partial', ta: 'பகுதி', ml: 'ഭാഗികം' },
    noMilk: { en: 'No Milk', ta: 'வாங்கவில்லை', ml: 'വാങ്ങിയില്ല' },
    total: { en: 'Total', ta: 'மொத்தம்', ml: 'ആകെ' },
    charges: { en: 'Charges', ta: 'கட்டணம்', ml: 'ചാർജ്' },
    due: { en: 'Due', ta: 'பாக்கி', ml: 'കുടിശ്ശിക' },
    paymentDate: { en: 'Payment Date', ta: 'செலுத்திய தேதி', ml: 'നൽകിയ തീയതി' },
    paymentAmount: { en: 'Amount (₹)', ta: 'தொகை (₹)', ml: 'തുക (₹)' },
    paymentMethod: { en: 'Method', ta: 'முறை', ml: 'മാർഗം' },
    paymentNotes: { en: 'Notes', ta: 'குறிப்பு', ml: 'കുറിപ്പ്' },
    cash: { en: 'Cash', ta: 'ரொக்கம்', ml: 'ക്യാഷ്' },
    upi: { en: 'UPI', ta: 'UPI', ml: 'UPI' },
    bankTransfer: { en: 'Bank Transfer', ta: 'வங்கி மாற்றம்', ml: 'ബാങ്ക് ട്രാൻസ്ഫർ' },
    other: { en: 'Other', ta: 'மற்றவை', ml: 'മറ്റുള്ളവ' },
    summary: { en: 'Summary', ta: 'சுருக்கம்', ml: 'സംഗ്രഹം' },
    milkRecords: { en: 'Milk Records', ta: 'பால் பதிவுகள்', ml: 'പാൽ രേഖകൾ' },
    payments: { en: 'Payments', ta: 'செலுத்தல்கள்', ml: 'പേയ്മെന്റുകൾ' },
    noPayments: { en: 'No payments recorded', ta: 'செலுத்தல்கள் இல்லை', ml: 'പേയ്മെന്റുകൾ ഇല്ല' },
  };
  return strings[key]?.[lang] || strings[key]?.en || key;
}

const COLORS = {
  primary: 'FF1E40AF',
  primaryBg: 'FFEFF6FF',
  primaryBorder: 'FFBFDBFE',
  danger: 'FFB91C1C',
  dangerBg: 'FFFEF2F2',
  dangerBorder: 'FFFECACA',
  success: 'FF15803D',
  successBg: 'FFF0FDF4',
  successBorder: 'FFBBF7D0',
  dark: 'FF0F172A',
  muted: 'FF64748B',
  headerBg: 'FFF1F5F9',
  headerBorder: 'FFCBD5E1',
  rowBorder: 'FFE2E8F0',
  white: 'FFFFFFFF',
  greenRibbon: 'FF107C41',
  altRow: 'FFF8FAFC',
  totalBg: 'FFEEF2FF',
};

function getMonthLabel(yearMonth: string, lang: Language): string {
  const [year, month] = yearMonth.split('-');
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesTa = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
  const monthNamesMl = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
  const mIndex = parseInt(month, 10) - 1;
  if (lang === 'ml') return `${monthNamesMl[mIndex] || month} ${year}`;
  if (lang === 'ta') return `${monthNamesTa[mIndex] || month} ${year}`;
  return `${monthNamesEn[mIndex] || month} ${year}`;
}

function getPaymentMethodLabel(method: string, lang: Language): string {
  const map: Record<string, string> = {
    cash: t('cash', lang),
    upi: t('upi', lang),
    bank_transfer: t('bankTransfer', lang),
    other: t('other', lang),
  };
  return map[method] || method;
}

function applyHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLORS.dark } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    bottom: { style: 'medium', color: { argb: COLORS.headerBorder } },
    top: { style: 'thin', color: { argb: COLORS.rowBorder } },
    left: { style: 'thin', color: { argb: COLORS.rowBorder } },
    right: { style: 'thin', color: { argb: COLORS.rowBorder } },
  };
}

function applyDataCellBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    bottom: { style: 'thin', color: { argb: COLORS.rowBorder } },
    top: { style: 'thin', color: { argb: COLORS.rowBorder } },
    left: { style: 'thin', color: { argb: COLORS.rowBorder } },
    right: { style: 'thin', color: { argb: COLORS.rowBorder } },
  };
}

/**
 * Builds a professional, multi-sheet Excel workbook.
 * Sheet 1: Monthly Summary — accounting overview
 * Sheet 2: Milk Records — complete data table with frozen header and AutoFilter
 * Sheet 3: Payments — payment records (if available)
 */
export async function generateMilkBillWorkbook(data: MilkBillExportData): Promise<{
  workbook: ExcelJS.Workbook;
  blob: Blob;
  filename: string;
}> {
  const { familyName, yearMonth, entries, summary, payments, lang = 'en' } = data;

  const todayStr = formatKolkataDate(new Date().toISOString());
  const monthLabel = getMonthLabel(yearMonth, lang);
  const isDue = (summary.closingBalancePaise || 0) > 0;
  const isCredit = (summary.closingBalancePaise || 0) < 0;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Family Milk Account';
  workbook.lastModifiedBy = familyName;
  workbook.created = new Date();
  workbook.modified = new Date();

  // ================================================================
  // SHEET 1: MONTHLY SUMMARY
  // ================================================================
  const summarySheet = workbook.addWorksheet(t('summary', lang), {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  summarySheet.columns = [
    { width: 4 },
    { width: 28 },
    { width: 24 },
    { width: 4 },
  ];

  let r = 2;

  // Title
  summarySheet.mergeCells(`B${r}:C${r}`);
  const titleCell = summarySheet.getCell(`B${r}`);
  titleCell.value = t('monthlyStatement', lang);
  titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: COLORS.primary } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  summarySheet.getRow(r).height = 30;
  r += 2;

  // Summary fields helper
  const addSummaryRow = (label: string, value: string, valueColor?: string, bold?: boolean) => {
    const labelCell = summarySheet.getCell(`B${r}`);
    labelCell.value = label;
    labelCell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.muted } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const valCell = summarySheet.getCell(`C${r}`);
    valCell.value = value;
    valCell.font = { name: 'Calibri', size: 11, bold: bold || false, color: { argb: valueColor || COLORS.dark } };
    valCell.alignment = { vertical: 'middle', horizontal: 'right' };

    summarySheet.getRow(r).height = 22;
    r++;
  };

  addSummaryRow(t('familyName', lang), familyName, COLORS.dark, true);
  addSummaryRow(t('statementMonth', lang), monthLabel, COLORS.primary, true);
  addSummaryRow(t('generatedOn', lang), todayStr);
  r++;

  // Divider
  summarySheet.mergeCells(`B${r}:C${r}`);
  summarySheet.getCell(`B${r}`).border = { bottom: { style: 'medium', color: { argb: COLORS.primaryBorder } } };
  summarySheet.getCell(`C${r}`).border = { bottom: { style: 'medium', color: { argb: COLORS.primaryBorder } } };
  summarySheet.getRow(r).height = 8;
  r += 2;

  addSummaryRow(t('totalRecords', lang), `${entries.length}`);
  addSummaryRow(t('purchaseDays', lang), `${summary.purchaseDays}`);
  addSummaryRow(t('totalMilk', lang), `${summary.totalLitres} L`, COLORS.primary, true);
  addSummaryRow(t('ratePerLitre', lang), formatPaise(summary.currentRatePaisePerLitre));
  r++;

  // Divider
  summarySheet.mergeCells(`B${r}:C${r}`);
  summarySheet.getCell(`B${r}`).border = { bottom: { style: 'thin', color: { argb: COLORS.rowBorder } } };
  summarySheet.getCell(`C${r}`).border = { bottom: { style: 'thin', color: { argb: COLORS.rowBorder } } };
  summarySheet.getRow(r).height = 8;
  r += 2;

  addSummaryRow(t('openingBalance', lang), formatPaise(summary.openingBalancePaise));
  addSummaryRow(t('totalMilkCharges', lang), formatPaise(summary.totalMilkChargesPaise), COLORS.danger, true);
  addSummaryRow(t('totalPayments', lang), formatPaise(summary.totalPaymentsPaise), COLORS.success, true);
  r++;

  // Divider
  summarySheet.mergeCells(`B${r}:C${r}`);
  summarySheet.getCell(`B${r}`).border = { bottom: { style: 'medium', color: { argb: isDue ? COLORS.dangerBorder : COLORS.successBorder } } };
  summarySheet.getCell(`C${r}`).border = { bottom: { style: 'medium', color: { argb: isDue ? COLORS.dangerBorder : COLORS.successBorder } } };
  summarySheet.getRow(r).height = 8;
  r += 2;

  // Closing Balance — highlighted
  const balanceLabel = isDue ? t('balanceDue', lang) : isCredit ? t('advanceCredit', lang) : t('allSettled', lang);
  const balanceColor = isDue ? COLORS.danger : isCredit ? COLORS.success : COLORS.dark;

  const balLabelCell = summarySheet.getCell(`B${r}`);
  balLabelCell.value = balanceLabel;
  balLabelCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: balanceColor } };
  balLabelCell.alignment = { vertical: 'middle', horizontal: 'left' };

  const balValCell = summarySheet.getCell(`C${r}`);
  balValCell.value = formatPaise(Math.abs(summary.closingBalancePaise));
  balValCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: balanceColor } };
  balValCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // Highlight background for the closing balance row
  const balBg = isDue ? COLORS.dangerBg : isCredit ? COLORS.successBg : COLORS.altRow;
  [balLabelCell, balValCell].forEach(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: balBg } };
    c.border = {
      top: { style: 'thin', color: { argb: COLORS.rowBorder } },
      bottom: { style: 'thin', color: { argb: COLORS.rowBorder } },
      left: { style: 'thin', color: { argb: COLORS.rowBorder } },
      right: { style: 'thin', color: { argb: COLORS.rowBorder } },
    };
  });
  summarySheet.getRow(r).height = 28;
  r += 3;

  // Watermark
  summarySheet.mergeCells(`B${r}:C${r}`);
  const wmCell = summarySheet.getCell(`B${r}`);
  wmCell.value = `Family Milk Account • ${todayStr}`;
  wmCell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF94A3B8' } };
  wmCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // ================================================================
  // SHEET 2: MILK RECORDS (the main data table)
  // ================================================================
  const recordsSheet = workbook.addWorksheet(t('milkRecords', lang), {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  recordsSheet.columns = [
    { key: 'serial', width: 6 },
    { key: 'date', width: 14 },
    { key: 'quantity', width: 14 },
    { key: 'rate', width: 13 },
    { key: 'amount', width: 14 },
    { key: 'status', width: 14 },
    { key: 'notes', width: 26 },
  ];

  // Header row (row 1)
  const milkHeaders = [
    t('serial', lang),
    t('date', lang),
    t('quantity', lang),
    t('rate', lang),
    t('amount', lang),
    t('status', lang),
    t('notes', lang),
  ];

  const milkHeaderRow = recordsSheet.getRow(1);
  milkHeaderRow.height = 26;
  milkHeaders.forEach((header, idx) => {
    const cell = milkHeaderRow.getCell(idx + 1);
    cell.value = header;
    applyHeaderStyle(cell);
    if (idx >= 2 && idx <= 4) {
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    }
  });

  // AutoFilter across all columns
  recordsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 7 },
  };

  // Data rows
  let computedChargesPaise = 0;
  let computedTotalMl = 0;

  sorted.forEach((entry, idx) => {
    const rowNum = idx + 2;
    const row = recordsSheet.getRow(rowNum);
    row.height = 21;

    const isNoMilk = entry.quantityMl === 0;
    const qtyLitres = mlToL(entry.quantityMl);
    const rateRupees = paiseToRupees(entry.ratePaisePerLitre);
    const amountRupees = paiseToRupees(entry.totalAmountPaise);
    const formattedDate = formatKolkataDate(entry.date);
    const isAlt = idx % 2 === 1;

    computedChargesPaise += entry.totalAmountPaise;
    computedTotalMl += entry.quantityMl;

    let statusText: string;
    let statusColor: string;
    if (isNoMilk) {
      statusText = t('noMilk', lang);
      statusColor = COLORS.muted;
    } else if (entry.paymentStatus === 'paid') {
      statusText = t('paid', lang);
      statusColor = COLORS.success;
    } else if (entry.paymentStatus === 'partially_paid') {
      statusText = t('partial', lang);
      statusColor = 'FFB45309';
    } else {
      statusText = t('pending', lang);
      statusColor = COLORS.danger;
    }

    const noteText = entry.notes || (isNoMilk ? t('noMilk', lang) : (entry.isCorrected ? 'Corrected' : ''));

    // Serial
    const c1 = row.getCell(1);
    c1.value = idx + 1;
    c1.font = { name: 'Calibri', size: 10, color: { argb: COLORS.muted } };
    c1.alignment = { vertical: 'middle', horizontal: 'center' };

    // Date
    const c2 = row.getCell(2);
    c2.value = formattedDate;
    c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isNoMilk ? COLORS.danger : COLORS.dark } };
    c2.alignment = { vertical: 'middle', horizontal: 'center' };

    // Quantity (numeric)
    const c3 = row.getCell(3);
    c3.value = qtyLitres;
    c3.numFmt = '0.00';
    c3.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isNoMilk ? COLORS.danger : COLORS.dark } };
    c3.alignment = { vertical: 'middle', horizontal: 'right' };

    // Rate/L (numeric)
    const c4 = row.getCell(4);
    c4.value = rateRupees;
    c4.numFmt = '#,##0.00';
    c4.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
    c4.alignment = { vertical: 'middle', horizontal: 'right' };

    // Amount (numeric)
    const c5 = row.getCell(5);
    c5.value = amountRupees;
    c5.numFmt = '#,##0.00';
    c5.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isNoMilk ? COLORS.muted : COLORS.dark } };
    c5.alignment = { vertical: 'middle', horizontal: 'right' };

    // Status
    const c6 = row.getCell(6);
    c6.value = statusText;
    c6.font = { name: 'Calibri', size: 10, bold: true, color: { argb: statusColor } };
    c6.alignment = { vertical: 'middle', horizontal: 'center' };

    // Notes
    const c7 = row.getCell(7);
    c7.value = noteText;
    c7.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
    c7.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Row background & borders
    const rowBg = isAlt ? COLORS.altRow : COLORS.white;
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      applyDataCellBorder(cell);
    }
  });

  // Totals row
  if (sorted.length > 0) {
    const totalRowNum = sorted.length + 2;
    const totalRow = recordsSheet.getRow(totalRowNum);
    totalRow.height = 26;

    const tFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLORS.dark } };

    const tc1 = totalRow.getCell(1);
    tc1.value = '';

    const tc2 = totalRow.getCell(2);
    tc2.value = t('total', lang);
    tc2.font = tFont;
    tc2.alignment = { vertical: 'middle', horizontal: 'center' };

    const tc3 = totalRow.getCell(3);
    tc3.value = mlToL(computedTotalMl);
    tc3.numFmt = '0.00';
    tc3.font = { ...tFont, color: { argb: COLORS.primary } };
    tc3.alignment = { vertical: 'middle', horizontal: 'right' };

    const tc4 = totalRow.getCell(4);
    tc4.value = '';

    const tc5 = totalRow.getCell(5);
    tc5.value = paiseToRupees(computedChargesPaise);
    tc5.numFmt = '#,##0.00';
    tc5.font = { ...tFont, color: { argb: COLORS.danger } };
    tc5.alignment = { vertical: 'middle', horizontal: 'right' };

    const tc6 = totalRow.getCell(6);
    tc6.value = `${t('due', lang)}: ${formatPaise(Math.abs(summary.closingBalancePaise))}`;
    tc6.font = { ...tFont, color: { argb: isDue ? COLORS.danger : COLORS.success } };
    tc6.alignment = { vertical: 'middle', horizontal: 'center' };

    const tc7 = totalRow.getCell(7);
    tc7.value = `${summary.purchaseDays} ${lang === 'ta' ? 'நாட்கள்' : lang === 'ml' ? 'ദിവസങ്ങൾ' : 'days'}`;
    tc7.font = { name: 'Calibri', size: 9.5, color: { argb: COLORS.muted } };
    tc7.alignment = { vertical: 'middle', horizontal: 'left' };

    for (let c = 1; c <= 7; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
      cell.border = {
        top: { style: 'medium', color: { argb: COLORS.headerBorder } },
        bottom: { style: 'medium', color: { argb: COLORS.headerBorder } },
        left: { style: 'thin', color: { argb: COLORS.rowBorder } },
        right: { style: 'thin', color: { argb: COLORS.rowBorder } },
      };
    }
  }

  // ================================================================
  // SHEET 3: PAYMENTS
  // ================================================================
  const sortedPayments = payments ? [...payments].sort((a, b) => a.date.localeCompare(b.date)) : [];

  const paymentsSheet = workbook.addWorksheet(t('payments', lang), {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  paymentsSheet.columns = [
    { key: 'serial', width: 6 },
    { key: 'date', width: 14 },
    { key: 'amount', width: 16 },
    { key: 'method', width: 16 },
    { key: 'notes', width: 34 },
  ];

  // Header row
  const payHeaders = [
    t('serial', lang),
    t('paymentDate', lang),
    t('paymentAmount', lang),
    t('paymentMethod', lang),
    t('paymentNotes', lang),
  ];

  const payHeaderRow = paymentsSheet.getRow(1);
  payHeaderRow.height = 26;
  payHeaders.forEach((header, idx) => {
    const cell = payHeaderRow.getCell(idx + 1);
    cell.value = header;
    applyHeaderStyle(cell);
    if (idx === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    }
  });

  paymentsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 5 },
  };

  if (sortedPayments.length === 0) {
    const emptyRow = paymentsSheet.getRow(2);
    paymentsSheet.mergeCells('A2:E2');
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = t('noPayments', lang);
    emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.muted } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyRow.height = 24;
  } else {
    let paymentsTotalPaise = 0;

    sortedPayments.forEach((payment, idx) => {
      const rowNum = idx + 2;
      const row = paymentsSheet.getRow(rowNum);
      row.height = 21;
      const isAlt = idx % 2 === 1;

      const amountRupees = paiseToRupees(payment.amountPaise);
      paymentsTotalPaise += payment.amountPaise;

      const pc1 = row.getCell(1);
      pc1.value = idx + 1;
      pc1.font = { name: 'Calibri', size: 10, color: { argb: COLORS.muted } };
      pc1.alignment = { vertical: 'middle', horizontal: 'center' };

      const pc2 = row.getCell(2);
      pc2.value = formatKolkataDate(payment.date);
      pc2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.dark } };
      pc2.alignment = { vertical: 'middle', horizontal: 'center' };

      const pc3 = row.getCell(3);
      pc3.value = amountRupees;
      pc3.numFmt = '#,##0.00';
      pc3.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.success } };
      pc3.alignment = { vertical: 'middle', horizontal: 'right' };

      const pc4 = row.getCell(4);
      pc4.value = getPaymentMethodLabel(payment.paymentMethod, lang);
      pc4.font = { name: 'Calibri', size: 10, color: { argb: COLORS.dark } };
      pc4.alignment = { vertical: 'middle', horizontal: 'center' };

      const pc5 = row.getCell(5);
      pc5.value = payment.notes || '';
      pc5.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
      pc5.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      const rowBg = isAlt ? COLORS.altRow : COLORS.white;
      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        applyDataCellBorder(cell);
      }
    });

    // Payments total row
    const pTotalRowNum = sortedPayments.length + 2;
    const pTotalRow = paymentsSheet.getRow(pTotalRowNum);
    pTotalRow.height = 26;

    pTotalRow.getCell(1).value = '';
    pTotalRow.getCell(2).value = t('total', lang);
    pTotalRow.getCell(2).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLORS.dark } };
    pTotalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

    pTotalRow.getCell(3).value = paiseToRupees(paymentsTotalPaise);
    pTotalRow.getCell(3).numFmt = '#,##0.00';
    pTotalRow.getCell(3).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLORS.success } };
    pTotalRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    pTotalRow.getCell(4).value = '';
    pTotalRow.getCell(5).value = '';

    for (let c = 1; c <= 5; c++) {
      const cell = pTotalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
      cell.border = {
        top: { style: 'medium', color: { argb: COLORS.headerBorder } },
        bottom: { style: 'medium', color: { argb: COLORS.headerBorder } },
        left: { style: 'thin', color: { argb: COLORS.rowBorder } },
        right: { style: 'thin', color: { argb: COLORS.rowBorder } },
      };
    }
  }

  // ================================================================
  // GENERATE BLOB
  // ================================================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const sanitizedFamily = familyName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Family_Milk_Statement_${yearMonth}_${sanitizedFamily}.xlsx`;

  return { workbook, blob, filename };
}

/**
 * Captures the HTML bill element and returns a high-resolution JPG image Blob.
 */
export async function captureBillCardAsJpg(
  element: HTMLElement,
  filename: string
): Promise<{ blob: Blob; filename: string }> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: 0,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve({ blob, filename });
      } else {
        reject(new Error('Failed to generate image blob'));
      }
    }, 'image/jpeg', 0.95);
  });
}

/**
 * Triggers browser download for a generated Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Shares Excel file with native share sheet (WhatsApp / file picker) if supported,
 * or triggers instant download + WhatsApp Web fallback.
 */
export async function shareExcelWithAppa(
  blob: Blob,
  filename: string,
  shareText: string
): Promise<{ success: boolean; mode: 'native_file' | 'download_and_whatsapp' }> {
  try {
    const file = new File([blob], filename, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        text: shareText
      });
      return { success: true, mode: 'native_file' };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: true, mode: 'native_file' };
    }
    console.warn('Native share failed or unsupported, using fallback:', err);
  }

  downloadBlob(blob, filename);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
  return { success: true, mode: 'download_and_whatsapp' };
}

/**
 * Shares JPG image file with native share sheet (WhatsApp / file picker).
 */
export async function shareJpgWithAppa(
  blob: Blob,
  filename: string,
  shareText: string
): Promise<{ success: boolean; mode: 'native_file' | 'download_and_whatsapp' }> {
  try {
    const file = new File([blob], filename, {
      type: 'image/jpeg'
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        text: shareText
      });
      return { success: true, mode: 'native_file' };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: true, mode: 'native_file' };
    }
    console.warn('Native JPG share failed or unsupported, using fallback:', err);
  }

  downloadBlob(blob, filename);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
  return { success: true, mode: 'download_and_whatsapp' };
}
