import { Pencil } from "lucide-react";
import type { Event } from "../lib/domain";
import { clock, durations, elapsed, labels } from "../lib/domain";
import { ActivityIcon, Empty } from "./ui";
import { useJournal } from "../lib/context";
export function Timeline({
  events,
  onEdit,
  compact = false,
}: {
  events: Event[];
  onEdit: (e: Event) => void;
  compact?: boolean;
}) {
  const j = useJournal(),
    zone = j.household!.timezone;
  if (!events.length)
    return (
      <Empty title="A fresh page for today">
        Start with what your puppy is doing now.
      </Empty>
    );
  return (
    <ol className={`timeline ${compact ? "compact" : ""}`}>
      {events.map((e) => {
        const pending = j.state.queue.some((q) => q.record.id === e.id);
        return (
          <li key={e.id}>
            <time dateTime={e.at}>{clock(e.at, zone)}</time>
            <ActivityIcon type={e.type} size={20} />
            <div className="timeline-copy">
              <strong>
                {labels[e.type]}
                {e.type === "potty" ? ` · ${e.potty}` : ""}
              </strong>
              <span>
                {e.end
                  ? `${elapsed(e.at, e.end)} · confirmed`
                  : e.estimatedMinutes
                    ? `Estimated ${e.estimatedMinutes} min · unconfirmed`
                    : durations.includes(e.type)
                      ? "Still running"
                      : e.outcome
                        ? e.outcome.replaceAll("-", " ")
                        : "Recorded"}
                {e.accident === "yes" ? " · Accident" : ""}
                {e.tripId ? " · Linked to outside" : ""}
              </span>
              {!j.locked && e.notes && <p>{e.notes}</p>}
              <small>
                {e.actor || e.source || "Caregiver"}
                {pending ? " · Waiting to sync" : ""}
              </small>
            </div>
            {!j.locked && (
              <button
                className="icon-button edit-entry"
                aria-label={`Edit ${labels[e.type].toLowerCase()} at ${clock(e.at, zone)}`}
                onClick={() => onEdit(e)}
              >
                <Pencil size={17} />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
