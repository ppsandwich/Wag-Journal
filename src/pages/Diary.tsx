import { useState, useEffect } from "react";
import { Download, History, BookOpen, ArrowDownToLine } from "lucide-react";
import { useJournal } from "../lib/context";
import {
  activities,
  addDays,
  day,
  dateLabel,
  filterEvents,
  labels,
  now,
  uid,
} from "../lib/domain";
import type { Activity, Event, RecordType, Entity } from "../lib/domain";
import { Empty, Field, Modal, SectionTitle, submit } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { EntryEditor } from "../components/EntryEditor";
import {
  exportCSV,
  exportPDF,
  exportRoutineCSV,
  download,
} from "../lib/exports";
export function Diary() {
  const j = useJournal(),
    h = j.household!,
    today = day(new Date(), h.timezone);
  const [from, setFrom] = useState(addDays(today, -6)),
    [to, setTo] = useState(today),
    [type, setType] = useState<Activity | "all">("all"),
    [editor, setEditor] = useState<Event | null>(null),
    [exporting, setExporting] = useState(false),
    [history, setHistory] = useState(false),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [older, setOlder] = useState<Event[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setOlder(null);
    if (from < addDays(today, -29) && j.online && !j.demo) {
      j.allData()
        .then((s) => {
          if (!cancelled)
            setOlder(s.events.filter((e) => e.householdId === h.id));
        })
        .catch((e) => {
          if (!cancelled) setError((e as Error).message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [from, to, h.id, j.online, j.demo]);
  const events = filterEvents(
      j.state.snapshot.events.filter((e) => e.householdId === h.id),
      from,
      to,
      h.timezone,
      type,
    ),
    dates = [...new Set(events.map((e) => day(e.at, h.timezone)))];
  const doExport = async (
    kind: "csv" | "pdf" | "routine",
    includeDiary = false,
  ) => {
    setBusy(true);
    setError("");
    try {
      const s = await j.allData();
      if (kind === "csv") exportCSV(s, h, from, to, type);
      else if (kind === "routine") exportRoutineCSV(s, h);
      else await exportPDF(s, h, from, to, includeDiary, type);
      j.notify("Your download is ready.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <BookOpen size={15} /> The little things, remembered
          </span>
          <h1>
            Your diary<span className="heading-dot">.</span>
          </h1>
          <p>All of {h.puppy}’s moments, in one place.</p>
        </div>
        <button className="primary" onClick={() => setExporting(true)}>
          <Download size={18} />
          Export diary
        </button>
      </div>
      <div className="filter-bar">
        <Field label="From">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Activity">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Activity | "all")}
          >
            <option value="all">All activities</option>
            {activities.map((a) => (
              <option value={a} key={a}>
                {labels[a]}
              </option>
            ))}
          </select>
        </Field>
        <div className="filter-actions">
          <button className="secondary" onClick={() => setReview(true)}>
            Review logging
          </button>
          <button
            className="icon-button"
            aria-label="Change history"
            onClick={() => setHistory(true)}
          >
            <History size={21} />
          </button>
        </div>
      </div>
      <p className="fine-print">
        Showing {events.length} recorded moments. Dates use {h.timezone}. Device
        history covers the last 30 days; export retrieves the full selected
        range.
      </p>
      {dates.length ? (
        dates.map((date) => (
          <section className="diary-day" key={date}>
            <SectionTitle
              title={date === today ? "Today" : dateLabel(date)}
              aside={
                <span className="pill">
                  {j.state.snapshot.checks.find(
                    (c) =>
                      c.householdId === h.id && c.date === date && !c.deletedAt,
                  )?.status === "complete"
                    ? "Mostly complete"
                    : j.state.snapshot.checks.find(
                          (c) =>
                            c.householdId === h.id &&
                            c.date === date &&
                            !c.deletedAt,
                        )?.status === "gaps"
                      ? "Logging gaps"
                      : "Not reviewed"}
                </span>
              }
            />
            <Timeline
              events={events.filter((e) => day(e.at, h.timezone) === date)}
              onEdit={setEditor}
            />
          </section>
        ))
      ) : (
        <Empty title="No moments in this view">
          Try another date range or activity. A quiet diary doesn’t mean a quiet
          day.
        </Empty>
      )}
      {editor && <EntryEditor entry={editor} onClose={() => setEditor(null)} />}
      {exporting && (
        <Modal
          title="A diary to take with you"
          onClose={() => setExporting(false)}
        >
          <p>
            {dateLabel(from)} – {dateLabel(to)} ·{" "}
            {type === "all" ? "All activities" : labels[type]}
          </p>
          <div className="export-options">
            <button
              className="secondary"
              disabled={busy || !j.online}
              onClick={() => void doExport("pdf")}
            >
              <Download size={20} />
              <span>
                <strong>PDF summary</strong>
                <small>Patterns, gaps and relevant routines</small>
              </span>
            </button>
            <button
              className="secondary"
              disabled={busy || !j.online}
              onClick={() => void doExport("pdf", true)}
            >
              <BookOpen size={20} />
              <span>
                <strong>PDF with full diary</strong>
                <small>A printable record for your vet or trainer</small>
              </span>
            </button>
            <button
              className="secondary"
              disabled={busy || !j.online}
              onClick={() => void doExport("csv")}
            >
              <ArrowDownToLine size={20} />
              <span>
                <strong>Activity CSV</strong>
                <small>Filtered records, links and explicit unknowns</small>
              </span>
            </button>
            <button
              className="secondary"
              disabled={busy || !j.online}
              onClick={() => void doExport("routine")}
            >
              <History size={20} />
              <span>
                <strong>Routine versions CSV</strong>
                <small>Plans kept separate from observations</small>
              </span>
            </button>
          </div>
          <button
            className="text-button"
            onClick={() =>
              download(
                "wag-journal-field-definitions.txt",
                "Times: ISO 8601 UTC. timezone: household display timezone. end: observed end; unknown means unconfirmed. estimatedMinutes: estimate in minutes, never an observed duration. accident: yes/no/unknown. tripId: linked outside event. planId: linked planned occurrence. source/actor: attribution, no email. Unknown values remain unknown. Totals select events by start date and include the full duration of confirmed intervals. CSV formula-like text is prefixed with an apostrophe.",
                "text/plain",
              )
            }
          >
            Download field definitions
          </button>
          {busy && <p role="status">Preparing your download…</p>}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {!j.online && (
            <p>Connect to the internet to export your complete diary.</p>
          )}
        </Modal>
      )}
      {review && (
        <Modal
          title="How complete was the day?"
          onClose={() => setReview(false)}
        >
          <p>
            A few missing moments are normal. Let your patterns know what’s
            missing.
          </p>
          <form
            onSubmit={submit(async (d) => {
              const date = String(d.get("date")),
                existing = j.state.snapshot.checks.find(
                  (c) =>
                    c.householdId === h.id && c.date === date && !c.deletedAt,
                );
              await j.mutate("check", {
                id: existing?.id || uid(),
                householdId: h.id,
                version: existing?.version || 0,
                updatedAt: now(),
                date,
                status: d.get("status") as "complete" | "gaps" | "unsure",
                notes: String(d.get("notes") || ""),
              });
              j.notify("Logging review saved.");
              setReview(false);
            })}
          >
            <Field label="Day">
              <input
                type="date"
                name="date"
                defaultValue={today}
                max={today}
                required
              />
            </Field>
            <Field label="Logging completeness">
              <select name="status">
                <option value="complete">Mostly complete</option>
                <option value="gaps">Some gaps</option>
                <option value="unsure">Unsure</option>
              </select>
            </Field>
            <Field label="Gaps or context (optional)">
              <textarea
                name="notes"
                rows={3}
                placeholder="e.g. Didn’t log between 2 pm and 5 pm"
              />
            </Field>
            <button className="primary full">Save review</button>
          </form>
        </Modal>
      )}
      {history && (
        <Modal title="Change history" onClose={() => setHistory(false)} wide>
          <p>
            Recent changes are retained for 30 days. Restoring creates a new
            version.
          </p>
          <div className="history-list">
            {j.state.snapshot.history
              .filter(
                (x) =>
                  (x.after as any).householdId === h.id &&
                  x.entity !== "preference",
              )
              .map((x) => (
                <article key={x.id}>
                  <div>
                    <strong>
                      {x.entity === "event"
                        ? labels[(x.after as any).type as Activity]
                        : x.entity}{" "}
                      · {x.before ? "corrected" : "added"}
                    </strong>
                    <p>
                      {x.actor} · {new Date(x.at).toLocaleString("en-AU")}
                    </p>
                    <details>
                      <summary>View recorded change</summary>
                      <pre>
                        {JSON.stringify(
                          { before: x.before, after: x.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>
                  {x.before && (
                    <button
                      className="secondary small"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Restore this earlier version? This adds a new change to history.",
                          )
                        )
                          return;
                        await j.mutate(
                          x.entity as Entity,
                          x.before as RecordType,
                        );
                        j.notify("Earlier version restored.");
                      }}
                    >
                      Restore
                    </button>
                  )}
                  {!x.before && (x.after as any).deletedAt && (
                    <button
                      className="secondary small"
                      onClick={() =>
                        void j.mutate(
                          x.entity as Entity,
                          { ...x.after, deletedAt: undefined } as RecordType,
                        )
                      }
                    >
                      Recover
                    </button>
                  )}
                </article>
              ))}
            {!j.state.snapshot.history.length && (
              <p>No corrections yet. Changes will appear here.</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
