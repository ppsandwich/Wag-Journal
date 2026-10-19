import { useState } from "react";
import { useJournal } from "../lib/context";
import {
  atTime,
  clock,
  day,
  durations,
  labels,
  liveEvents,
  now,
  occurrences,
  validateEvent,
} from "../lib/domain";
import type { Event } from "../lib/domain";
import { Field, Modal, submit } from "./ui";
const localInput = (at: string, zone: string) =>
  `${day(at, zone)}T${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone }).format(new Date(at))}`;
export function EntryEditor({
  entry,
  onClose,
}: {
  entry: Event;
  onClose: () => void;
}) {
  const j = useJournal(),
    zone = j.household!.timezone,
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const events = liveEvents(
    j.state.snapshot.events.filter((e) => e.householdId === entry.householdId),
  );
  const save = async (d: FormData) => {
    setBusy(true);
    setError("");
    try {
      const parse = (name: string) => {
        const v = String(d.get(name) || "");
        const original = name === "at" ? entry.at : entry.end;
        if (original && v === localInput(original, zone)) return original;
        return v ? atTime(v.slice(0, 10), v.slice(11), zone) : undefined;
      };
      const e: Event = {
        ...entry,
        at: parse("at")!,
        end: parse("end"),
        notes: String(d.get("notes") || ""),
        outcome: String(d.get("outcome") || "") || undefined,
        planId: String(d.get("planId") || "") || undefined,
      };
      if (durations.includes(e.type)) {
        const m = String(d.get("estimate") || "");
        e.estimatedMinutes = m ? Number(m) : undefined;
      }
      if (e.type === "potty") {
        e.potty = d.get("potty") as Event["potty"];
        e.location = d.get("location") as Event["location"];
        e.accident = d.get("accident") as Event["accident"];
        e.tripId = String(d.get("tripId") || "") || undefined;
      }
      if (e.type === "outside")
        e.purpose = d.get("purpose") as Event["purpose"];
      if (e.type === "meal") {
        e.amount = String(d.get("amount") || "");
        e.unit = String(d.get("unit") || "");
      }
      if (e.type === "training") e.skill = String(d.get("skill") || "");
      if (e.type === "sleep" || e.type === "crate") {
        const minutes = String(d.get("settlingMinutes") || "");
        e.settlingMinutes = minutes ? Number(minutes) : undefined;
      }
      if (e.type === "sleep")
        e.crateId = String(d.get("crateId") || "") || undefined;
      const linked = events.find((x) => x.id === e.tripId);
      if (linked?.outcome === "no-result")
        throw Error(
          "This trip is marked “No result”. Edit that trip first to remove the conflicting outcome.",
        );
      if (e.outcome === "no-result" && events.some((x) => x.tripId === e.id))
        throw Error(
          "This trip has linked potty events. Remove their links before marking no result.",
        );
      validateEvent(e, events);
      await j.mutate("event", e);
      j.notify("Entry corrected. Earlier details are in change history.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Edit ${labels[entry.type].toLowerCase()}`} onClose={onClose}>
      <form onSubmit={submit(save)}>
        <div className="form-grid">
          <Field label="When it happened" hint={`Household time · ${zone}`}>
            <input
              type="datetime-local"
              name="at"
              required
              defaultValue={localInput(entry.at, zone)}
            />
          </Field>
          {durations.includes(entry.type) && (
            <>
              <Field
                label="Confirmed end"
                hint="Leave blank if still running or uncertain."
              >
                <input
                  type="datetime-local"
                  name="end"
                  defaultValue={entry.end ? localInput(entry.end, zone) : ""}
                />
              </Field>
              <Field
                label="Estimated duration (minutes)"
                hint="An estimate never confirms completion."
              >
                <input
                  type="number"
                  name="estimate"
                  min={1}
                  max={1440}
                  defaultValue={entry.estimatedMinutes}
                />
              </Field>
            </>
          )}
          {entry.type === "potty" && (
            <>
              <Field label="What happened">
                <select name="potty" defaultValue={entry.potty}>
                  <option value="wee">Wee</option>
                  <option value="poo">Poo</option>
                  <option value="both">Both</option>
                </select>
              </Field>
              <Field label="Location">
                <select
                  name="location"
                  defaultValue={entry.location || "unknown"}
                >
                  <option value="unknown">Unknown</option>
                  <option value="outside">Outside</option>
                  <option value="inside">Inside</option>
                </select>
              </Field>
              <Field label="Was it an accident?">
                <select
                  name="accident"
                  defaultValue={entry.accident || "unknown"}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Link to an outside trip">
                <select name="tripId" defaultValue={entry.tripId || ""}>
                  <option value="">Not linked</option>
                  {events
                    .filter((e) => e.type === "outside")
                    .slice(0, 40)
                    .map((e) => (
                      <option value={e.id} key={e.id}>
                        {day(e.at, zone)} · {clock(e.at, zone)}
                        {e.outcome === "no-result" ? " · no result" : ""}
                      </option>
                    ))}
                </select>
              </Field>
            </>
          )}
          {entry.type === "outside" && (
            <Field label="Trip purpose">
              <select name="purpose" defaultValue={entry.purpose || "toilet"}>
                <option value="toilet">Toilet</option>
                <option value="play">Play</option>
                <option value="other">Other</option>
              </select>
            </Field>
          )}
          {["outside", "play", "training", "meal"].includes(entry.type) && (
            <Field label="Outcome">
              <select name="outcome" defaultValue={entry.outcome || ""}>
                <option value="">Unknown / not recorded</option>
                {(
                  (
                    {
                      outside: ["no-result"],
                      play: ["settled", "still-energetic", "overstimulated"],
                      training: ["engaged", "mixed", "disengaged"],
                      meal: ["finished", "partial", "refused"],
                    } as Record<string, string[]>
                  )[entry.type] || []
                ).map((o) => (
                  <option key={o} value={o}>
                    {o.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {entry.type === "meal" && (
            <>
              <Field label="Amount">
                <input name="amount" defaultValue={entry.amount} />
              </Field>
              <Field label="Unit">
                <select name="unit" defaultValue={entry.unit || ""}>
                  <option value="">Not recorded</option>
                  <option>g</option>
                  <option>cups</option>
                  <option>mL</option>
                </select>
              </Field>
            </>
          )}
          {entry.type === "training" && (
            <Field label="Skill practised">
              <input name="skill" defaultValue={entry.skill} />
            </Field>
          )}
          {["sleep", "crate"].includes(entry.type) && (
            <Field label="Settling time (minutes)">
              <input
                type="number"
                min={0}
                name="settlingMinutes"
                defaultValue={entry.settlingMinutes}
              />
            </Field>
          )}
          {entry.type === "sleep" && (
            <Field label="Crate session">
              <select name="crateId" defaultValue={entry.crateId || ""}>
                <option value="">Not linked / elsewhere</option>
                {events
                  .filter((e) => e.type === "crate")
                  .slice(0, 30)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {day(e.at, zone)} · {clock(e.at, zone)}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Notes (optional)">
          <textarea
            name="notes"
            rows={3}
            maxLength={4000}
            defaultValue={entry.notes}
            placeholder="Anything you’d like to remember"
          />
        </Field>
        <Field
          label="Planned activity"
          hint="Link a recorded activity explicitly when more than one plan could match."
        >
          <select name="planId" defaultValue={entry.planId || ""}>
            <option value="">Not linked to a plan</option>
            {entry.planId && (
              <option value={entry.planId}>Current linked activity</option>
            )}
            {occurrences(
              j.state.snapshot.routines.filter(
                (r) => r.householdId === entry.householdId,
              ),
              events,
              day(entry.at, zone),
              zone,
            )
              .filter(
                (p) =>
                  p.item.type === entry.type &&
                  !p.fulfilled &&
                  p.id !== entry.planId,
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {labels[p.item.type]} · {clock(p.at, zone)}
                </option>
              ))}
          </select>
        </Field>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <footer className="modal-footer">
          <button
            type="button"
            className="danger-text"
            onClick={async () => {
              if (
                !confirm(
                  "Delete this entry? It can be recovered from change history for 30 days.",
                )
              )
                return;
              await j.mutate("event", { ...entry, deletedAt: now() });
              j.notify(
                "Entry deleted.",
                () =>
                  void j.mutate("event", { ...entry, deletedAt: undefined }),
              );
              onClose();
            }}
          >
            Delete entry
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
