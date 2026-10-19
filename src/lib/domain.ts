import { Temporal } from "@js-temporal/polyfill";
export const activities = [
  "outside",
  "potty",
  "meal",
  "play",
  "training",
  "crate",
  "sleep",
] as const;
export type Activity = (typeof activities)[number];
export const labels: Record<Activity, string> = {
  outside: "Outside",
  potty: "Potty",
  meal: "Meal",
  play: "Play",
  training: "Training",
  crate: "Crate",
  sleep: "Sleep",
};
export const durations: Activity[] = [
  "outside",
  "play",
  "training",
  "crate",
  "sleep",
];
export type Base = {
  id: string;
  householdId: string;
  version: number;
  updatedAt: string;
  deletedAt?: string;
  actor?: string;
};
export type Event = Base & {
  type: Activity;
  at: string;
  end?: string;
  estimatedMinutes?: number;
  potty?: "wee" | "poo" | "both";
  location?: "outside" | "inside" | "unknown";
  accident?: "yes" | "no" | "unknown";
  purpose?: "toilet" | "play" | "other";
  outcome?: string;
  tripId?: string;
  crateId?: string;
  previousSleepId?: string;
  settlingMinutes?: number;
  amount?: string;
  unit?: string;
  skill?: string;
  notes?: string;
  planId?: string;
  source?: string;
};
export type PlanItem = {
  id: string;
  type: Activity;
  time: string;
  days: number[];
  duration?: number;
  trigger?: "meal" | "wake";
  offset?: number;
  onDate?: string;
  skipped?: boolean;
  exceptions?: Record<
    string,
    { time: string; skipped: boolean; duration?: number }
  >;
};
export type Routine = Base & {
  effectiveDate: string;
  effectiveAt?: string;
  items: PlanItem[];
  baseRoutineId?: string;
  note?: string;
};
export type Check = Base & {
  date: string;
  status: "complete" | "gaps" | "unsure";
  notes?: string;
};
export type Constraint = Base & {
  type: Activity;
  earliest?: string;
  latest?: string;
  instruction: string;
  source: string;
};
export type Preference = Base & {
  userId: string;
  mutedUntil?: string;
  quietStart?: string;
  quietEnd?: string;
  wakeTime: string;
  presets: Partial<Record<Activity, number>>;
  snoozes: Record<string, string>;
};
export type Household = {
  id: string;
  name: string;
  puppy: string;
  birthDate: string;
  timezone: string;
  ownerId: string;
  deletionAt?: string;
  version: number;
};
export type Member = {
  id: string;
  householdId: string;
  name: string;
  role: "owner" | "caregiver";
};
export type Device = {
  id: string;
  name: string;
  householdId: string;
  revokedAt?: string;
};
export type History = {
  id: string;
  entity: string;
  recordId: string;
  at: string;
  actor: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
};
export type Snapshot = {
  households: Household[];
  members: Member[];
  events: Event[];
  routines: Routine[];
  checks: Check[];
  constraints: Constraint[];
  preferences: Preference[];
  devices: Device[];
  history: History[];
};
export type Entity =
  "event" | "routine" | "check" | "constraint" | "preference";
export type RecordType = Event | Routine | Check | Constraint | Preference;
export const entityKeys = {
  event: "events",
  routine: "routines",
  check: "checks",
  constraint: "constraints",
  preference: "preferences",
} as const;
export type Mutation = {
  id: string;
  entity: Entity;
  record: RecordType;
  expectedVersion: number;
  createdAt: string;
  conflict?: { message: string; current?: RecordType };
};
export const emptySnapshot = (): Snapshot => ({
  households: [],
  members: [],
  events: [],
  routines: [],
  checks: [],
  constraints: [],
  preferences: [],
  devices: [],
  history: [],
});
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const day = (
  instant: string | Date = new Date(),
  zone = "Australia/Melbourne",
) =>
  Temporal.Instant.from(new Date(instant).toISOString())
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
export const addDays = (date: string, n: number) =>
  Temporal.PlainDate.from(date).add({ days: n }).toString();
