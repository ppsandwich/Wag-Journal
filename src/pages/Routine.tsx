import { useState } from "react";
import {
  Plus,
  Pencil,
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { createStarterRoutine } from "../lib/routine-template";
import { useJournal } from "../lib/context";
import {
  activities,
  activeRoutine,
  addDays,
  checkConstraints,
  day,
  labels,
  now,
  uid,
} from "../lib/domain";
import type { PlanItem, Routine as RoutineType, Activity } from "../lib/domain";
import {
  ActivityIcon,
  Empty,
  Field,
  Modal,
  SectionTitle,
  submit,
} from "../components/ui";
export function Routine() {
  const j = useJournal(),
    h = j.household!,
    today = day(new Date(), h.timezone);
  const [starter] = useState(createStarterRoutine),
    [viewDate, setViewDate] = useState(today),
    [editing, setEditing] = useState(false),
    [items, setItems] = useState<PlanItem[]>([]),
    [effective, setEffective] = useState(addDays(today, 1)),
    [item, setItem] = useState<PlanItem | null>(null),
    [error, setError] = useState(""),
    [constraints, setConstraints] = useState(false),
    [history, setHistory] = useState(false);
  const routines = j.state.snapshot.routines.filter(
      (r) => r.householdId === h.id && !r.deletedAt,
    ),
    current = activeRoutine(routines, viewDate),
    latest = [...routines].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0],
    protectedRules = j.state.snapshot.constraints.filter(
      (c) => c.householdId === h.id && !c.deletedAt,
    ),
    owner = h.ownerId === j.userId;
  const showStarter = routines.length === 0;
  const displayed = editing
    ? items
    : current?.items || (showStarter ? starter : []);
  const begin = (fromScratch = false) => {
    setItems(
      fromScratch
        ? []
        : structuredClone(current?.items || (showStarter ? starter : [])),
    );
    setEffective(showStarter ? today : addDays(today, 1));
    setEditing(true);
    setError("");
  };
  const save = async () => {
    setError("");
    try {
      const conflicts = checkConstraints(items, protectedRules);
      if (conflicts.length) throw Error(conflicts.join(" "));
      const r: RoutineType = {
        id: uid(),
        householdId: h.id,
        version: 0,
        updatedAt: now(),
        effectiveDate: effective,
        effectiveAt: effective === today ? now() : undefined,
        items,
        baseRoutineId: latest?.id,
      };
      await j.mutate("routine", r);
      setEditing(false);
      setViewDate(effective);
      j.notify(`Routine saved, effective ${effective}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <CalendarDays size={15} /> A rhythm that fits your life
          </span>
          <h1>
            Your routine<span className="heading-dot">.</span>
          </h1>
          <p>A gentle plan. Room for real life.</p>
        </div>
        {!editing && (
          <div className="row-actions">
            <button className="primary" onClick={() => begin()}>
              <Pencil size={17} />
              {current
                ? "Edit routine"
                : showStarter
                  ? "Edit starter routine"
                  : "Create routine"}
            </button>
            {(current || showStarter) && (
              <button className="secondary" onClick={() => begin(true)}>
                <Plus size={17} /> Start from scratch
              </button>
            )}
          </div>
        )}
      </div>
      <div className="routine-toolbar">
        <Field label={editing ? "Changes take effect" : "View routine for"}>
          <input
            type="date"
            value={editing ? effective : viewDate}
            min={editing ? today : undefined}
            onChange={(e) =>
              editing
                ? setEffective(e.target.value)
                : setViewDate(e.target.value)
            }
          />
        </Field>
        <div className="row-actions">
          <button className="secondary" onClick={() => setConstraints(true)}>
            <ShieldCheck size={17} />
            Care instructions
          </button>
          <button className="text-button" onClick={() => setHistory(true)}>
            Version history
          </button>
        </div>
      </div>
      {showStarter && !editing && (
        <div className="notice">
          A starter routine to make your own. These example times are editable.
          Adjust meals, outside trips, play and sleep to fit your puppy and your
          household. Nothing is scheduled until you save.
        </div>
      )}
      {editing && (
        <div className="notice">
          You’re editing a new version. Existing records and past plans stay as
          they were.{" "}
          {effective === today
            ? "Only future, uncompleted activities should be changed today."
            : "Changes start on the selected day."}
        </div>
      )}
      <section className="routine-paper">
        <SectionTitle
          title={
            editing
              ? "Make it your own"
              : current
                ? `Routine from ${current.effectiveDate}`
                : showStarter
                  ? "Starter routine · preview"
                  : "Your routine starts here"
          }
          aside={<span className="small-muted">Household time</span>}
        />
        {displayed.length ? (
          <div className="agenda">
            {[...displayed]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((i) => (
                <div
                  className={`agenda-row ${i.skipped ? "skipped" : ""}`}
                  key={i.id}
                >
                  <time>{i.time}</time>
                  <ActivityIcon type={i.type} />
                  <div>
                    <strong>
                      {labels[i.type]}
                      {i.skipped ? " · skipped" : ""}
                    </strong>
                    <span>
                      {i.trigger
                        ? `${i.offset || 0} min after ${i.trigger === "wake" ? "waking" : "a meal"}`
                        : i.days.length === 7
                          ? "Every day"
                          : i.days
                              .map(
                                (d) =>
                                  [
                                    "Sun",
                                    "Mon",
                                    "Tue",
                                    "Wed",
                                    "Thu",
                                    "Fri",
                                    "Sat",
                                  ][d],
                              )
                              .join(", ")}
                      {i.duration ? ` · estimated ${i.duration} min` : ""}
                    </span>
                  </div>
                  {editing && (
                    <>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${labels[i.type]} at ${i.time}`}
                        onClick={() => setItem(i)}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${labels[i.type]} at ${i.time}`}
                        onClick={() =>
                          setItems(items.filter((x) => x.id !== i.id))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <Empty title="Start with what already works">
            Add your usual meals, outside opportunities and rest times. You can
            log without a routine.
          </Empty>
        )}
        {editing && (
          <button
            className="add-row"
            onClick={() =>
              setItem({
                id: uid(),
                type: "outside",
                time: "07:00",
                days: [0, 1, 2, 3, 4, 5, 6],
              })
            }
          >
            <Plus size={19} />
            Add an activity
          </button>
        )}
      </section>
      <div className="routine-note">
        <ShieldCheck size={22} />
        <div>
          <strong>Your care, your judgement.</strong>
          <p>
            Use the starter as an example, then adapt it to your puppy’s needs
            and your vet or trainer’s guidance. Protected instructions are
            checked before saving.
          </p>
        </div>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <div className="sticky-actions">
          <button className="secondary" onClick={() => setEditing(false)}>
            Cancel changes
          </button>
          <button className="primary" onClick={() => void save()}>
            Save from {effective}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      {item && (
        <Modal
          title={
            items.some((i) => i.id === item.id)
              ? "Edit planned activity"
              : "Add planned activity"
          }
          onClose={() => setItem(null)}
        >
          <form
            onSubmit={submit((d) => {
              const days = d.getAll("days").map(Number);
              if (!days.length) throw Error("Choose at least one day.");
              let newItem: PlanItem = {
                ...item,
                type: d.get("type") as Activity,
                time: String(d.get("time")),
                days,
                duration: d.get("duration")
                  ? Number(d.get("duration"))
                  : undefined,
                trigger: d.get("trigger")
                  ? (d.get("trigger") as "wake" | "meal")
                  : undefined,
                offset: Number(d.get("offset") || 0),
                skipped: d.get("skipped") === "on",
              };
              if (d.get("scope") === "once") {
                newItem = {
                  ...item,
                  exceptions: {
                    ...item.exceptions,
                    [String(d.get("exceptionDate"))]: {
                      time: newItem.time,
                      skipped: !!newItem.skipped,
                      duration: newItem.duration,
                    },
                  },
                };
              }
              setItems(
                items.some((i) => i.id === newItem.id)
                  ? items.map((i) => (i.id === newItem.id ? newItem : i))
                  : [...items, newItem],
              );
              setItem(null);
            })}
          >
            <div className="form-grid">
              <Field label="Apply changes">
                <select name="scope">
                  <option value="all">This routine and future days</option>
                  <option value="once">
                    This occurrence only (time, duration or skip)
                  </option>
                </select>
              </Field>
              <Field label="Occurrence date">
                <input
                  type="date"
                  name="exceptionDate"
                  min={effective}
                  defaultValue={effective}
                  required
                />
              </Field>
              <Field label="Activity">
                <select name="type" defaultValue={item.type}>
                  {activities.map((a) => (
                    <option value={a} key={a}>
                      {labels[a]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Planned time">
                <input
                  name="time"
                  type="time"
                  defaultValue={item.time}
                  required
                />
              </Field>
              <Field label="Timing">
                <select name="trigger" defaultValue={item.trigger || ""}>
                  <option value="">Fixed time</option>
                  <option value="meal">After a confirmed meal</option>
                  <option value="wake">After confirmed waking</option>
                </select>
              </Field>
              <Field label="Minutes after (for relative prompts)">
                <input
                  type="number"
                  name="offset"
                  min={0}
                  max={1440}
                  defaultValue={item.offset || 0}
                />
              </Field>
              <Field label="Estimated duration (optional)">
                <input
                  type="number"
                  name="duration"
                  min={1}
                  max={1440}
                  defaultValue={item.duration}
                />
              </Field>
            </div>
            <fieldset className="day-picker">
              <legend>Repeat on</legend>
              {["S", "M", "T", "W", "T", "F", "S"].map((s, index) => (
                <label key={index}>
                  <input
                    name="days"
                    type="checkbox"
                    value={index}
                    defaultChecked={item.days.includes(index)}
                    aria-label={
                      [
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ][index]
                    }
                  />
                  <span>{s}</span>
                </label>
              ))}
            </fieldset>
            <label className="check-field">
              <input
                type="checkbox"
                name="skipped"
                defaultChecked={item.skipped}
              />
              Mark as skipped in this routine version
            </label>
            <button className="primary full">Keep this activity</button>
          </form>
        </Modal>
      )}
      {constraints && (
        <Modal
          title="Protected care instructions"
          onClose={() => setConstraints(false)}
        >
          <p>
            Keep guidance from your vet or trainer alongside your routine. Only
            the owner can change these instructions.
          </p>
          {protectedRules.map((c) => (
            <article className="constraint" key={c.id}>
              <strong>{c.instruction}</strong>
              <p>
                {c.source} · {labels[c.type]}{" "}
                {c.earliest ? `after ${c.earliest}` : ""}{" "}
                {c.latest ? `before ${c.latest}` : ""}
              </p>
              {owner && (
                <button
                  className="danger-text"
                  onClick={() =>
                    void j.mutate("constraint", { ...c, deletedAt: now() })
                  }
                >
                  Remove instruction
                </button>
              )}
            </article>
          ))}
          {owner && (
            <form
              onSubmit={submit(async (d) => {
                await j.mutate("constraint", {
                  id: uid(),
                  householdId: h.id,
                  version: 0,
                  updatedAt: now(),
                  type: d.get("type") as Activity,
                  instruction: String(d.get("instruction")),
                  source: String(d.get("source")),
                  earliest: String(d.get("earliest") || "") || undefined,
                  latest: String(d.get("latest") || "") || undefined,
                });
                j.notify("Care instruction added.");
                setConstraints(false);
              })}
            >
              <Field label="Instruction">
                <textarea name="instruction" required maxLength={2000} />
              </Field>
              <Field label="Source">
                <input
                  name="source"
                  required
                  placeholder="Vet or trainer’s name and date"
                />
              </Field>
              <Field label="Activity">
                <select name="type">
                  {activities.map((a) => (
                    <option key={a} value={a}>
                      {labels[a]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Not before (optional)">
                  <input type="time" name="earliest" />
                </Field>
                <Field label="Not after (optional)">
                  <input type="time" name="latest" />
                </Field>
              </div>
              <p className="fine-print">
                Only the structured time bounds are automatically checked. Read
                the full instruction when editing relative prompts or other care
                details.
              </p>
              <button className="primary full">Protect this instruction</button>
            </form>
          )}
        </Modal>
      )}
      {history && (
        <Modal title="Routine versions" onClose={() => setHistory(false)}>
          {[...routines]
            .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
            .map((r) => (
              <article className="version-row" key={r.id}>
                <div>
                  <strong>From {r.effectiveDate}</strong>
                  <p>
                    {r.items.length} activities · {r.actor || "Household"}
                  </p>
                </div>
                <button
                  className="secondary small"
                  onClick={() => {
                    setViewDate(r.effectiveDate);
                    setHistory(false);
                  }}
                >
                  View
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setItems(structuredClone(r.items));
                    setEffective(addDays(today, 1));
                    setEditing(true);
                    setHistory(false);
                  }}
                >
                  Use as new version
                </button>
              </article>
            ))}
        </Modal>
      )}
    </>
  );
}
