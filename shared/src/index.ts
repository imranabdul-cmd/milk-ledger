export type Language = 'en' | 'ml' | 'ta';
export type Role = 'owner' | 'admin' | 'member';
export type PaymentStatus = 'paid' | 'pending' | 'partially_paid';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';

export interface Invitation {
  id: string;
  familyId: string;
  codeDisplay: string;
  role: 'admin' | 'member';
  createdBy?: string | null;
  createdByName?: string | null;
  maxUses: number;
  usesCount: number;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
  rawCode?: string; // Only returned when generated
}

export interface Family {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  name: string;
  phone: string;
  role: Role;
  languagePreference: Language;
  isActive: boolean;
  mustChangePin?: boolean;
  sessionsRevokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MilkRateHistory {
  id: string;
  familyId: string;
  ratePaisePerLitre: number;
  effectiveFrom: string; // YYYY-MM-DD
  notes?: string | null;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface MilkEntry {
  id: string;
  familyId: string;
  memberId: string;
  createdByName?: string;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  quantityMl: number;
  ratePaisePerLitre: number;
  totalAmountPaise: number;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  isCorrected: boolean;
  correctionNotes?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  familyId: string;
  memberId: string;
  createdByName?: string;
  date: string; // YYYY-MM-DD
  amountPaise: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  milkEntryId?: string | null;
  monthlyClosureId?: string | null;
  allocatedAmountPaise: number;
  createdAt: string;
}

export interface MonthlyClosure {
  id: string;
  familyId: string;
  yearMonth: string; // YYYY-MM
  openingBalancePaise: number;
  totalMilkChargesPaise: number;
  totalPaymentsPaise: number;
  closingBalancePaise: number;
  totalLitres: number;
  purchaseDays: number;
  notes?: string | null;
  closedAt: string;
  closedBy: string;
  closedByName?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  familyId: string;
  memberId?: string | null;
  memberName?: string | null;
  action: 'create' | 'update' | 'delete' | 'close_month' | 'correction';
  entityType: 'milk_entry' | 'payment' | 'milk_rate' | 'family_member' | 'monthly_closure';
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  currentMonth: string; // YYYY-MM
  currentRatePaisePerLitre: number;
  totalLitres: number;
  purchaseDays: number;
  totalMilkChargesPaise: number;
  totalPaymentsPaise: number;
  openingBalancePaise: number;
  closingBalancePaise: number; // Opening + Charges - Payments
  netDueOrAdvancePaise: number; // positive = Due, negative = Advance Credit
  todayPurchase: MilkEntry | null;
  todayPaymentStatus: 'none' | 'paid' | 'pending';
  recentActivity: Array<{
    id: string;
    type: 'purchase' | 'payment';
    date: string;
    title: string;
    amountPaise: number;
    quantityMl?: number;
    memberName: string;
    status?: PaymentStatus;
  }>;
}

export interface UserSession {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    familyId: string;
    familyName: string;
    name: string;
    phone: string;
    role: Role;
    languagePreference: Language;
    mustChangePin?: boolean;
  };
}

// ----------------- Exact Financial Math Helpers -----------------

/**
 * Calculates milk cost in paise using exact integer math.
 * Formula: round((quantityMl * ratePaisePerLitre) / 1000)
 */
export function calculateMilkCostPaise(quantityMl: number, ratePaisePerLitre: number): number {
  if (quantityMl <= 0 || ratePaisePerLitre <= 0) return 0;
  return Math.round((quantityMl * ratePaisePerLitre) / 1000);
}

/**
 * Convert paise to Rupees (e.g., 5600 paise -> 56.00)
 */
export function paiseToRupees(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

/**
 * Convert Rupees to integer paise (e.g., 56 -> 5600, 56.50 -> 5650)
 */
export function rupeesToPaise(rupees: number | string): number {
  const val = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

/**
 * Convert millilitres to litres (e.g. 500 ml -> 0.5, 1000 ml -> 1.0)
 */
export function mlToLitres(quantityMl: number): number {
  return Number((quantityMl / 1000).toFixed(2));
}

/**
 * Formats paise into Indian Rupee currency string (e.g., "₹56.00" or "₹1,250")
 */
export function formatPaise(paise: number, options?: { showDecimalIfZero?: boolean; lang?: Language }): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const cents = absPaise % 100;

  // Indian number comma formatting: 1,23,456
  const rupeeStr = rupees.toLocaleString('en-IN');
  let result = '';

  if (cents === 0 && !options?.showDecimalIfZero) {
    result = `₹${rupeeStr}`;
  } else {
    result = `₹${rupeeStr}.${cents.toString().padStart(2, '0')}`;
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Formats quantity in millilitres into human-readable string (e.g. "½ L", "1 L", "1.5 L")
 */
export function formatMilkQuantity(quantityMl: number, lang: Language = 'en'): string {
  if (quantityMl === 500) {
    if (lang === 'ta') return '½ லிட்டர்';
    if (lang === 'ml') return '½ ലിറ്റർ';
    return '½ Litre';
  }
  if (quantityMl === 1000) {
    if (lang === 'ta') return '1 லிட்டர்';
    if (lang === 'ml') return '1 ലിറ്റർ';
    return '1 Litre';
  }
  if (quantityMl === 1500) {
    if (lang === 'ta') return '1½ லிட்டர்';
    if (lang === 'ml') return '1½ ലിറ്റർ';
    return '1.5 Litres';
  }
  if (quantityMl === 2000) {
    if (lang === 'ta') return '2 லிட்டர்';
    if (lang === 'ml') return '2 ലിറ്റർ';
    return '2 Litres';
  }

  const litres = mlToLitres(quantityMl);
  if (lang === 'ta') {
    return `${litres} லிட்டர் (${quantityMl} மி.லி)`;
  }
  if (lang === 'ml') {
    return `${litres} ലിറ്റർ (${quantityMl} മി.ലി)`;
  }
  return `${litres} L (${quantityMl} ml)`;
}
