import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { MilkEntry, DashboardSummary } from '@family-milk/shared';

export interface MilkBillExportData {
  familyName: string;
  yearMonth: string;
  entries: MilkEntry[];
  summary: DashboardSummary;
  lang?: 'ta' | 'ml' | 'en';
}

/**
 * Formats ISO timestamps or raw date strings into clean DD-MM-YYYY in Asia/Kolkata timezone.
 * Example: '2026-10-10T18:30:00.000Z' -> '11-10-2026'
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

/**
 * Builds a professionally formatted, highly attractive Excel spreadsheet (.xlsx) using ExcelJS.
 * Exactly mirrors the on-screen card design from Photo 2:
 * 1. Top Header Banner & Record Count
 * 2. 4 Colored Summary Metric Cards (Total Milk, Total Bill, Total Paid, Balance Due)
 * 3. Excel Green Ribbon Bar
 * 4. Daily Accounting Table with clean DD-MM-YYYY dates and status badges
 * 5. Highlighted Sticky Totals Summary Row
 */
export async function generateMilkBillWorkbook(data: MilkBillExportData): Promise<{
  workbook: ExcelJS.Workbook;
  blob: Blob;
  filename: string;
}> {
  const { familyName, yearMonth, entries, summary, lang = 'ta' } = data;

  const [year, month] = yearMonth.split('-');
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesTa = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
  const monthNamesMl = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
  const mIndex = parseInt(month, 10) - 1;

  const monthLabel = lang === 'ml'
    ? `${year} ${monthNamesMl[mIndex] || month}`
    : lang === 'ta'
    ? `${year} ${monthNamesTa[mIndex] || month}`
    : `${monthNamesEn[mIndex] || month} ${year}`;

  const todayStr = formatKolkataDate(new Date().toISOString());
  const ratePerLitre = (summary.currentRatePaisePerLitre / 100).toFixed(2);
  const totalBillStr = `₹${(summary.totalMilkChargesPaise / 100).toFixed(2)}`;
  const totalPaidStr = `₹${(summary.totalPaymentsPaise / 100).toFixed(2)}`;
  const balanceStr = `₹${(Math.abs(summary.closingBalancePaise) / 100).toFixed(2)}`;
  const isDue = (summary.closingBalancePaise || 0) > 0;
  const isCredit = (summary.closingBalancePaise || 0) < 0;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Family Milk Account';
  workbook.lastModifiedBy = familyName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet(`Milk_${yearMonth}`, {
    views: [{ showGridLines: true }]
  });

  // Set column widths matching table and cards
  sheet.columns = [
    { key: 'colA', width: 7 },   // #
    { key: 'colB', width: 16 },  // Date
    { key: 'colC', width: 15 },  // Quantity
    { key: 'colD', width: 15 },  // Rate/L
    { key: 'colE', width: 16 },  // Amount
    { key: 'colF', width: 22 },  // Status
    { key: 'colG', width: 14 },  // Notes Part 1
    { key: 'colH', width: 14 },  // Notes Part 2
  ];

  // Row 1: Spacer
  sheet.addRow([]);
  sheet.getRow(1).height = 10;

  // Row 2: Title & Family Header
  const titleRow = sheet.getRow(2);
  titleRow.height = 28;
  sheet.mergeCells('A2:E2');
  const titleCell = sheet.getCell('A2');
  titleCell.value = familyName;
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  sheet.mergeCells('F2:H2');
  const badgeCell = sheet.getCell('F2');
  badgeCell.value = `${monthLabel} • ${entries.length} ${lang === 'ta' ? 'நாட்கள் பதிவு' : lang === 'ml' ? 'രേഖകൾ' : 'Records'}`;
  badgeCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF059669' } };
  badgeCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // Row 3: Subtitle
  const subRow = sheet.getRow(3);
  subRow.height = 20;
  sheet.mergeCells('A3:H3');
  const subCell = sheet.getCell('A3');
  subCell.value = lang === 'ta'
    ? `மாதாந்திர பால் பில் அறிக்கை • உருவாக்கப்பட்ட தேதி: ${todayStr} • பால் விலை: ₹${ratePerLitre}/L`
    : lang === 'ml'
    ? `പ്രതിമാസ പാൽ ബിൽ സ്റ്റേറ്റ്മെന്റ് • തയ്യാറാക്കിയത്: ${todayStr} • പാൽ വില: ₹${ratePerLitre}/L`
    : `Monthly Milk Bill Statement • Generated: ${todayStr} • Milk Rate: ₹${ratePerLitre}/L`;
  subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 4: Spacer
  sheet.addRow([]);
  sheet.getRow(4).height = 10;

  // Helper to style each of the 4 cards
  function styleCard(
    cStart: string,
    cEnd: string,
    bgArgb: string,
    borderArgb: string,
    titleText: string,
    titleColorArgb: string,
    valText: string,
    valColorArgb: string,
    subText: string,
    subColorArgb: string
  ) {
    // Title row (Row 5)
    sheet.mergeCells(`${cStart}5:${cEnd}5`);
    const tCell = sheet.getCell(`${cStart}5`);
    tCell.value = titleText;
    tCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: titleColorArgb } };
    tCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Big Value row (Row 6)
    sheet.mergeCells(`${cStart}6:${cEnd}6`);
    const vCell = sheet.getCell(`${cStart}6`);
    vCell.value = valText;
    vCell.font = { name: 'Segoe UI', size: 17, bold: true, color: { argb: valColorArgb } };
    vCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Subtitle row (Row 7)
    sheet.mergeCells(`${cStart}7:${cEnd}7`);
    const sCell = sheet.getCell(`${cStart}7`);
    sCell.value = subText;
    sCell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: subColorArgb } };
    sCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const colStartIdx = sheet.getColumn(cStart).number;
    const colEndIdx = sheet.getColumn(cEnd).number;

    for (let r = 5; r <= 7; r++) {
      for (let c = colStartIdx; c <= colEndIdx; c++) {
        const cell = sheet.getRow(r).getCell(c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgArgb }
        };
        cell.border = {
          top: r === 5 ? { style: 'thin', color: { argb: borderArgb } } : undefined,
          bottom: r === 7 ? { style: 'thin', color: { argb: borderArgb } } : undefined,
          left: c === colStartIdx ? { style: 'thin', color: { argb: borderArgb } } : undefined,
          right: c === colEndIdx ? { style: 'thin', color: { argb: borderArgb } } : undefined,
        };
      }
    }
  }

  sheet.getRow(5).height = 20;
  sheet.getRow(6).height = 28;
  sheet.getRow(7).height = 20;

  // 1. Total Milk Card (Blue theme)
  const milkCardTitle = lang === 'ta' ? 'மொத்த பால் (Total Milk)' : lang === 'ml' ? 'ആകെ പാൽ (Total Milk)' : 'Total Milk';
  const milkCardSub = `${summary.purchaseDays} ${lang === 'ta' ? 'நாட்கள்' : lang === 'ml' ? 'ദിവസങ്ങൾ' : 'days'}`;
  styleCard(
    'A', 'B',
    'FFEFF6FF', 'FFBFDBFE',
    milkCardTitle, 'FF1E40AF',
    `${summary.totalLitres} L`, 'FF1E3A8A',
    milkCardSub, 'FF3B82F6'
  );

  // 2. Total Bill Card (Red theme)
  const billCardTitle = lang === 'ta' ? 'மொத்த கட்டணம் (Total Bill)' : lang === 'ml' ? 'ആകെ തുക (Total Bill)' : 'Total Bill';
  styleCard(
    'C', 'D',
    'FFFEF2F2', 'FFFECACA',
    billCardTitle, 'FF991B1B',
    totalBillStr, 'FFB91C1C',
    `@ ₹${ratePerLitre}/L`, 'FFEF4444'
  );

  // 3. Total Paid Card (Green theme)
  const paidCardTitle = lang === 'ta' ? 'கொடுத்தது (Total Paid)' : lang === 'ml' ? 'നൽകിയത് (Total Paid)' : 'Total Paid';
  const paidCardSub = lang === 'ta' ? 'செலுத்தியது' : lang === 'ml' ? 'ഇതുവരെ നൽകിയത്' : 'Payments received';
  styleCard(
    'E', 'F',
    'FFF0FDF4', 'FFBBF7D0',
    paidCardTitle, 'FF166534',
    totalPaidStr, 'FF15803D',
    paidCardSub, 'FF22C55E'
  );

  // 4. Balance Due Card (Rose theme with highlighted border)
  const dueCardTitle = isDue
    ? (lang === 'ta' ? '🔴 பாக்கி தொகை (Balance Due)' : lang === 'ml' ? '🔴 കുടിശ്ശിക (Balance Due)' : '🔴 Balance Due')
    : isCredit
    ? (lang === 'ta' ? '🟢 முன்பணம் (Advance Credit)' : '🟢 Advance Credit')
    : (lang === 'ta' ? '✅ பாக்கி இல்லை (Nil Due)' : '✅ All Settled');

  const dueCardSub = isDue
    ? (lang === 'ta' ? 'அப்பா தர வேண்டியது' : lang === 'ml' ? 'കൊടുക്കാനുള്ളത്' : 'To be settled')
    : isCredit
    ? (lang === 'ta' ? 'முன்பணம் உள்ளது' : 'Advance balance')
    : 'All settled';

  const dueBg = isDue ? 'FFFFF1F2' : isCredit ? 'FFF0FDF4' : 'FFF8FAFC';
  const dueBorder = isDue ? 'FFF43F5E' : isCredit ? 'FF22C55E' : 'FFCBD5E1';
  const dueTextColor = isDue ? 'FFE11D48' : isCredit ? 'FF16A34A' : 'FF0F172A';

  styleCard(
    'G', 'H',
    dueBg, dueBorder,
    dueCardTitle, dueTextColor,
    balanceStr, dueTextColor,
    dueCardSub, dueTextColor
  );

  // Row 8: Spacer
  sheet.addRow([]);
  sheet.getRow(8).height = 10;

  // Row 9: Excel Green Top Ribbon (as in Photo 2)
  sheet.mergeCells('A9:F9');
  const ribbonLeft = sheet.getCell('A9');
  ribbonLeft.value = `📄 ${familyName} — ${yearMonth}.xlsx`;
  ribbonLeft.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  ribbonLeft.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.mergeCells('G9:H9');
  const ribbonRight = sheet.getCell('G9');
  ribbonRight.value = `${entries.length} ${lang === 'ta' ? 'பதிவுகள்' : lang === 'ml' ? 'രേഖകൾ' : 'records'}`;
  ribbonRight.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ribbonRight.alignment = { vertical: 'middle', horizontal: 'center' };

  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getRow(9).getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF107C41' } // Excel Forest Green
    };
  }
  sheet.getRow(9).height = 26;

  // Row 10: Table Column Headers (Matching Photo 2)
  const headerRow = sheet.getRow(10);
  headerRow.height = 24;

  const colHeaders = [
    { col: 'A', text: '#', align: 'center' as const },
    { col: 'B', text: lang === 'ta' ? 'தேதி (Date)' : lang === 'ml' ? 'തീയതി (Date)' : 'Date', align: 'center' as const },
    { col: 'C', text: lang === 'ta' ? 'அளவு (Quantity)' : lang === 'ml' ? 'അളവ് (Quantity)' : 'Quantity', align: 'right' as const },
    { col: 'D', text: lang === 'ta' ? 'விலை/லி (Rate/L)' : lang === 'ml' ? 'വില/ലി (Rate/L)' : 'Rate/L', align: 'right' as const },
    { col: 'E', text: lang === 'ta' ? 'தொகை (Amount)' : lang === 'ml' ? 'തുക (Amount)' : 'Amount', align: 'right' as const },
    { col: 'F', text: lang === 'ta' ? 'நிலை (Status)' : lang === 'ml' ? 'നില (Status)' : 'Status', align: 'center' as const },
  ];

  colHeaders.forEach(h => {
    const cell = sheet.getCell(`${h.col}10`);
    cell.value = h.text;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', horizontal: h.align };
  });

  sheet.mergeCells('G10:H10');
  const noteHeader = sheet.getCell('G10');
  noteHeader.value = lang === 'ta' ? 'குறிப்பு (Notes)' : lang === 'ml' ? 'കുറിപ്പ് (Notes)' : 'Notes';
  noteHeader.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF334155' } };
  noteHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  for (let c = 1; c <= 8; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' } // Light slate header
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  }

  // Sort entries chronologically
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  let currentR = 11;
  sorted.forEach((entry, idx) => {
    const row = sheet.getRow(currentR);
    row.height = 22;

    const isNoMilk = entry.quantityMl === 0;
    const formattedDate = formatKolkataDate(entry.date);
    const qtyL = isNoMilk
      ? (lang === 'ta' ? '0 L (வாங்கவில்லை)' : lang === 'ml' ? '0 L (വാങ്ങിയില്ല)' : '0 L (No Milk)')
      : `${(entry.quantityMl / 1000).toFixed(2)} L`;
    const rate = isNoMilk ? '₹0.00' : `₹${(entry.ratePaisePerLitre / 100).toFixed(2)}`;
    const amount = `₹${(entry.totalAmountPaise / 100).toFixed(2)}`;

    const isPaid = entry.paymentStatus === 'paid';
    const rowBg = isNoMilk ? 'FFF8FAFC' : isPaid ? 'FFF0FDF4' : 'FFFEF2F2';

    // Cell values
    sheet.getCell(`A${currentR}`).value = idx + 1;
    sheet.getCell(`A${currentR}`).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell(`A${currentR}`).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF64748B' } };

    sheet.getCell(`B${currentR}`).value = formattedDate;
    sheet.getCell(`B${currentR}`).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell(`B${currentR}`).font = { name: 'Segoe UI', size: 10, bold: true, color: isNoMilk ? { argb: 'FFDC2626' } : { argb: 'FF0F172A' } };

    sheet.getCell(`C${currentR}`).value = qtyL;
    sheet.getCell(`C${currentR}`).alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell(`C${currentR}`).font = { name: 'Segoe UI', size: 10, bold: true, color: isNoMilk ? { argb: 'FFDC2626' } : { argb: 'FF0F172A' } };

    sheet.getCell(`D${currentR}`).value = rate;
    sheet.getCell(`D${currentR}`).alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell(`D${currentR}`).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF475569' } };

    sheet.getCell(`E${currentR}`).value = amount;
    sheet.getCell(`E${currentR}`).alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell(`E${currentR}`).font = { name: 'Segoe UI', size: 10, bold: true, color: isNoMilk ? { argb: 'FF64748B' } : { argb: 'FF0F172A' } };

    // Status chip badge
    let statusLabel = '⏳ Pay Later (பாக்கி)';
    let statusTextColor = 'FFB91C1C';
    let statusBgColor = 'FFFEE2E2';

    if (isNoMilk) {
      statusLabel = lang === 'ta' ? '🚫 வாங்கவில்லை (Skipped)' : lang === 'ml' ? '🚫 വാങ്ങിയില്ല (Skipped)' : '🚫 No Milk (Skipped)';
      statusTextColor = 'FF64748B';
      statusBgColor = 'FFF1F5F9';
    } else if (isPaid) {
      statusLabel = '✓ Paid (செலுத்தியது)';
      statusTextColor = 'FF15803D';
      statusBgColor = 'FFDCFCE7';
    } else if (entry.paymentStatus === 'partially_paid') {
      statusLabel = 'Partial (பகுதி)';
      statusTextColor = 'FFB45309';
      statusBgColor = 'FFFEF3C7';
    }

    const statusCell = sheet.getCell(`F${currentR}`);
    statusCell.value = statusLabel;
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    statusCell.font = {
      name: 'Segoe UI',
      size: 9.5,
      bold: true,
      color: { argb: statusTextColor }
    };
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: statusBgColor }
    };

    // Notes
    sheet.mergeCells(`G${currentR}:H${currentR}`);
    const noteCell = sheet.getCell(`G${currentR}`);
    const defaultNote = isNoMilk
      ? (lang === 'ta' ? 'பால் வாங்கவில்லை' : lang === 'ml' ? 'പാൽ വാങ്ങിയില്ല' : 'No Milk Taken')
      : (entry.isCorrected ? 'Corrected' : '-');
    noteCell.value = entry.notes || defaultNote;
    noteCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    noteCell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF475569' } };

    // Borders & row background for other cells
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      if (c !== 6) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBg }
        };
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }

    currentR++;
  });

  // Sticky Totals Row (Matching Photo 2 footer)
  const totalRow = sheet.getRow(currentR);
  totalRow.height = 26;

  sheet.mergeCells(`A${currentR}:B${currentR}`);
  const totalQtyCell = sheet.getCell(`A${currentR}`);
  totalQtyCell.value = `${lang === 'ta' ? 'மொத்தம்:' : lang === 'ml' ? 'ആകെ:' : 'Total:'} ${summary.totalLitres} L (${summary.purchaseDays} ${lang === 'ta' ? 'நாட்கள்' : 'days'})`;
  totalQtyCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  totalQtyCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.mergeCells(`C${currentR}:E${currentR}`);
  const totalChargesCell = sheet.getCell(`C${currentR}`);
  totalChargesCell.value = `${lang === 'ta' ? 'கட்டணம்:' : lang === 'ml' ? 'തുക:' : 'Charges:'} ${totalBillStr}   |   ${lang === 'ta' ? 'கொடுத்தது:' : 'Paid:'} ${totalPaidStr}`;
  totalChargesCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  totalChargesCell.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.mergeCells(`F${currentR}:H${currentR}`);
  const totalDueCell = sheet.getCell(`F${currentR}`);
  totalDueCell.value = `${lang === 'ta' ? 'பாக்கி:' : lang === 'ml' ? 'കുടിശ്ശിക:' : 'Due:'} ${balanceStr}`;
  totalDueCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: isDue ? 'FFDC2626' : 'FF16A34A' } };
  totalDueCell.alignment = { vertical: 'middle', horizontal: 'center' };

  for (let c = 1; c <= 8; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } }
    };
  }

  currentR++;

  // Watermark Row
  sheet.addRow([]);
  currentR++;
  sheet.mergeCells(`A${currentR}:H${currentR}`);
  const wmCell = sheet.getCell(`A${currentR}`);
  wmCell.value = `Family Milk Account • ${todayStr}`;
  wmCell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF94A3B8' } };
  wmCell.alignment = { vertical: 'middle', horizontal: 'right' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const sanitizedFamily = familyName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Milk_Bill_${yearMonth}_${sanitizedFamily}.xlsx`;

  return {
    workbook,
    blob,
    filename
  };
}

/**
 * Captures the HTML bill element and returns a high-resolution JPG image Blob.
 */
export async function captureBillCardAsJpg(
  element: HTMLElement,
  filename: string
): Promise<{ blob: Blob; filename: string }> {
  const canvas = await html2canvas(element, {
    scale: 2, // High resolution retina capture
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

  // Fallback: download the file and launch WhatsApp with the text summary
  downloadBlob(blob, filename);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
  return { success: true, mode: 'download_and_whatsapp' };
}

/**
 * Shares JPG image file with native share sheet (WhatsApp / file picker) so Appa can see the photo directly inside chat.
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

  // Fallback: download the JPG file and launch WhatsApp
  downloadBlob(blob, filename);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
  return { success: true, mode: 'download_and_whatsapp' };
}
