import { query, withTransaction } from '../../config/db.js';
import {
  DashboardSummary,
  formatPaise,
  formatMilkQuantity,
  Language,
  mlToLitres,
  MonthlyClosure
} from '@family-milk/shared';
import { getPreviousMonth, getTodayDateKolkata, getCurrentMonthKolkata, getMonthDateRange } from '../../utils/timezone.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { getApplicableRate } from '../milk/milk.service.js';

export interface MonthSettlementCalculation {
  yearMonth: string;
  isClosed: boolean;
  closedAt?: string;
  closedByName?: string;
  openingBalancePaise: number;
  totalMilkChargesPaise: number;
  totalPaymentsPaise: number;
  closingBalancePaise: number;
  totalLitres: number;
  purchaseDays: number;
  currentRatePaisePerLitre: number;
}

/**
 * Calculates complete accounting figures for a given month ('YYYY-MM') for a family.
 */
export async function calculateMonthSettlement(
  familyId: string,
  yearMonth: string,
  client?: any
): Promise<MonthSettlementCalculation> {
  const runner = client || { query };

  // 1. Check if an official monthly_closure snapshot already exists
  const closureRes = await runner.query(
    `SELECT mc.*, m.name as "closedByName"
     FROM monthly_closures mc
     LEFT JOIN family_members m ON m.id = mc.closed_by
     WHERE mc.family_id = $1 AND mc.year_month = $2`,
    [familyId, yearMonth]
  );

  const currentRate = await getApplicableRate(familyId, `${yearMonth}-15`, client);

  if (closureRes.rows.length > 0) {
    const c = closureRes.rows[0];
    return {
      yearMonth: c.year_month,
      isClosed: true,
      closedAt: c.closed_at,
      closedByName: c.closedByName,
      openingBalancePaise: c.opening_balance_paise,
      totalMilkChargesPaise: c.total_milk_charges_paise,
      totalPaymentsPaise: c.total_payments_paise,
      closingBalancePaise: c.closing_balance_paise,
      totalLitres: Number(c.total_litres),
      purchaseDays: c.purchase_days,
      currentRatePaisePerLitre: currentRate
    };
  }

  // 2. Not closed: Calculate dynamically.
  // First, determine Opening Balance:
  // If previous month has a closure, its closing_balance_paise is our opening balance.
  // Otherwise, calculate cumulative balance of all months prior to yearMonth.
  const prevMonth = getPreviousMonth(yearMonth);
  const prevClosureRes = await runner.query(
    `SELECT closing_balance_paise
     FROM monthly_closures
     WHERE family_id = $1 AND year_month = $2`,
    [familyId, prevMonth]
  );

  let openingBalancePaise = 0;

  if (prevClosureRes.rows.length > 0) {
    openingBalancePaise = prevClosureRes.rows[0].closing_balance_paise;
  } else {
    // Sum all charges and payments before the 1st of this month
    const firstDayOfMonth = `${yearMonth}-01`;

    const priorChargesRes = await runner.query(
      `SELECT COALESCE(SUM(total_amount_paise), 0) as total
       FROM milk_entries
       WHERE family_id = $1 AND date < $2`,
      [familyId, firstDayOfMonth]
    );

    const priorPaymentsRes = await runner.query(
      `SELECT COALESCE(SUM(amount_paise), 0) as total
       FROM payments
       WHERE family_id = $1 AND date < $2`,
      [familyId, firstDayOfMonth]
    );

    const priorCharges = parseInt(priorChargesRes.rows[0].total, 10);
    const priorPayments = parseInt(priorPaymentsRes.rows[0].total, 10);
    openingBalancePaise = priorCharges - priorPayments;
  }

  // 3. Current month statistics
  const { startDate: monthStart, endDate: monthEnd } = getMonthDateRange(yearMonth);

  const chargesRes = await runner.query(
    `SELECT COALESCE(SUM(total_amount_paise), 0) as "totalCharges",
            COALESCE(SUM(quantity_ml), 0) as "totalMl",
            COUNT(DISTINCT CASE WHEN quantity_ml > 0 THEN date END) as "distinctDays"
     FROM milk_entries
     WHERE family_id = $1 AND date >= $2 AND date <= $3`,
    [familyId, monthStart, monthEnd]
  );

  const paymentsRes = await runner.query(
    `SELECT COALESCE(SUM(amount_paise), 0) as "totalPayments"
     FROM payments
     WHERE family_id = $1 AND date >= $2 AND date <= $3`,
    [familyId, monthStart, monthEnd]
  );

  const totalMilkChargesPaise = parseInt(chargesRes.rows[0].totalCharges, 10);
  const totalMl = parseInt(chargesRes.rows[0].totalMl, 10);
  const purchaseDays = parseInt(chargesRes.rows[0].distinctDays, 10);
  const totalLitres = mlToLitres(totalMl);

  const totalPaymentsPaise = parseInt(paymentsRes.rows[0].totalPayments, 10);

  // Balance Equation: Closing = Opening + Charges - Payments
  const closingBalancePaise = openingBalancePaise + totalMilkChargesPaise - totalPaymentsPaise;

  return {
    yearMonth,
    isClosed: false,
    openingBalancePaise,
    totalMilkChargesPaise,
    totalPaymentsPaise,
    closingBalancePaise,
    totalLitres,
    purchaseDays,
    currentRatePaisePerLitre: currentRate
  };
}

