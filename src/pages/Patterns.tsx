import { useState } from "react";
import { BarChart3, Info, ArrowRight } from "lucide-react";
import { useJournal } from "../lib/context";
import {
  activities,
  addDays,
  day,
  filterEvents,
  labels,
  summary,
  clock,
  liveEvents,
  occurrences,
  activeRoutine,
  timelineSegment,
} from "../lib/domain";
import type { Activity } from "../lib/domain";
import { ActivityIcon, Field, SectionTitle } from "../components/ui";
export function Patterns({ navigate }: { navigate: (tab: string) => void }) {
  const j = useJournal(),
    h = j.household!,
    today = day(new Date(), h.timezone);
  const [range, setRange] = useState(7),
    [activity, setActivity] = useState<Activity>("outside"),
    [view, setView] = useState<"timeline" | "hours" | "table">("timeline");
  const from = addDays(today, 1 - range),
    events = filterEvents(
      j.state.snapshot.events.filter((e) => e.householdId === h.id),
      from,
      today,
      h.timezone,
    ),
    stats = summary(events),
    checks = j.state.snapshot.checks.filter(
      (c) =>
        c.householdId === h.id &&
        c.date >= from &&
        c.date <= today &&
        !c.deletedAt,
    ),
    complete = checks.filter((c) => c.status === "complete").length;
  const selected = events.filter((e) => e.type === activity),
    hour = (at: string) =>
      Number(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          hourCycle: "h23",
          timeZone: h.timezone,
        }).format(new Date(at)),
      ),
    hours = Array.from(
      { length: 24 },
      (_, i) => selected.filter((e) => hour(e.at) === i).length,
    ),
    max = Math.max(1, ...hours),
    days = Array.from({ length: Math.min(range, 14) }, (_, i) =>
      addDays(today, -i),
    ).reverse();
  const relevant = j.state.snapshot.routines.filter(
      (r) => r.householdId === h.id,
    ),
    current = activeRoutine(relevant, today);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <BarChart3 size={15} /> Notice the little patterns
          </span>
          <h1>
            A clearer picture<span className="heading-dot">.</span>
          </h1>
          <p>See what’s happening. Find what works for {h.puppy}.</p>
        </div>
        <label className="period-select">
          <span className="sr-only">Pattern period</span>
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>
      </div>
      <section className="insight-banner">
        <span className="eyebrow">A small observation</span>
        <h2>
          {stats.knownTrips
            ? `${stats.successfulTrips} of ${stats.knownTrips} known toilet trips had a potty result.`
            : "Your picture is still taking shape."}
        </h2>
        <p>
          {from} to {today} · {stats.unknownTrips} trips with unknown outcomes ·{" "}
          {stats.excludedTrips} non-toilet trips excluded. {stats.unlinkedPotty}{" "}
          potty events aren’t linked to a trip.
        </p>
        <button className="text-button" onClick={() => navigate("diary")}>
          See the supporting diary
          <ArrowRight size={17} />
        </button>
      </section>
      <div className="pattern-stats">
        <article>
          <ActivityIcon type="potty" />
          <span>Recorded accidents</span>
          <strong>{stats.accidents}</strong>
          <small>
            {stats.unknownAccidents} potty entries have unknown accident status
          </small>
        </article>
        <article>
          <ActivityIcon type="sleep" />
          <span>Confirmed sleep</span>
          <strong>
            {Math.round((stats.sleepMinutes / 60) * 10) / 10}
            <em> hrs</em>
          </strong>
          <small>
            {stats.confirmedSleep} completed intervals · {stats.estimatedSleep}{" "}
            estimated minutes kept separate
          </small>
        </article>
        <article>
          <ActivityIcon type="outside" />
          <span>Logging completeness</span>
          <strong>
            {complete}
            <em> / {range} days</em>
          </strong>
          <small>
            Marked mostly complete ·{" "}
            {checks.filter((c) => c.status === "gaps").length} days with known
            gaps
          </small>
        </article>
      </div>
      <section className="chart-panel">
        <SectionTitle
          title="Every day has its own rhythm"
          aside={
            <div className="segmented" aria-label="Chart view">
              {(["timeline", "hours", "table"] as const).map((v) => (
                <button
                  key={v}
                  className={view === v ? "selected" : ""}
                  onClick={() => setView(v)}
                >
                  {v === "timeline"
                    ? "Day comparison"
                    : v === "hours"
                      ? "Time of day"
                      : "Data table"}
                </button>
              ))}
            </div>
          }
        />
        <div className="activity-chips" aria-label="Activity to compare">
          {activities.map((a) => (
            <button
              className={a === activity ? "selected" : ""}
              key={a}
              onClick={() => setActivity(a)}
            >
              <ActivityIcon type={a} size={16} />
              {labels[a]}
            </button>
          ))}
        </div>
        <p className="fine-print">
          {selected.length} {labels[activity].toLowerCase()} observations ·{" "}
          {from} to {today}. Counts describe logging, not the best care time.
        </p>
        {view === "timeline" && (
          <>
            <div className="chart-legend">
              <span>
                <i className={`dot ${activity}`} />
                Recorded start
              </span>
              <span>
                <i className="dot planned" />
                Planned
              </span>
              <span>
                Solid: confirmed · dashed: estimated · dotted: running
              </span>
            </div>
            <div className="day-chart">
              <div className="chart-axis">
                <span />
                {["12 am", "6 am", "12 pm", "6 pm", "12 am"].map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              {days.map((d) => {
                const ds = liveEvents(j.state.snapshot.events)
                    .filter(
                      (e) => e.householdId === h.id && e.type === activity,
                    )
                    .flatMap((e) => {
                      const segment = timelineSegment(e, d, h.timezone);
                      return segment ? [{ e, segment }] : [];
                    }),
                  planned = occurrences(relevant, events, d, h.timezone).filter(
                    (p) => p.item.type === activity,
                  );
                const left = (at: string) => {
                  const t = new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: h.timezone,
                  })
                    .format(new Date(at))
                    .split(":")
                    .map(Number);
                  return ((t[0] * 60 + t[1]) / 1440) * 100;
                };
                return (
                  <div className="chart-day" key={d}>
                    <span>
                      {new Intl.DateTimeFormat("en-AU", {
                        weekday: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${d}T12:00:00Z`))}
                    </span>
                    <div className="chart-track">
                      {planned.map((p) => (
                        <span
                          key={p.id}
                          className="chart-mark plan"
                          style={{ left: `${left(p.at)}%` }}
                          title={`Planned ${labels[activity]} at ${clock(p.at, h.timezone)}`}
                        />
                      ))}
                      {ds.map(({ e, segment }) => (
                        <span
                          key={e.id}
                          className={`chart-mark ${activity} ${segment.state} ${segment.width > 0 ? "duration-band" : ""}`}
                          style={{
                            left: `${segment.left}%`,
                            ...(segment.width > 0
                              ? { width: `${segment.width}%` }
                              : {}),
                          }}
                          title={`${labels[e.type]} at ${clock(e.at, h.timezone)} · ${segment.state}${segment.state !== "point" ? ` · ${Math.round(segment.minutes)} minutes on this day` : ""}`}
                          role="img"
                          aria-label={`${labels[e.type]} ${day(e.at, h.timezone)} ${clock(e.at, h.timezone)}; ${segment.state}; ${Math.round(segment.minutes)} minutes on ${d}`}
                        />
                      ))}
                      {!ds.length && (
                        <small>
                          No recorded {labels[activity].toLowerCase()} ·
                          activity unknown
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {view === "hours" && (
          <div
            className="histogram"
            role="img"
            aria-label={`${selected.length} recorded ${labels[activity]} events by hour; exact counts available in data table.`}
          >
            {hours.map((n, i) => (
              <div className="hist-column" key={i}>
                <span
                  className={`hist-bar ${activity}`}
                  style={{ height: `${(n / max) * 160}px` }}
                  title={`${i}:00 – ${n} events`}
                >
                  {n > 0 && <small>{n}</small>}
                </span>
                <span>{i % 3 === 0 ? `${i}h` : ""}</span>
              </div>
            ))}
          </div>
        )}
        {view === "table" && (
          <div className="table-scroll">
            <table>
              <caption>
                Recorded {labels[activity].toLowerCase()} events by household
                hour
              </caption>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((n, i) => (
                  <tr key={i}>
                    <td>
                      {String(i).padStart(2, "0")}:00–
                      {String(i).padStart(2, "0")}:59
                    </td>
                    <td>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table>
              <caption>
                Individual records, with confirmed and estimated duration kept
                separate
              </caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Duration</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((e) => (
                  <tr key={e.id}>
                    <td>{day(e.at, h.timezone)}</td>
                    <td>{clock(e.at, h.timezone)}</td>
                    <td>
                      {e.end
                        ? `${day(e.end, h.timezone)} ${clock(e.end, h.timezone)}`
                        : "Unknown"}
                    </td>
                    <td>
                      {e.end
                        ? `${Math.round((Date.parse(e.end) - Date.parse(e.at)) / 60000)} min confirmed`
                        : e.estimatedMinutes
                          ? `${e.estimatedMinutes} min estimated`
                          : "No confirmed duration"}
                    </td>
                    <td>{e.notes || "No note"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="patterns-bottom">
        <section className="panel">
          <SectionTitle title="Room for a useful suggestion" />
          <p>
            {complete < 7 || selected.length < 10
              ? `We need at least seven mostly complete days and ten relevant observations before considering a change. You have ${complete} reviewed days and ${selected.length} ${labels[activity].toLowerCase()} records.`
              : "You have enough records for an initial review. Automated care suggestions remain unavailable until their rules have been reviewed by a qualified professional."}
          </p>
          <p className="fine-print">
            Even with enough records, associations aren’t proof. You always
            decide whether to change your routine.
          </p>
        </section>
        <section className="panel">
          <SectionTitle title="Your routine in context" />
          <p>
            {current
              ? `Your current routine took effect on ${current.effectiveDate}. Review comparable days before and after a change, allowing for logging gaps.`
              : "Create a routine when you’re ready. You can keep logging without one."}
          </p>
          <button className="text-button" onClick={() => navigate("routine")}>
            Review your routine
            <ArrowRight size={17} />
          </button>
          <p className="fine-print">
            <Info size={14} />
            These observations are not medical advice.
          </p>
        </section>
      </div>
    </>
  );
}
