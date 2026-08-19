// Vercel Cron schedules are always UTC with no timezone support, and
// Europe/Kyiv shifts between UTC+2 (EET) and UTC+3 (EEST) across the year.
// To land reminders on a fixed Kyiv wall-clock hour year-round, the cron
// fires twice a week (see vercel.json) and each route calls this guard to
// only act on whichever firing actually lands on the target Kyiv hour.
export function isKyivHour(date: Date, hour: number): boolean {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false,
  }).format(date);
  return parseInt(formatted, 10) === hour;
}
