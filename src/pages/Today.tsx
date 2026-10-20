import { useState, useRef } from "react";
import {
  ArrowRight,
  Clock,
  Settings2,
  Check,
  Plus,
  Timer,
  Sun,
} from "lucide-react";
import { useJournal } from "../lib/context";
import {
  activities,
  atTime,
  clock,
  day,
  durations,
  elapsed,
  isActive,
  labels,
  liveEvents,
  matchPlan,
  now,
  occurrences,
  preferencesFor,
  summary,
  uid,
  validateEvent,
} from "../lib/domain";
import type { Activity, Event, Occurrence, Preference } from "../lib/domain";
import {
  ActivityIcon,
  Field,
  Modal,
  SectionTitle,
  submit,
} from "../components/ui";
import { Timeline } from "../components/Timeline";
import { EntryEditor } from "../components/EntryEditor";
export function Today({ navigate }: { navigate: (tab: string) => void }) {
  const j = useJournal(),
    h = j.household!,
    zone = h.timezone,
    today = day(new Date(), zone),
    events = liveEvents(
      j.state.snapshot.events.filter((e) => e.householdId === h.id),
    );
  const todayEvents = events.filter((e) => day(e.at, zone) === today),
    running = events.filter(isActive),
    plans = occurrences(
      j.state.snapshot.routines.filter((r) => r.householdId === h.id),
      events,
      today,
      zone,
    );
  const [potty, setPotty] = useState(false),
    [editor, setEditor] = useState<Event | null>(null),
    [mode, setMode] = useState<Activity | null>(null),
    [recordingMode, setRecordingMode] = useState("timer"),
    [estimatedMinutes, setEstimatedMinutes] = useState("15"),
    [ending, setEnding] = useState<Event | null>(null),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [exact, setExact] = useState(
    `${today}T${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone }).format(new Date())}`,
  );
  const lastTap = useRef<Record<string, number>>({});
  const [localPref, setLocalPref] = useState<Preference>(() => {
    const p = preferencesFor(j.state.snapshot, h.id, j.userId);
    if (j.locked) {
      try {
        p.presets = JSON.parse(
          localStorage.getItem(`wag-kiosk-presets-${h.id}`) || "{}",
        );
      } catch {}
    }
    return p;
  });
  const pref =
    j.state.snapshot.preferences.find(
      (p) => p.householdId === h.id && p.userId === j.userId,
    ) || localPref;
  const stats = summary(todayEvents),
    next = plans.find(
      (p) => !p.fulfilled && Date.parse(p.at) > Date.now() - 900000,
    );
  const log = async (
    type: Activity,
    detail?: Event["potty"],
    plan?: Occurrence,
  ) => {
    if (busy || Date.now() - (lastTap.current[type] || 0) < 800) return;
    lastTap.current[type] = Date.now();
    setBusy(true);
    setError("");
    try {
      if (durations.includes(type)) {
        const active = running.find((e) => e.type === type);
        if (active) {
          setEnding(active);
          return;
        }
      }
      const e: Event = {
        id: uid(),
        householdId: h.id,
        version: 0,
        updatedAt: now(),
        type,
        at:
          offset === -1
            ? atTime(exact.slice(0, 10), exact.slice(11), zone)
            : new Date(Date.now() - offset * 60000).toISOString(),
        potty: detail,
        purpose: type === "outside" ? "toilet" : undefined,
        estimatedMinutes: pref.presets[type],
        actor: j.locked ? j.kiosk?.name : "You",
      };
      if (type === "potty") {
        const trips = events.filter(
          (t) =>
            t.type === "outside" &&
            Date.parse(t.at) <= Date.parse(e.at) &&
            (!t.end || Date.parse(t.end) >= Date.parse(e.at)),
        );
        if (trips.length === 1 && trips[0].outcome !== "no-result")
          e.tripId = trips[0].id;
      }
      if (type === "sleep") {
        const previous = events.find((e) => e.type === "sleep" && e.end);
        if (previous) e.previousSleepId = previous.id;
      }
      e.planId = plan?.id || matchPlan(e, plans);
      validateEvent(e, events);
      await j.mutate("event", e);
      setPotty(false);
      setOffset(0);
      j.notify(
        `${type === "potty" ? (detail === "both" ? "Wee and poo" : detail === "wee" ? "Wee" : "Poo") : labels[type]} ${durations.includes(type) ? "started" : "recorded"}.`,
        () => void j.mutate("event", { ...e, deletedAt: now() }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const finish = async (
    e: Event,
    end = now(),
    outcome?: string,
    woke = false,
  ) => {
    try {
      if (outcome === "no-result" && events.some((x) => x.tripId === e.id))
        throw Error(
          "This trip already has a linked potty result. Correct its linked entries first.",
        );
      const updated = { ...e, end, outcome: outcome || e.outcome };
      validateEvent(updated, events);
      await j.mutate("event", updated);
      if (woke) {
        const sleep = running.find((x) => x.type === "sleep");
        if (sleep) await j.mutate("event", { ...sleep, end });
      }
      setEnding(null);
      j.notify(`${labels[e.type]} ended.`, () => void j.mutate("event", e));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Sun size={15} /> Your everyday companion
          </span>
          <h1>
            Today, with {h.puppy}
            <span className="heading-dot">.</span>
          </h1>
          <p>A little care. A little play. A rhythm of your own.</p>
        </div>
        <div className="date-stamp">
          <strong>
            {new Intl.DateTimeFormat("en-AU", {
              day: "numeric",
              timeZone: zone,
            }).format(new Date())}
          </strong>
          <span>
            {new Intl.DateTimeFormat("en-AU", {
              month: "short",
              timeZone: zone,
            }).format(new Date())}
            <br />
            {new Intl.DateTimeFormat("en-AU", {
              weekday: "long",
              timeZone: zone,
            }).format(new Date())}
          </span>
        </div>
      </div>
      <div className="today-layout">
        <section className="logging-column">
          <SectionTitle
            title="What’s happening?"
            aside={
              <label className="backdate">
                <Clock size={16} />
                <span className="sr-only">Logging time</span>
                <select
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                >
                  <option value={0}>Right now</option>
                  <option value={5}>5 min ago</option>
                  <option value={15}>15 min ago</option>
                  <option value={30}>30 min ago</option>
                  <option value={-1}>Exact date & time…</option>
                </select>
              </label>
            }
          />
          {offset === -1 && (
            <Field label={`When it happened · ${zone}`}>
              <input
                type="datetime-local"
                value={exact}
                onChange={(e) => setExact(e.target.value)}
                required
              />
            </Field>
          )}
          <div className="activity-grid">
            {activities.map((type) => {
              const last = events.find((e) => e.type === type),
                active = running.find((e) => e.type === type);
              return (
                <div
                  className={`activity-card ${type} ${active ? "has-active" : ""}`}
                  key={type}
                >
                  <button
                    className="activity-action"
                    disabled={busy}
                    onClick={() =>
                      type === "potty" ? setPotty(true) : void log(type)
                    }
                  >
                    <ActivityIcon type={type} size={27} />
                    <span className="activity-name">{labels[type]}</span>
                    <span className="activity-meta">
                      {active
                        ? `${elapsed(active.at)} · running`
                        : last
                          ? elapsed(last.at) === "Just now"
                            ? "Just now"
                            : `${elapsed(last.at)} ago`
                          : "Not logged yet"}
                    </span>
                    <span className="activity-plus">
                      {active ? <Timer size={18} /> : <Plus size={18} />}
                    </span>
                  </button>
                  {durations.includes(type) && (
                    <button
                      className="activity-mode"
                      onClick={() => {
                        setRecordingMode(
                          pref.presets[type] ? "estimate" : "timer",
                        );
                        setEstimatedMinutes(String(pref.presets[type] || 15));
                        setMode(type);
                      }}
                      aria-label={`Change ${labels[type].toLowerCase()} recording mode`}
                    >
                      <Settings2 size={12} />
                      {pref.presets[type]
                        ? `Estimated ${pref.presets[type]} min`
                        : "Start a timer"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                Dismiss
              </button>
            </p>
          )}
          {running.length > 0 && (
            <section className="running-section">
              <SectionTitle
                title="Happening now"
                aside={
                  <span className="live-label">
                    <i /> {running.length} active
                  </span>
                }
              />
              {running.map((e) => (
                <div className="running-row" key={e.id}>
                  <ActivityIcon type={e.type} />
                  <div>
                    <strong>{labels[e.type]}</strong>
                    <span>
                      Since {clock(e.at, zone)} · {elapsed(e.at)}
                      {e.estimatedMinutes
                        ? ` · estimated ${e.estimatedMinutes} min`
                        : ""}
                      {day(e.at, zone) < today ? " · Still running?" : ""}
                    </span>
                  </div>
                  <button
                    className="secondary small"
                    onClick={() => setEnding(e)}
                  >
                    End {labels[e.type].toLowerCase()}
                  </button>
                </div>
              ))}
            </section>
          )}
          <section className="day-glance">
            <SectionTitle title="The day so far" />
            <div className="glance-grid">
              <div>
                <strong>{stats.counts.outside}</strong>
                <span>outside trips</span>
              </div>
              <div>
                <strong>{stats.counts.meal}</strong>
                <span>meals logged</span>
              </div>
              <div>
                <strong>
                  {stats.sleepMinutes
                    ? `${Math.round((stats.sleepMinutes / 60) * 10) / 10}h`
                    : "—"}
                </strong>
                <span>confirmed sleep</span>
              </div>
            </div>
            <p className="fine-print">
              Only what’s been recorded. Gaps don’t mean nothing happened.
            </p>
          </section>
        </section>
        <aside className="today-sidebar">
          <section className="next-card">
            <span className="eyebrow">A little look ahead</span>
            {next ? (
              <>
                <div className="next-title">
                  <ActivityIcon type={next.item.type} />
                  <h2>{labels[next.item.type]}</h2>
                  <time>{clock(next.at, zone)}</time>
                </div>
                <p>{next.reasons.join(" · ")} · planned, not yet recorded</p>
                {!j.locked && (
                  <label className="snooze-control">
                    <span>Snooze for you</span>
                    <select
                      aria-label="Snooze upcoming reminder"
                      value=""
                      onChange={async (e) => {
                        const minutes = Number(e.target.value);
                        if (minutes) {
                          await j.mutate("preference", {
                            ...pref,
                            snoozes: {
                              ...pref.snoozes,
                              [next.id]: new Date(
                                Date.now() + minutes * 60000,
                              ).toISOString(),
                            },
                          });
                          j.notify(
                            `Snoozed for ${minutes} minutes, just for you.`,
                          );
                        }
                      }}
                    >
                      <option value="">Choose…</option>
                      <option value="10">10 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                    </select>
                  </label>
                )}
                <button
                  className="primary full"
                  onClick={() =>
                    next.item.type === "potty"
                      ? setPotty(true)
                      : void log(next.item.type, undefined, next)
                  }
                >
                  Record {labels[next.item.type].toLowerCase()} now
                  <ArrowRight size={17} />
                </button>
              </>
            ) : (
              <>
                <h2>
                  {plans.length
                    ? "Room to find your rhythm."
                    : "Make the day your own."}
                </h2>
                <p>
                  {plans.length
                    ? "Your planned activities are complete or have passed. Keep recording what happens."
                    : "Make a starter routine your own, or build one from scratch."}
                </p>
                {!j.locked && (
                  <button
                    className="text-button"
                    onClick={() => navigate("routine")}
                  >
                    Visit your routine
                    <ArrowRight size={17} />
                  </button>
                )}
              </>
            )}
          </section>
          <section className="recent-card">
            <SectionTitle
              title="Recent moments"
              aside={
                !j.locked && (
                  <button
                    className="text-button"
                    onClick={() => navigate("diary")}
                  >
                    View diary
                    <ArrowRight size={15} />
                  </button>
                )
              }
            />
            <Timeline
              events={todayEvents.slice(0, 5)}
              onEdit={setEditor}
              compact
            />
            {todayEvents.length > 5 && (
              <p className="recent-foot">
                {todayEvents.length} moments recorded today
              </p>
            )}
          </section>
        </aside>
      </div>
      {potty && (
        <Modal title="What happened?" onClose={() => setPotty(false)}>
          <p>Record now. You can add location and other details afterwards.</p>
          <div className="potty-choices">
            {(["wee", "poo", "both"] as const).map((p) => (
              <button
                className="secondary"
                key={p}
                disabled={busy}
                onClick={() => void log("potty", p)}
              >
                <ActivityIcon type="potty" />
                {p === "wee" ? "Wee" : p === "poo" ? "Poo" : "Both"}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {mode && (
        <Modal
          title={`${labels[mode]} recording`}
          onClose={() => setMode(null)}
        >
          <form
            onSubmit={submit(async (d) => {
              const minutes = Number(d.get("minutes"));
              const p = {
                ...pref,
                presets: {
                  ...pref.presets,
                  [mode]: d.get("mode") === "estimate" ? minutes : undefined,
                },
              };
              if (j.locked) {
                setLocalPref(p);
                localStorage.setItem(
                  `wag-kiosk-presets-${h.id}`,
                  JSON.stringify(p.presets),
                );
              } else await j.mutate("preference", p);
              setMode(null);
            })}
          >
            <Field label="Recording mode">
              <select
                name="mode"
                value={recordingMode}
                onChange={(e) => setRecordingMode(e.target.value)}
              >
                <option value="timer">
                  Running timer (end it when finished)
                </option>
                <option value="estimate">
                  Estimated duration (confirm later)
                </option>
              </select>
            </Field>
            <div className="field">
              <span>Duration presets</span>
              <div
                className="row-actions"
                role="group"
                aria-label="Duration presets"
              >
                {[10, 15, 20].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={
                      recordingMode === "estimate" &&
                      Number(estimatedMinutes) === minutes
                        ? "primary"
                        : "secondary"
                    }
                    aria-pressed={
                      recordingMode === "estimate" &&
                      Number(estimatedMinutes) === minutes
                    }
                    onClick={() => {
                      setEstimatedMinutes(String(minutes));
                      setRecordingMode("estimate");
                    }}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Estimate in minutes"
              hint="Your own logging preference, not a recommended care duration."
            >
              <input
                name="minutes"
                type="number"
                min={1}
                max={1440}
                value={estimatedMinutes}
                onChange={(e) => {
                  setEstimatedMinutes(e.target.value);
                  setRecordingMode("estimate");
                }}
                required
              />
            </Field>
            <button className="primary full">Save preference</button>
          </form>
        </Modal>
      )}
      {ending && (
        <Modal
          title={`End ${labels[ending.type].toLowerCase()}`}
          onClose={() => setEnding(null)}
        >
          <p>
            Started at {clock(ending.at, zone)}. Confirm when it actually
            finished.
          </p>
          <form
            onSubmit={submit(async (d) => {
              const time = String(d.get("time") || "");
              await finish(
                ending,
                time ? atTime(String(d.get("date")), time, zone) : now(),
                String(d.get("outcome") || ""),
                d.get("woke") === "on",
              );
            })}
          >
            <div className="form-grid">
              <Field label="End date">
                <input name="date" type="date" defaultValue={today} required />
              </Field>
              <Field label="Earlier end time (optional)">
                <input name="time" type="time" />
              </Field>
            </div>
            {ending.type === "outside" && (
              <Field label="Trip outcome">
                <select name="outcome">
                  <option value="">Leave outcome unchanged / unknown</option>
                  <option value="no-result">No result</option>
                </select>
              </Field>
            )}
            {ending.type === "crate" &&
              running.some((e) => e.type === "sleep") && (
                <label className="check-field">
                  <input type="checkbox" name="woke" />
                  Also woke up (end sleep)
                </label>
              )}
            {error && <p className="error-message">{error}</p>}
            <button className="primary full">
              <Check size={18} />
              Confirm end
            </button>
          </form>
          {!j.locked && (
            <button
              className="text-button"
              onClick={() => {
                setEditor(ending);
                setEnding(null);
              }}
            >
              Correct other details
            </button>
          )}
        </Modal>
      )}
      {editor && <EntryEditor entry={editor} onClose={() => setEditor(null)} />}
    </>
  );
}
