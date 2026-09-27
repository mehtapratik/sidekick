// Frontmatter dates parse as UTC midnight; format in UTC so a build machine
// west of Greenwich doesn't print the previous day.
function toDate(date: Date | string): Date {
   return typeof date === "string" ? new Date(date) : date;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
   "January",
   "February",
   "March",
   "April",
   "May",
   "June",
   "July",
   "August",
   "September",
   "October",
   "November",
   "December",
];

// Formatted by hand: ICU's en-GB short month is "Sept" in some runtimes.
/** "19 Jul 2026" */
export function formatDate(date: Date | string): string {
   const d = toDate(date);
   return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "September 2026" */
export function formatMonth(date: Date | string): string {
   const d = toDate(date);
   return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "09" */
export function formatDay(date: Date | string): string {
   return String(toDate(date).getUTCDate()).padStart(2, "0");
}

export function formatDateYmd(date: Date | string): string {
   return toDate(date).toISOString().slice(0, 10);
}