export function atTime(date: string, time: string, zone: string) {
  const requested = Temporal.PlainDateTime.from(`${date}T${time}`);
  let zoned = Temporal.ZonedDateTime.from(`${date}T${time}[${zone}]`, {
    disambiguation: "compatible",
  });
  // For a spring-forward gap use its first valid clock time, not the requested minute shifted by an hour.
  if (Temporal.PlainDateTime.compare(zoned.toPlainDateTime(), requested) > 0) {
    for (let i = 0; i < 1440; i++) {
      const previous = zoned.subtract({ minutes: 1 });
      if (
        Temporal.PlainDateTime.compare(previous.toPlainDateTime(), requested) <
        0
      )
        break;
      zoned = previous;
    }
  }
  return zoned.toInstant().toString();
}
export const clock = (at: string, zone: string) =>
  new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(new Date(at));
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export function elapsed(at: string, end = now()) {
  const min = Math.max(
    0,
    Math.floor((Date.parse(end) - Date.parse(at)) / 60000),
  );
  return min < 1
    ? "Just now"
    : min < 60
      ? `${min} min`
      : `${Math.floor(min / 60)} hr${min % 60 ? ` ${min % 60} min` : ""}`;
}
export const isActive = (e: Event) =>
  !e.deletedAt && durations.includes(e.type) && !e.end;
export const liveEvents = (events: Event[]) =>
  events.filter((e) => !e.deletedAt).sort((a, b) => b.at.localeCompare(a.at));
