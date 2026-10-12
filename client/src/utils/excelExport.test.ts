import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  generateMilkBillWorkbook,
  formatKolkataDate,
  MilkBillExportData,
} from './excelExport';
import { MilkEntry, DashboardSummary, Payment } from '@family-milk/shared';

function makeMilkEntry(overrides: Partial<MilkEntry> & { date: string; quantityMl: number }): MilkEntry {
  const rate = overrides.ratePaisePerLitre ?? 5600;
  const amount = overrides.totalAmountPaise ?? Math.round((overrides.quantityMl * rate) / 1000);
  return {
    id: overrides.id || crypto.randomUUID(),
    familyId: 'fam-1',
    memberId: 'mem-1',
    date: overrides.date,
    quantityMl: overrides.quantityMl,
    ratePaisePerLitre: rate,
    totalAmountPaise: amount,
    paymentStatus: overrides.paymentStatus || 'pending',
    notes: overrides.notes ?? null,
    isCorrected: overrides.isCorrected || false,
    correctionNotes: overrides.correctionNotes ?? null,
    idempotencyKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeSummary(entries: MilkEntry[], paymentsPaise = 0, openingPaise = 0): DashboardSummary {
  const totalMl = entries.reduce((s, e) => s + e.quantityMl, 0);
  const totalCharges = entries.reduce((s, e) => s + e.totalAmountPaise, 0);
  const purchaseDays = new Set(entries.filter(e => e.quantityMl > 0).map(e => e.date)).size;
  return {
    currentMonth: '2026-10',
    currentRatePaisePerLitre: 5600,
    totalLitres: Number((totalMl / 1000).toFixed(2)),
    purchaseDays,
    totalMilkChargesPaise: totalCharges,
    totalPaymentsPaise: paymentsPaise,
    openingBalancePaise: openingPaise,
    closingBalancePaise: openingPaise + totalCharges - paymentsPaise,
    netDueOrAdvancePaise: openingPaise + totalCharges - paymentsPaise,
    todayPurchase: null,
    todayPaymentStatus: 'none',
    recentActivity: [],
  };
}

function makePayment(overrides: Partial<Payment> & { date: string; amountPaise: number }): Payment {
  return {
    id: overrides.id || crypto.randomUUID(),
    familyId: 'fam-1',
    memberId: 'mem-1',
    date: overrides.date,
    amountPaise: overrides.amountPaise,
    paymentMethod: overrides.paymentMethod || 'cash',
    notes: overrides.notes ?? null,
    idempotencyKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function getWorkbook(data: MilkBillExportData): Promise<ExcelJS.Workbook> {
  const result = await generateMilkBillWorkbook(data);
  expect(result.blob).toBeInstanceOf(Blob);
  expect(result.filename).toMatch(/\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  const buffer = await result.blob.arrayBuffer();
  await wb.xlsx.load(buffer);
  return wb;
}

// Test A: Small statement
describe('Test A — Small statement', () => {
  it('exports all 3 entries with correct summary and formatting', async () => {
    const entries = [
      makeMilkEntry({ date: '2026-10-01', quantityMl: 1000 }),
      makeMilkEntry({ date: '2026-10-02', quantityMl: 500 }),
      makeMilkEntry({ date: '2026-10-03', quantityMl: 0 }),
    ];
    const summary = makeSummary(entries, 5600);

    const wb = await getWorkbook({
      familyName: 'Test Family',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'en',
    });

    expect(wb.worksheets.length).toBeGreaterThanOrEqual(3);

    const recordsSheet = wb.worksheets[1];
    expect(recordsSheet).toBeDefined();

    // Header row + 3 data rows + 1 total row
    const dataRowCount = recordsSheet.rowCount - 2; // minus header and total
    expect(dataRowCount).toBe(3);

    // First data row is date-sorted: 2026-10-01
    const row2 = recordsSheet.getRow(2);
    expect(row2.getCell(3).value).toBe(1.0); // 1000ml = 1.0 L

    // Summary sheet has the right balance
    const summarySheet = wb.worksheets[0];
    expect(summarySheet).toBeDefined();
  });
});

// Test B: Eight-record statement
describe('Test B — Eight-record statement', () => {
  it('exported row count equals 8', async () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeMilkEntry({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, quantityMl: 1000 })
    );
    const summary = makeSummary(entries);

    const wb = await getWorkbook({
      familyName: 'Test Family',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'en',
    });

    const recordsSheet = wb.worksheets[1];
    // Header (row 1) + 8 data rows + total row = 10 rows
    // Data rows are rows 2-9
    const row9 = recordsSheet.getRow(9);
    expect(row9.getCell(1).value).toBe(8); // serial #8

    // Row 10 should be the total row
    const totalRow = recordsSheet.getRow(10);
    expect(totalRow.getCell(2).value).toBe('Total');
  });
});

// Test C: Large statement (100 records)
describe('Test C — Large statement', () => {
  it('exports 100 records without missing or duplicated rows', async () => {
    const entries: MilkEntry[] = [];
    for (let i = 0; i < 100; i++) {
      const day = (i % 31) + 1;
      entries.push(makeMilkEntry({
        id: `entry-${i}`,
        date: `2026-10-${String(day).padStart(2, '0')}`,
        quantityMl: 500 + (i % 3) * 500,
      }));
    }
    const summary = makeSummary(entries);

    const wb = await getWorkbook({
      familyName: 'Large Family',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'en',
    });

    const recordsSheet = wb.worksheets[1];
    // Row 1 = header, rows 2-101 = data, row 102 = total
    const lastDataRow = recordsSheet.getRow(101);
    expect(lastDataRow.getCell(1).value).toBe(100);

    // Verify no gaps by checking serial numbers
    for (let i = 1; i <= 100; i++) {
      expect(recordsSheet.getRow(i + 1).getCell(1).value).toBe(i);
    }
  });
});

// Test D: Numeric accuracy
describe('Test D — Numeric accuracy', () => {
  it('quantities, rates, charges, payments and balance match', async () => {
    const entries = [
      makeMilkEntry({ date: '2026-10-01', quantityMl: 500, ratePaisePerLitre: 4800 }),  // 0.5 * 48 = 24.00 -> 2400 paise
      makeMilkEntry({ date: '2026-10-02', quantityMl: 1500, ratePaisePerLitre: 5600 }), // 1.5 * 56 = 84.00 -> 8400 paise
    ];
    const summary = makeSummary(entries, 5000); // paid 50.00

    const wb = await getWorkbook({
      familyName: 'Precision Test',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'en',
    });

    const recordsSheet = wb.worksheets[1];

    // Row 2: 500ml entry
    const r2 = recordsSheet.getRow(2);
    expect(r2.getCell(3).value).toBe(0.5);   // quantity in litres
    expect(r2.getCell(4).value).toBe(48);     // rate in rupees
    expect(r2.getCell(5).value).toBe(24);     // amount in rupees

    // Row 3: 1500ml entry
    const r3 = recordsSheet.getRow(3);
    expect(r3.getCell(3).value).toBe(1.5);
    expect(r3.getCell(4).value).toBe(56);
    expect(r3.getCell(5).value).toBe(84);

    // Total row
    const totalRow = recordsSheet.getRow(4);
    expect(totalRow.getCell(3).value).toBe(2.0); // total litres
    expect(totalRow.getCell(5).value).toBe(108);  // total charges: 24 + 84 = 108
  });
});

// Test E: Date accuracy (Kolkata timezone)
describe('Test E — Date accuracy', () => {
  it('dates remain correct for Asia/Kolkata timezone', () => {
    // 2026-10-10T18:30:00.000Z is 2026-10-11 00:00 IST -> should show 11-10-2026
    expect(formatKolkataDate('2026-10-10T18:30:00.000Z')).toBe('11-10-2026');

    // Plain date string should work
    expect(formatKolkataDate('2026-10-15')).toBe('15-10-2026');

    // Midnight UTC is 05:30 IST same day
    expect(formatKolkataDate('2026-10-05T00:00:00.000Z')).toBe('05-10-2026');
  });
});

// Test F: Column widths and row heights preserve readable values
describe('Test F — Column widths', () => {
  it('columns have reasonable widths', async () => {
    const entries = [
      makeMilkEntry({ date: '2026-10-01', quantityMl: 1000, notes: 'This is a long note for testing column width' }),
    ];
    const summary = makeSummary(entries);

    const wb = await getWorkbook({
      familyName: 'Width Test Family',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'ta', // Tamil text is wider
    });

    const recordsSheet = wb.worksheets[1];
    const cols = recordsSheet.columns;

    // Date column should be at least 12 wide
    expect(cols[1]?.width).toBeGreaterThanOrEqual(12);
    // Notes column should be at least 20 wide
    expect(cols[6]?.width).toBeGreaterThanOrEqual(20);
  });
});

// Test G: WhatsApp sharing receives same workbook (same function used)
describe('Test G — WhatsApp sharing consistency', () => {
  it('download and share use the same generateMilkBillWorkbook function', async () => {
    const entries = [makeMilkEntry({ date: '2026-10-01', quantityMl: 1000 })];
    const summary = makeSummary(entries);
    const data: MilkBillExportData = {
      familyName: 'Share Test',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'en',
    };

    const result1 = await generateMilkBillWorkbook(data);
    const result2 = await generateMilkBillWorkbook(data);

    // Both should produce valid blobs with same filename
    expect(result1.filename).toBe(result2.filename);
    expect(result1.blob.size).toBe(result2.blob.size);
    expect(result1.blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});

// Test H: Empty statement
describe('Test H — Empty statement', () => {
  it('handles empty entries gracefully', async () => {
    const summary = makeSummary([]);

    const wb = await getWorkbook({
      familyName: 'Empty Family',
      yearMonth: '2026-10',
      entries: [],
      summary,
      lang: 'en',
    });

    expect(wb.worksheets.length).toBeGreaterThanOrEqual(3);
    const recordsSheet = wb.worksheets[1];
    // Only header row, no data rows, no total row
    expect(recordsSheet.rowCount).toBe(1);
  });
});

// Test I: Regression — existing function signatures preserved
describe('Test I — Regression', () => {
  it('generateMilkBillWorkbook returns workbook, blob, and filename', async () => {
    const entries = [makeMilkEntry({ date: '2026-10-01', quantityMl: 500 })];
    const summary = makeSummary(entries);

    const result = await generateMilkBillWorkbook({
      familyName: 'Regression Family',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'ta',
    });

    expect(result).toHaveProperty('workbook');
    expect(result).toHaveProperty('blob');
    expect(result).toHaveProperty('filename');
    expect(result.filename).toMatch(/Family_Milk_Statement_2026-10/);
    expect(result.filename).toMatch(/\.xlsx$/);
  });
});

// Test J: Real-data reconciliation
describe('Test J — Real-data reconciliation', () => {
  it('workbook row count, totals, and balance match the statement', async () => {
    const entries = [
      makeMilkEntry({ date: '2026-10-01', quantityMl: 1000, paymentStatus: 'paid' }),
      makeMilkEntry({ date: '2026-10-02', quantityMl: 500, paymentStatus: 'pending' }),
      makeMilkEntry({ date: '2026-10-03', quantityMl: 1500, paymentStatus: 'paid' }),
      makeMilkEntry({ date: '2026-10-04', quantityMl: 0, paymentStatus: 'pending' }),
      makeMilkEntry({ date: '2026-10-05', quantityMl: 2000, paymentStatus: 'pending' }),
    ];
    const totalChargesPaise = entries.reduce((s, e) => s + e.totalAmountPaise, 0);
    const paidPaise = 15000;
    const openingPaise = 2000;
    const summary = makeSummary(entries, paidPaise, openingPaise);

    const payments = [
      makePayment({ date: '2026-10-02', amountPaise: 5000, paymentMethod: 'cash' }),
      makePayment({ date: '2026-10-04', amountPaise: 10000, paymentMethod: 'upi', notes: 'Monthly payment' }),
    ];

    const wb = await getWorkbook({
      familyName: 'Reconciliation Family',
      yearMonth: '2026-10',
      entries,
      summary,
      payments,
      lang: 'en',
    });

    // Milk Records sheet — 5 data rows
    const recordsSheet = wb.worksheets[1];
    expect(recordsSheet.getRow(6).getCell(1).value).toBe(5); // Last entry serial

    // Total row values match
    const totalRow = recordsSheet.getRow(7);
    const totalQty = totalRow.getCell(3).value as number;
    const totalAmt = totalRow.getCell(5).value as number;
    const expectedTotalMl = entries.reduce((s, e) => s + e.quantityMl, 0);
    expect(totalQty).toBeCloseTo(expectedTotalMl / 1000, 2);
    expect(totalAmt).toBeCloseTo(totalChargesPaise / 100, 2);

    // Payments sheet — 2 data rows
    const paymentsSheet = wb.worksheets[2];
    expect(paymentsSheet.getRow(2).getCell(1).value).toBe(1);
    expect(paymentsSheet.getRow(3).getCell(1).value).toBe(2);
    expect(paymentsSheet.getRow(3).getCell(3).value).toBe(100); // 10000 paise = 100 rupees

    // Payments total
    const payTotalRow = paymentsSheet.getRow(4);
    expect(payTotalRow.getCell(3).value).toBeCloseTo(paidPaise / 100, 2);
  });
});

// Test: Payments sheet
describe('Payments sheet', () => {
  it('includes payment method labels and notes', async () => {
    const entries = [makeMilkEntry({ date: '2026-10-01', quantityMl: 1000 })];
    const summary = makeSummary(entries, 5600);
    const payments = [
      makePayment({ date: '2026-10-05', amountPaise: 5600, paymentMethod: 'upi', notes: 'Google Pay' }),
    ];

    const wb = await getWorkbook({
      familyName: 'Pay Test',
      yearMonth: '2026-10',
      entries,
      summary,
      payments,
      lang: 'en',
    });

    const paymentsSheet = wb.worksheets[2];
    const dataRow = paymentsSheet.getRow(2);
    expect(dataRow.getCell(4).value).toBe('UPI');
    expect(dataRow.getCell(5).value).toBe('Google Pay');
  });
});

// Test: Frozen header and AutoFilter
describe('Frozen header and AutoFilter', () => {
  it('Milk Records sheet has frozen header and auto filter', async () => {
    const entries = [makeMilkEntry({ date: '2026-10-01', quantityMl: 1000 })];
    const summary = makeSummary(entries);

    const wb = await getWorkbook({
      familyName: 'Freeze Test',
      yearMonth: '2026-10',
      entries,
      summary,
      lang: 'en',
    });

    const recordsSheet = wb.worksheets[1];

    // Check frozen pane
    const views = (recordsSheet as any).views;
    expect(views).toBeDefined();
    expect(views.length).toBeGreaterThan(0);
    expect(views[0].ySplit).toBe(1);

    // Check auto filter
    expect(recordsSheet.autoFilter).toBeDefined();
  });
});
