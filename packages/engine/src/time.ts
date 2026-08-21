/**
 * Time helpers — IST-aware day boundaries.
 *
 * The trap this exists to prevent: timestamps are epoch-ms UTC internally, but
 * "which day did this debit land on" is an IST question. A naive
 * `date.getDate()` on a machine in UTC puts a 00:30 IST debit on the previous
 * day, which silently shifts a mandate's `dayOfMonth` and moves the shortfall
 * off the day the demo script promises.
 *
 * Nothing here calls `new Date()` with no argument. Every caller passes `now`.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' in IST. The canonical bucket key for a calendar day. */
export function istDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Day of month (1–31) in IST. */
export function istDayOfMonth(date: Date): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCDate();
}

/** Day of week in IST, 0 = Sunday. */
export function istDayOfWeek(date: Date): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCDay();
}

/** Midnight IST at the start of the day containing `date`, as a UTC instant. */
export function startOfIstDay(date: Date): Date {
  const shifted = date.getTime() + IST_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - IST_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole IST days from `a` to `b`. Negative when `b` precedes `a`. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfIstDay(b).getTime() - startOfIstDay(a).getTime()) / DAY_MS);
}

export function isSameIstDay(a: Date, b: Date): boolean {
  return istDayKey(a) === istDayKey(b);
}

/** Calendar parts of an instant, read in IST. */
export function istParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1, // 1–12
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** Build a UTC instant from IST calendar parts. */
export function fromIstParts(
  year: number, month: number, day: number, hour = 0, minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The next occurrence of a recurring debit at or after `now`.
 *
 * MONTHLY and QUARTERLY advance by CALENDAR MONTH, anchored to `dayOfMonth` —
 * not by adding a median gap in days. Adding the median gap is the bug that
 * looks harmless in a unit test and then walks every mandate forward: months
 * are 28–31 days, so a day-5 mandate whose median gap is 31 projects to the
 * 8th, and the whole demo calendar shifts three days to the right.
 *
 * A `dayOfMonth` past the end of a short month clamps to the last day, which is
 * what banks actually do with a 31st-of-the-month mandate in February.
 */
export function nextOccurrence(
  last: Date,
  cadence: 'MONTHLY' | 'WEEKLY' | 'QUARTERLY',
  dayOfMonth: number,
  now: Date,
): Date {
  const floor = startOfIstDay(now).getTime();

  if (cadence === 'WEEKLY') {
    let next = last;
    // Guard the loop: 520 weeks is ten years, far past any real inbox.
    for (let i = 0; i < 520 && next.getTime() < floor; i++) next = addDays(next, 7);
    return next;
  }

  const step = cadence === 'QUARTERLY' ? 3 : 1;
  const { year, month, hour, minute } = istParts(last);

  let y = year;
  let m = month;
  for (let i = 0; i < 240; i++) {
    const candidate = fromIstParts(y, m, Math.min(dayOfMonth, daysInMonth(y, m)), hour, minute);
    if (candidate.getTime() >= floor) return candidate;
    m += step;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
  }
  return last;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * '9 March' — for verdict headlines, which are rendered verbatim on stage.
 * Pass `withYear` only when the date is outside the current year.
 */
export function formatIstDate(date: Date, withYear = false): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDate();
  const month = MONTHS[ist.getUTCMonth()] ?? '';
  return withYear ? `${day} ${month} ${ist.getUTCFullYear()}` : `${day} ${month}`;
}

/** '₹3,200' — Indian digit grouping, no decimals unless there are paise. */
export function formatRupees(rupees: number): string {
  const negative = rupees < 0;
  const abs = Math.abs(rupees);
  const whole = Math.floor(abs);
  const paise = Math.round((abs - whole) * 100);

  const s = String(whole);
  // Indian grouping: last 3 digits, then pairs.
  const head = s.slice(0, -3);
  const tail = s.slice(-3);
  const grouped = head
    ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`
    : tail;

  const body = paise ? `${grouped}.${String(paise).padStart(2, '0')}` : grouped;
  return `${negative ? '-' : ''}₹${body}`;
}