export function validateEvent(
  e: Event,
  events: Event[],
  reference = Date.now(),
) {
  if (!activities.includes(e.type) || !Number.isFinite(Date.parse(e.at)))
    throw Error("Choose an activity and a valid time.");
  if (Date.parse(e.at) > reference + 1000)
    throw Error(
      "Activities must be now or in the past. Check your device clock.",
    );
  if (
    e.end &&
    (Date.parse(e.end) < Date.parse(e.at) ||
      Date.parse(e.end) > reference + 1000)
  )
    throw Error("The end must be after the start and not in the future.");
  if (e.type === "potty" && !e.potty) throw Error("Choose wee, poo or both.");
  if (
    e.estimatedMinutes !== undefined &&
    (!Number.isFinite(e.estimatedMinutes) ||
      e.estimatedMinutes <= 0 ||
      e.estimatedMinutes > 1440)
  )
    throw Error("Enter an estimate from 1 to 1,440 minutes.");
  if (e.settlingMinutes !== undefined && e.settlingMinutes < 0)
    throw Error("Settling time cannot be negative.");
  if ((e.notes?.length || 0) > 4000)
    throw Error("Keep notes under 4,000 characters.");
  if (
    isActive(e) &&
    events.some(
      (x) =>
        x.id !== e.id &&
        x.householdId === e.householdId &&
        x.type === e.type &&
        isActive(x),
    )
  )
    throw Error(
      `There is already a ${labels[e.type].toLowerCase()} session running. End or correct it first.`,
    );
}
export function activeRoutine(routines: Routine[], date: string) {
  return routines
    .filter((r) => !r.deletedAt && r.effectiveDate <= date)
    .sort(
      (a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )[0];
}
export type Occurrence = {
  id: string;
  item: PlanItem;
  at: string;
  routineId: string;
  fulfilled?: Event;
  reasons: string[];
};
export function occurrences(
  routines: Routine[],
  events: Event[],
  date: string,
  zone: string,
): Occurrence[] {
  const versions = routines
    .filter((r) => !r.deletedAt && r.effectiveDate <= date)
    .sort(
      (a, b) =>
        (a.effectiveAt || atTime(a.effectiveDate, "00:00", zone)).localeCompare(
          b.effectiveAt || atTime(b.effectiveDate, "00:00", zone),
        ) || a.updatedAt.localeCompare(b.updatedAt),
    );
  if (!versions.length) return [];
  const weekday = Temporal.PlainDate.from(date).dayOfWeek % 7;
  const live = liveEvents(events);
  const result: Occurrence[] = [];
  for (let vi = 0; vi < versions.length; vi++) {
    const r = versions[vi];
    const start = Date.parse(
        r.effectiveAt || atTime(r.effectiveDate, "00:00", zone),
      ),
      next = versions[vi + 1],
      until = next
        ? Date.parse(
            next.effectiveAt || atTime(next.effectiveDate, "00:00", zone),
          )
        : Infinity;
    const inWindow = (at: string) =>
      Date.parse(at) >= start && Date.parse(at) < until;
    for (const original of r.items) {
      const item = { ...original, ...original.exceptions?.[date] };
      if (
        item.skipped ||
        (item.onDate && item.onDate !== date) ||
        (!item.onDate && !item.days.includes(weekday))
      )
        continue;
      if (!item.trigger) {
        if (!inWindow(atTime(date, item.time, zone))) continue;
        const id = `${r.id}:${item.id}:${date}`;
        result.push({
          id,
          item,
          at: atTime(date, item.time, zone),
          routineId: r.id,
          fulfilled: live.find((e) => e.planId === id),
          reasons: ["Your routine"],
        });
      } else
        for (const e of live) {
          const anchor =
            item.trigger === "meal" && e.type === "meal"
              ? e.at
              : item.trigger === "wake" && e.type === "sleep"
                ? e.end
                : undefined;
          if (!anchor) continue;
          const at = new Date(
            Date.parse(anchor) + (item.offset || 0) * 60000,
          ).toISOString();
          if (day(at, zone) !== date || !inWindow(at)) continue;
          const id = `${r.id}:${item.id}:${e.id}`;
          result.push({
            id,
            item,
            at,
            routineId: r.id,
            fulfilled: live.find((x) => x.planId === id),
            reasons: [
              item.trigger === "meal" ? "After a meal" : "After waking",
            ],
          });
        }
    }
  }
  // A manual outside opportunity wins. Never merge fulfilled occurrences or chain beyond 15 minutes.
  const fixed = result.filter((o) => !o.item.trigger),
    relative = result
      .filter((o) => o.item.trigger)
      .sort((a, b) => a.at.localeCompare(b.at));
  for (const o of relative) {
    const match =
      o.item.type === "outside" && !o.fulfilled
        ? fixed.find(
            (x) =>
              x.item.type === "outside" &&
              !x.fulfilled &&
              Math.abs(Date.parse(x.at) - Date.parse(o.at)) <= 900000,
          )
        : undefined;
    if (match) match.reasons = [...new Set([...match.reasons, ...o.reasons])];
    else fixed.push(o);
  }
  return fixed.sort((a, b) => a.at.localeCompare(b.at));
}
export function matchPlan(event: Event, plans: Occurrence[]) {
  const window = event.type === "meal" ? 30 : 15;
  const eligible = plans.filter(
    (p) =>
      p.item.type === event.type &&
      !p.fulfilled &&
      Math.abs(Date.parse(p.at) - Date.parse(event.at)) <= window * 60000,
  );
  return eligible.length === 1 ? eligible[0].id : undefined;
}
export function checkConstraints(items: PlanItem[], constraints: Constraint[]) {
  return constraints
    .filter((c) => !c.deletedAt)
    .flatMap((c) =>
      items
        .flatMap((i) => [
          i,
          ...Object.values(i.exceptions || {}).map((e) => ({ ...i, ...e })),
        ])
        .filter(
          (i) =>
            i.type === c.type &&
            !i.skipped &&
            !i.trigger &&
            ((c.earliest && i.time < c.earliest) ||
              (c.latest && i.time > c.latest)),
        )
        .map(
          (i) =>
            `${labels[i.type]} at ${i.time} conflicts with “${c.instruction}”.`,
        ),
    );
}
export function summary(events: Event[]) {
  const live = liveEvents(events),
    trips = live.filter(
      (e) => e.type === "outside" && (e.purpose || "toilet") === "toilet",
    );
  const known = trips.filter(
    (t) =>
      t.outcome === "no-result" ||
      live.some((e) => e.type === "potty" && e.tripId === t.id),
  );
  const successful = known.filter((t) =>
    live.some((e) => e.type === "potty" && e.tripId === t.id),
  );
  const confirmedSleep = live.filter((e) => e.type === "sleep" && e.end);
  return {
    counts: Object.fromEntries(
      activities.map((a) => [a, live.filter((e) => e.type === a).length]),
    ) as Record<Activity, number>,
    accidents: live.filter((e) => e.type === "potty" && e.accident === "yes")
      .length,
    unknownAccidents: live.filter(
      (e) => e.type === "potty" && (!e.accident || e.accident === "unknown"),
    ).length,
    toiletTrips: trips.length,
    knownTrips: known.length,
    successfulTrips: successful.length,
    unknownTrips: trips.length - known.length,
    excludedTrips: live.filter(
      (e) => e.type === "outside" && e.purpose && e.purpose !== "toilet",
    ).length,
    unlinkedPotty: live.filter((e) => e.type === "potty" && !e.tripId).length,
    sleepMinutes: confirmedSleep.reduce(
      (n, e) => n + (Date.parse(e.end!) - Date.parse(e.at)) / 60000,
      0,
    ),
    confirmedSleep: confirmedSleep.length,
    estimatedSleep: live
      .filter((e) => e.type === "sleep" && !e.end && e.estimatedMinutes)
      .reduce((n, e) => n + (e.estimatedMinutes || 0), 0),
  };
}
export function csvCell(v: unknown) {
  let s = v == null ? "unknown" : String(v);
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
/** Clip a session to a household calendar day without treating estimates as observed ends. */
export function timelineSegment(
  e: Event,
  date: string,
  zone: string,
  current = Date.now(),
) {
  const start = Date.parse(e.at),
    floor = Date.parse(atTime(date, "00:00", zone)),
    ceiling = Date.parse(atTime(addDays(date, 1), "00:00", zone));
  const state = e.end
    ? "confirmed"
    : e.estimatedMinutes
      ? "estimated"
      : durations.includes(e.type)
        ? "running"
        : "point";
  const finish = e.end
    ? Date.parse(e.end)
    : e.estimatedMinutes
      ? start + e.estimatedMinutes * 60000
      : state === "running"
        ? current
        : start;
  if (start >= ceiling || finish < floor || (finish === floor && start < floor))
    return undefined;
  const position = (instant: number) => {
    if (instant <= floor) return 0;
    if (instant >= ceiling) return 100;
    const t =
      Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(zone);
    return ((t.hour * 60 + t.minute + t.second / 60) / 1440) * 100;
  };
  const left = position(Math.max(start, floor)),
    right = position(Math.min(finish, ceiling));
  return {
    left,
    width: Math.max(0, right - left),
    state,
    minutes:
      Math.max(0, Math.min(finish, ceiling) - Math.max(start, floor)) / 60000,
  };
}
export function eventsCSV(events: Event[], zone: string) {
  const columns = [
    "id",
    "type",
    "at",
    "end",
    "estimatedMinutes",
    "potty",
    "location",
    "accident",
    "purpose",
    "outcome",
    "tripId",
    "crateId",
    "planId",
    "notes",
    "amount",
    "unit",
    "skill",
    "settlingMinutes",
    "previousSleepId",
    "updatedAt",
    "version",
    "source",
    "actor",
    "timezone",
  ];
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(","),
      ...liveEvents(events).map((e) =>
        columns
          .map((k) => csvCell(k === "timezone" ? zone : e[k as keyof Event]))
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function filterEvents(
  events: Event[],
  from: string,
  to: string,
  zone: string,
  type: Activity | "all" = "all",
) {
  return liveEvents(events).filter(
    (e) =>
      day(e.at, zone) >= from &&
      day(e.at, zone) <= to &&
      (type === "all" || e.type === type),
  );
}
export function preferencesFor(
  s: Snapshot,
  h: string,
  user: string,
): Preference {
  return (
    s.preferences.find((p) => p.householdId === h && p.userId === user) || {
      id: uid(),
      householdId: h,
      version: 0,
      updatedAt: now(),
      userId: user,
      wakeTime: "07:00",
      presets: {},
      snoozes: {},
    }
  );
}
export function sampleData(): Snapshot {
  const s = emptySnapshot(),
    h = uid(),
    user = "sample-caregiver",
    zone = "Australia/Melbourne",
    today = day(new Date(), zone);
  s.households = [
    {
      id: h,
      name: "Our little household",
      puppy: "Alfie",
      birthDate: addDays(today, -91),
      timezone: zone,
      ownerId: user,
      version: 1,
    },
  ];
  s.members = [{ id: user, householdId: h, name: "You", role: "owner" }];
  const r: Routine = {
    id: uid(),
    householdId: h,
    version: 1,
    updatedAt: now(),
    effectiveDate: addDays(today, -14),
    note: "Sample routine — illustrative, not care advice",
    items: [
      ["outside", "07:00"],
      ["meal", "07:30"],
      ["play", "08:00"],
      ["sleep", "09:00"],
      ["meal", "12:30"],
      ["training", "15:00"],
      ["outside", "17:00"],
      ["meal", "18:00"],
    ].map(([type, time]) => ({
      id: uid(),
      type: type as Activity,
      time,
      days: [0, 1, 2, 3, 4, 5, 6],
    })),
  };
  s.routines = [r];
  for (let d = 6; d >= 0; d--) {
    const date = addDays(today, -d);
    s.checks.push({
      id: uid(),
      householdId: h,
      version: 1,
      updatedAt: now(),
      date,
      status: d === 2 ? "gaps" : "complete",
    });
    for (const [type, time, mins] of [
      ["outside", "07:05", 9],
      ["meal", "07:35", 0],
      ["play", "08:10", 18],
      ["sleep", "09:00", 70],
      ["outside", "11:00", 12],
      ["meal", "12:35", 0],
      ["training", "15:00", 8],
      ["outside", "17:05", 10],
      ["meal", "18:05", 0],
      ["crate", "20:00", 90],
      ["sleep", "20:10", 70],
    ] as [Activity, string, number][]) {
      const at = atTime(date, time, zone);
      if (Date.parse(at) > Date.now()) continue;
      const e: Event = {
        id: uid(),
        householdId: h,
        version: 1,
        updatedAt: now(),
        type,
        at,
        actor: d % 2 ? "Alex" : "You",
        source: "Sample diary",
        ...(mins && Date.parse(at) + mins * 60000 < Date.now()
          ? { end: new Date(Date.parse(at) + mins * 60000).toISOString() }
          : {}),
        purpose: type === "outside" ? "toilet" : undefined,
        outcome:
          type === "meal"
            ? "finished"
            : type === "training"
              ? "engaged"
              : type === "play"
                ? "settled"
                : undefined,
      };
      e.planId = matchPlan(e, occurrences([r], s.events, date, zone));
      s.events.push(e);
      if (type === "outside" && Date.parse(at) + 120000 < Date.now()) {
        s.events.push({
          ...e,
          id: uid(),
          type: "potty",
          at: new Date(Date.parse(at) + 120000).toISOString(),
          end: undefined,
          planId: undefined,
          potty: d % 3 ? "wee" : "both",
          tripId: e.id,
          location: "outside",
          accident: "no",
          purpose: undefined,
          outcome: undefined,
        });
      }
    }
  }
  s.preferences = [preferencesFor(s, h, user)];
  return s;
}
