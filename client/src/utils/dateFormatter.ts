/**
 * Centralized Date & Time Formatter for Family Milk Account
 * Ensures consistent, clean, human-readable dates and 12-hour IST times across all pages.
 */

const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_SHORT_TA = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];
const MONTHS_SHORT_ML = ['ജനു', 'ഫെബ്രു', 'മാർ', 'ഏപ്രി', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗ', 'സെപ്റ്റം', 'ഒക്ടോ', 'നവം', 'ഡിസം'];

const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_SHORT_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const DAYS_SHORT_ML = ['ഞായർ', 'തിങ്കൾ', 'ചൊവ്വ', 'ബുധൻ', 'വ്യാഴം', 'വെള്ളി', 'ശനി'];

/**
 * Returns today's date in YYYY-MM-DD (Asia/Kolkata timezone)
 */
export function getKolkataTodayDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // 'YYYY-MM-DD'
}

/**
 * Formats a date string (YYYY-MM-DD or ISO timestamp) into clean, human-readable date.
 * Example: '2026-10-11' -> '11 Oct 2026 (Sun)'
 */
export function formatDisplayDate(
  dateStr?: string | null,
  lang: string = 'en',
  options: { includeDayOfWeek?: boolean; includeYear?: boolean; checkToday?: boolean } = {
    includeDayOfWeek: true,
    includeYear: true,
    checkToday: true,
  }
): string {
  if (!dateStr) return '';

  try {
    let year: number;
    let month: number;
    let day: number;
    let dayOfWeek: number;
    let rawCalendarDate: string;

    if (dateStr.includes('T')) {
      // It's an ISO timestamp (e.g. 2026-10-10T18:30:00.000Z)
      // Extract the exact calendar date in Indian Standard Time (Asia/Kolkata)
      const kolkataParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(dateStr)); // 'YYYY-MM-DD'

      const [y, m, d] = kolkataParts.split('-').map(Number);
      year = y;
      month = m - 1;
      day = d;
      rawCalendarDate = kolkataParts;

      const dObj = new Date(dateStr);
      const kolkataDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
      }).format(dObj);
      dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(kolkataDay);
      if (dayOfWeek === -1) dayOfWeek = 0;
    } else {
      const [yStr, mStr, dStr] = dateStr.split('-');
      year = parseInt(yStr, 10);
      month = parseInt(mStr, 10) - 1;
      day = parseInt(dStr, 10);
      rawCalendarDate = dateStr;

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return dateStr;
      }

      const d = new Date(year, month, day);
      dayOfWeek = d.getDay();
    }

    const todayStr = getKolkataTodayDateString();
    const isToday = rawCalendarDate === todayStr;

    let monthName = MONTHS_SHORT_EN[month] || '';
    let dayName = DAYS_SHORT_EN[dayOfWeek] || '';

    if (lang === 'ta') {
      monthName = MONTHS_SHORT_TA[month] || monthName;
      dayName = DAYS_SHORT_TA[dayOfWeek] || dayName;
    } else if (lang === 'ml') {
      monthName = MONTHS_SHORT_ML[month] || monthName;
      dayName = DAYS_SHORT_ML[dayOfWeek] || dayName;
    }

    const dayPad = day < 10 ? `0${day}` : `${day}`;
    const yearPart = options.includeYear !== false ? ` ${year}` : '';
    const dayOfWeekPart = options.includeDayOfWeek !== false ? ` (${dayName})` : '';

    if (options.checkToday && isToday) {
      const todayPrefix = lang === 'ta' ? 'இன்று' : lang === 'ml' ? 'ഇന്ന്' : 'Today';
      return `${todayPrefix}, ${dayPad} ${monthName}${yearPart}`;
    }

    return `${dayPad} ${monthName}${yearPart}${dayOfWeekPart}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formats ISO timestamp into 12-hour IST time (e.g., '07:30 AM')
 */
export function formatDisplayTime(createdAt?: string | null): string {
  if (!createdAt) return '';

  try {
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Returns structured clean date, time, and flags for unified UI badges.
 */
export function getFormattedDateTime(dateStr?: string | null, createdAt?: string | null, lang: string = 'en') {
  const dateFormatted = formatDisplayDate(dateStr, lang);
  const timeFormatted = formatDisplayTime(createdAt);
  const todayStr = getKolkataTodayDateString();
  const rawDate = dateStr ? (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr) : '';
  const isToday = rawDate === todayStr;

  return {
    date: dateFormatted,
    time: timeFormatted,
    isToday,
    rawDate,
  };
}

const MONTHS_FULL_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_FULL_TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const MONTHS_FULL_ML = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];

/**
 * Formats YYYY-MM into readable month and year (e.g. 'October 2026')
 */
export function formatDisplayMonthYear(yearMonth?: string | null, lang: string = 'en'): string {
  if (!yearMonth) return '';
  const [yStr, mStr] = yearMonth.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1;
  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return yearMonth;

  let monthName = MONTHS_FULL_EN[month];
  if (lang === 'ta') monthName = MONTHS_FULL_TA[month] || monthName;
  else if (lang === 'ml') monthName = MONTHS_FULL_ML[month] || monthName;

  return `${monthName} ${year}`;
}
