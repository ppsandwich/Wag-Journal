import {
  eventsCSV,
  filterEvents,
  summary,
  clock,
  dateLabel,
  labels,
  activeRoutine,
  liveEvents,
  csvCell,
  day,
} from "./domain";
import type { Snapshot, Household, Activity } from "./domain";
export function download(
  name: string,
  content: Blob | string,
  type = "text/csv;charset=utf-8",
) {
  const blob =
    typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCSV(
  s: Snapshot,
  h: Household,
  from: string,
  to: string,
  type: Activity | "all",
) {
  const events = filterEvents(
    s.events.filter((e) => e.householdId === h.id),
    from,
    to,
    h.timezone,
    type,
  );
  download(`wag-journal-${from}-${to}.csv`, eventsCSV(events, h.timezone));
}
export function exportRoutineCSV(s: Snapshot, h: Household) {
  const rows = [
    [
      "routine_id",
      "effective_date",
      "item_id",
      "activity",
      "time",
      "days",
      "trigger",
      "offset_minutes",
      "duration_minutes",
      "timezone",
    ],
  ];
  for (const r of s.routines.filter(
    (r) => r.householdId === h.id && !r.deletedAt,
  )) {
    for (const i of r.items)
      rows.push([
        r.id,
        r.effectiveDate,
        i.id,
        i.type,
        i.time,
        i.days.join("|"),
        i.trigger || "unknown",
        String(i.offset ?? "unknown"),
        String(i.duration ?? "unknown"),
        h.timezone,
      ]);
  }
  download(
    "wag-journal-routine-versions.csv",
    "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
  );
}
export async function exportPDF(
  s: Snapshot,
  h: Household,
  from: string,
  to: string,
  includeDiary: boolean,
  type: Activity | "all" = "all",
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const fontResponse = await fetch("/fonts/AtkinsonHyperlegible-Regular.ttf");
  if (!fontResponse.ok)
    throw Error("The PDF font could not be loaded. Try again when connected.");
  const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());
  let fontBinary = "";
  for (const byte of fontBytes) fontBinary += String.fromCharCode(byte);
  pdf.addFileToVFS("AtkinsonHyperlegible.ttf", btoa(fontBinary));
  pdf.addFont("AtkinsonHyperlegible.ttf", "Atkinson", "normal");
  pdf.setFont("Atkinson", "normal");
  let y = 22;
  const clean = (s: string) =>
    s
      .replace(/[–—]/g, "-")
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/→/g, "to");
  const line = (text: string, size = 11) => {
    pdf.setFontSize(size);
    for (const part of pdf.splitTextToSize(clean(text), 170)) {
      if (y > 275) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(part, 20, y);
      y += size * 0.48 + 2;
    }
  };
  const events = filterEvents(
      s.events.filter((e) => e.householdId === h.id),
      from,
      to,
      h.timezone,
      type,
    ),
    stats = summary(events);
  pdf.setTextColor(38, 51, 45);
  line("Wag Journal", 25);
  line(`${h.puppy}'s diary`, 19);
  line(`${dateLabel(from)} to ${dateLabel(to)}`);
  line(`Household timezone: ${h.timezone}. Activity filter: ${type}.`);
  line(
    `Born approximately ${h.birthDate}. Age at end of range: ${Math.max(0, Math.floor((Date.parse(to) - Date.parse(h.birthDate)) / 604800000))} weeks.`,
  );
  y += 5;
  line("Recorded observations", 16);
  line(
    `${events.length} recorded events. ${stats.accidents} explicitly recorded accidents; ${stats.unknownAccidents} potty events with unknown accident status.`,
  );
  line(
    `Toilet trips: ${stats.successfulTrips} with a potty result out of ${stats.knownTrips} known outcomes. ${stats.unknownTrips} unknown outcomes; ${stats.excludedTrips} non-toilet trips excluded. ${stats.unlinkedPotty} unlinked potty events.`,
  );
  line(
    `Confirmed sleep: ${Math.round(stats.sleepMinutes)} minutes across ${stats.confirmedSleep} completed intervals. Unconfirmed sleep estimates: ${stats.estimatedSleep} minutes, shown separately.`,
  );
  const checks = s.checks.filter(
    (c) =>
      c.householdId === h.id && c.date >= from && c.date <= to && !c.deletedAt,
  );
  line(
    `Logging review: ${checks.filter((c) => c.status === "complete").length} mostly complete days; ${checks.filter((c) => c.status === "gaps").length} days with gaps. Unreviewed days are unknown.`,
  );
  for (const c of checks.filter((c) => c.status !== "complete"))
    line(`${c.date}: ${c.status}${c.notes ? ` - ${c.notes}` : ""}`);
  line(
    "Records are observations, not medical advice or evidence that a routine caused a change. Totals use events starting within the selected dates; confirmed durations include their full interval. Missing logs do not mean inactivity.",
  );
  y += 5;
  line("Relevant routines", 16);
  const routines = s.routines.filter(
      (r) => r.householdId === h.id && !r.deletedAt,
    ),
    baseline = activeRoutine(routines, from);
  for (const r of routines.filter(
    (r) =>
      r.id === baseline?.id ||
      (r.effectiveDate > from && r.effectiveDate <= to),
  )) {
    line(`Version ${r.id.slice(0, 8)}, effective ${r.effectiveDate}`);
    for (const i of r.items)
      line(
        `${i.time} - ${labels[i.type]}${i.trigger ? ` (${i.offset || 0} min after ${i.trigger})` : ""}${i.duration ? ` - estimated ${i.duration} min` : ""}${i.skipped ? " - skipped" : ""}`,
      );
  }
  if (includeDiary) {
    y += 5;
    line("Diary", 16);
    for (const e of liveEvents(events)) {
      line(
        `${day(e.at, h.timezone)} ${clock(e.at, h.timezone)} - ${labels[e.type]}${e.potty ? ` (${e.potty})` : ""}${e.end ? ` to ${clock(e.end, h.timezone)}, confirmed` : e.estimatedMinutes ? `, estimated ${e.estimatedMinutes} min` : ""}`,
      );
      line(
        `By ${e.actor || e.source || "unknown"}; outcome ${e.outcome || "unknown"}; accident ${e.accident || "unknown"}.`,
        9,
      );
      if (e.notes) line(e.notes, 10);
    }
  }
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.text(`Wag Journal | ${i} / ${total}`, 20, 290);
  }
  pdf.save(`wag-journal-${from}-${to}.pdf`);
}