/**
 * Generates the complete dashboard summary for the family.
 */
export async function getDashboardSummary(familyId: string, targetMonth?: string): Promise<DashboardSummary> {
  const month = targetMonth || getCurrentMonthKolkata();
  const today = getTodayDateKolkata();

  const settlement = await calculateMonthSettlement(familyId, month);

  // Today's purchase status
  const todayEntryRes = await query(
    `SELECT me.id, me.family_id as "familyId", me.member_id as "memberId",
            me.date, me.quantity_ml as "quantityMl", me.rate_paise_per_litre as "ratePaisePerLitre",
            me.total_amount_paise as "totalAmountPaise", me.payment_status as "paymentStatus",
            me.notes, me.is_corrected as "isCorrected",
            me.created_at as "createdAt", me.updated_at as "updatedAt",
            m.name as "createdByName"
     FROM milk_entries me
     LEFT JOIN family_members m ON m.id = me.member_id
     WHERE me.family_id = $1 AND me.date = $2
     ORDER BY me.created_at DESC
     LIMIT 1`,
    [familyId, today]
  );

  const todayPurchase = todayEntryRes.rows.length > 0 ? todayEntryRes.rows[0] : null;
  let todayPaymentStatus: 'none' | 'paid' | 'pending' = 'none';

  if (todayPurchase) {
    todayPaymentStatus = todayPurchase.paymentStatus === 'paid' ? 'paid' : 'pending';
  }

  // Recent 10 activities combining purchases and payments
  const recentPurchasesRes = await query(
    `SELECT me.id, 'purchase' as type, me.date, me.total_amount_paise as "amountPaise",
            me.quantity_ml as "quantityMl", me.payment_status as status, me.created_at as "createdAt",
            m.name as "memberName"
     FROM milk_entries me
     LEFT JOIN family_members m ON m.id = me.member_id
     WHERE me.family_id = $1
     ORDER BY me.date DESC, me.created_at DESC
     LIMIT 8`,
    [familyId]
  );

  const recentPaymentsRes = await query(
    `SELECT p.id, 'payment' as type, p.date, p.amount_paise as "amountPaise",
            p.payment_method as status, p.created_at as "createdAt",
            m.name as "memberName"
     FROM payments p
     LEFT JOIN family_members m ON m.id = p.member_id
     WHERE p.family_id = $1
     ORDER BY p.date DESC, p.created_at DESC
     LIMIT 8`,
    [familyId]
  );

  const combinedActivity = [
    ...recentPurchasesRes.rows.map(r => ({
      id: r.id,
      type: 'purchase' as const,
      date: r.date,
      title: `${mlToLitres(r.quantityMl)} L Milk`,
      amountPaise: r.amountPaise,
      quantityMl: r.quantityMl,
      memberName: r.memberName || 'Family Member',
      status: r.status,
      createdAt: r.createdAt
    })),
    ...recentPaymentsRes.rows.map(r => ({
      id: r.id,
      type: 'payment' as const,
      date: r.date,
      title: `Payment (${r.status?.toUpperCase() || 'CASH'})`,
      amountPaise: r.amountPaise,
      memberName: r.memberName || 'Family Member',
      createdAt: r.createdAt
    }))
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return {
    currentMonth: month,
    currentRatePaisePerLitre: settlement.currentRatePaisePerLitre,
    totalLitres: settlement.totalLitres,
    purchaseDays: settlement.purchaseDays,
    totalMilkChargesPaise: settlement.totalMilkChargesPaise,
    totalPaymentsPaise: settlement.totalPaymentsPaise,
    openingBalancePaise: settlement.openingBalancePaise,
    closingBalancePaise: settlement.closingBalancePaise,
    netDueOrAdvancePaise: settlement.closingBalancePaise, // > 0 is due, < 0 is advance
    todayPurchase,
    todayPaymentStatus,
    recentActivity: combinedActivity
  };
}

/**
 * Officially closes a month statement and freezes the figures.
 */
export async function closeMonthStatement(
  familyId: string,
  yearMonth: string,
  closedByMemberId: string,
  notes?: string
): Promise<MonthlyClosure> {
  return await withTransaction(async (client) => {
    // Calculate final figures
    const calc = await calculateMonthSettlement(familyId, yearMonth, client);

    const insertRes = await client.query(
      `INSERT INTO monthly_closures (
        family_id, year_month, opening_balance_paise, total_milk_charges_paise,
        total_payments_paise, closing_balance_paise, total_litres, purchaseDays, notes, closed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (family_id, year_month) DO UPDATE
      SET opening_balance_paise = EXCLUDED.opening_balance_paise,
          total_milk_charges_paise = EXCLUDED.total_milk_charges_paise,
          total_payments_paise = EXCLUDED.total_payments_paise,
          closing_balance_paise = EXCLUDED.closing_balance_paise,
          total_litres = EXCLUDED.total_litres,
          purchaseDays = EXCLUDED.purchaseDays,
          notes = EXCLUDED.notes,
          closed_at = NOW(),
          closed_by = EXCLUDED.closed_by
      RETURNING id, family_id as "familyId", year_month as "yearMonth",
                opening_balance_paise as "openingBalancePaise",
                total_milk_charges_paise as "totalMilkChargesPaise",
                total_payments_paise as "totalPaymentsPaise",
                closing_balance_paise as "closingBalancePaise",
                total_litres as "totalLitres",
                purchase_days as "purchaseDays",
                notes, closed_at as "closedAt", closed_by as "closedBy"`,
      [
        familyId,
        yearMonth,
        calc.openingBalancePaise,
        calc.totalMilkChargesPaise,
        calc.totalPaymentsPaise,
        calc.closingBalancePaise,
        calc.totalLitres,
        calc.purchaseDays,
        notes || null,
        closedByMemberId
      ]
    );

    const closure = insertRes.rows[0];

    await recordAuditLog({
      familyId,
      memberId: closedByMemberId,
      action: 'close_month',
      entityType: 'monthly_closure',
      entityId: closure.id,
      newValues: closure,
      client
    });

    return closure;
  });
}

/**
 * Builds user-shareable WhatsApp text message formatted for English or Malayalam.
 */
export function generateWhatsAppStatementText(
  familyName: string,
  calc: MonthSettlementCalculation,
  lang: Language = 'ml'
): string {
  const [year, month] = calc.yearMonth.split('-');
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesMl = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
  const monthNamesTa = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
  const monthIndex = parseInt(month, 10) - 1;

  const monthLabel = lang === 'ml'
    ? `${year} ${monthNamesMl[monthIndex] || month}`
    : lang === 'ta'
    ? `${year} ${monthNamesTa[monthIndex] || month}`
    : `${monthNamesEn[monthIndex] || month} ${year}`;

  const rateStr = formatPaise(calc.currentRatePaisePerLitre);
  const openingStr = formatPaise(calc.openingBalancePaise);
  const chargesStr = formatPaise(calc.totalMilkChargesPaise);
  const paymentsStr = formatPaise(calc.totalPaymentsPaise);
  const closingStr = formatPaise(Math.abs(calc.closingBalancePaise));

  const isDue = calc.closingBalancePaise > 0;
  const isZero = calc.closingBalancePaise === 0;

  if (lang === 'ta') {
    const statusText = isZero
      ? '✅ *முழுமையாக செலுத்தப்பட்டது (Nil Due)*'
      : isDue
      ? `🔴 *பாக்கி தொகை (Due): ${closingStr}*`
      : `🟢 *முன்பணம் (Advance Credit): ${closingStr}*`;

    return `🥛 *பால் கணக்கு - மாத அறிக்கை*
🏠 *${familyName}*
📅 *மாதம்:* ${monthLabel}
─────────────────
🔹 *பால் வாங்கிய நாட்கள்:* ${calc.purchaseDays} நாட்கள்
🔹 *மொத்த பால்:* ${calc.totalLitres} லிட்டர்
🔹 *லிட்டர் விலை:* ${rateStr}
─────────────────
🔸 *முந்தைய மாத பாக்கி (Opening):* ${openingStr}
🔸 *இந்த மாத பால் கட்டணம்:* ${chargesStr}
🔸 *செலுத்திய மொத்த தொகை (Payments):* ${paymentsStr}
─────────────────
${statusText}
─────────────────
_குடும்ப பால் கணக்கு செயலி மூலம் உருவாக்கப்பட்டது_`;
  }

  if (lang === 'ml') {
    const statusText = isZero
      ? '✅ *പൂർണ്ണമായും കൊടുത്തുതീർത്തു (Nil Due)*'
      : isDue
      ? `🔴 *ബാക്കി കുടശ്ശിക (Due): ${closingStr}*`
      : `🟢 *മുൻകൂർ അഡ്വാൻസ് (Credit): ${closingStr}*`;

    return `🥛 *പാല് കണക്ക് - പ്രതിമാസ സ്റ്റേറ്റ്മെന്റ്*
🏠 *${familyName}*
📅 *മാസം:* ${monthLabel}
─────────────────
🔹 *വാങ്ങിയ ദിവസങ്ങൾ:* ${calc.purchaseDays} ദിവസങ്ങൾ
🔹 *ആകെ വാങ്ങിയ പാല്:* ${calc.totalLitres} ലിറ്റർ
🔹 *ലിറ്ററിന് വില:* ${rateStr}
─────────────────
🔸 *മുൻ മാസ ബാക്കി (Opening):* ${openingStr}
🔸 *ഈ മാസത്തെ പാല് ചാർജ്ജ്:* ${chargesStr}
🔸 *നൽകിയ ആകെ തുക (Payments):* ${paymentsStr}
─────────────────
${statusText}
─────────────────
_ഫാമിലി മിൽക്ക് അക്കൗണ്ട് ആപ്പ് വഴി തയ്യാറാക്കിയത്_`;
  }

  // English Statement
  const statusText = isZero
    ? '✅ *Fully Settled (Nil Balance)*'
    : isDue
    ? `🔴 *Outstanding Due: ${closingStr}*`
    : `🟢 *Advance Credit: ${closingStr}*`;

  return `🥛 *Family Milk Account - Monthly Statement*
🏠 *${familyName}*
📅 *Month:* ${monthLabel}
─────────────────
🔹 *Purchase Days:* ${calc.purchaseDays} days
🔹 *Total Milk:* ${calc.totalLitres} Litres
🔹 *Rate per Litre:* ${rateStr}
─────────────────
🔸 *Opening Balance:* ${openingStr}
🔸 *Total Milk Charges:* ${chargesStr}
🔸 *Payments Made:* ${paymentsStr}
─────────────────
${statusText}
─────────────────
_Generated via Family Milk Account_`;
}
