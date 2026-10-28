/** Date cells store a plain calendar date, "YYYY-MM-DD", with no time zone. */

const pad = (n: number) => String(n).padStart(2, '0');

export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => toIso(new Date());

/** Parse "YYYY-MM-DD" as a local date (new Date("2026-10-28") would be UTC midnight). */
export function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

/** "28 Oct", or "28 Oct 2025" outside the current year. */
export function formatDate(iso: string) {
  const d = fromIso(iso);
  if (!d) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Read pasted / typed dates: 2026-10-28, 28/10/2026 (day first), 28 Oct 2026, Oct 28 2026… */
export function parseDate(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (iso) {
    const d = fromIso(`${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`);
    return d ? toIso(d) : null;
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (dmy) {
    const y = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
    const d = new Date(y, +dmy[2] - 1, +dmy[1]);
    return d.getMonth() === +dmy[2] - 1 ? toIso(d) : null;
  }
  const parsed = new Date(t);
  return Number.isNaN(parsed.getTime()) ? null : toIso(parsed);
}
