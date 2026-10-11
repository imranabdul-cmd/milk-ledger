/**
 * Timezone utilities ensuring all dates, purchase days, and monthly cycles
 * align strictly with Asia/Kolkata (UTC+05:30).
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current date string formatted as 'YYYY-MM-DD' in Asia/Kolkata timezone.
 */
export function getTodayDateKolkata(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

/**
 * Returns current month string formatted as 'YYYY-MM' in Asia/Kolkata timezone.
 */
export function getCurrentMonthKolkata(): string {
  const today = getTodayDateKolkata();
  return today.substring(0, 7);
}

/**
 * Validates 'YYYY-MM-DD' format.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

/**
 * Validates 'YYYY-MM' format.
 */
export function isValidMonthString(monthStr: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthStr);
}

/**
 * Gets previous month string 'YYYY-MM'.
 */
export function getPreviousMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }

  return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * Returns start and end dates ('YYYY-MM-01', 'YYYY-MM-31') for a given 'YYYY-MM'.
 */
export function getMonthDateRange(yearMonth: string): { startDate: string; endDate: string } {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Month is 1-indexed; get last day of month
  const lastDay = new Date(year, month, 0).getDate();

  return {
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${lastDay.toString().padStart(2, '0')}`
  };
}
