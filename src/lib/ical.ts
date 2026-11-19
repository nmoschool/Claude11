/** توليد ملف iCalendar (RFC 5545) لأحداث الفصل — أحداث يوم كامل */

export interface IcsEvent {
  uid: string;
  date: Date; // اليوم
  endDate?: Date; // شامل
  title: string;
  description?: string;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** طيّ الأسطر عند 75 بايت دون كسر حرف UTF-8 (الحروف العربية بايتان) */
export function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(calName: string, events: IcsEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lughati//AR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  for (const e of events) {
    const end = new Date((e.endDate ?? e.date).getTime() + 86_400_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@lughati`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
