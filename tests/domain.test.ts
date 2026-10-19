import { describe, it, expect } from "vitest";
import {
  activities,
  atTime,
  day,
  elapsed,
  matchPlan,
  occurrences,
  summary,
  validateEvent,
  eventsCSV,
  checkConstraints,
  timelineSegment,
} from "../src/lib/domain";
import type { Event, Routine, Constraint } from "../src/lib/domain";
const base = {
  id: "event-1",
  householdId: "house-1",
  version: 1,
  updatedAt: "2026-10-19T00:00:00Z",
};
const event = (overrides: Partial<Event> = {}): Event => ({
  ...base,
  type: "outside",
  at: "2026-10-19T00:00:00Z",
  ...overrides,
});
const routine = (items: Routine["items"]): Routine => ({
  ...base,
  id: "routine-1",
  effectiveDate: "2026-01-01",
  items,
});
describe("care records", () => {
  it("includes seven activities", () => expect(activities).toHaveLength(7));
  it("never counts crate occupancy as sleep", () =>
    expect(
      summary([event({ type: "crate", end: "2026-10-19T01:00:00Z" })])
        .sleepMinutes,
    ).toBe(0));
  it("keeps sleep estimates separate from confirmed durations", () => {
    const s = summary([event({ type: "sleep", estimatedMinutes: 90 })]);
    expect(s.sleepMinutes).toBe(0);
    expect(s.estimatedSleep).toBe(90);
    expect(s.confirmedSleep).toBe(0);
  });
  it("does not count an unknown trip as a failure", () => {
    const s = summary([event(), event({ id: "trip-2", outcome: "no-result" })]);
    expect(s.knownTrips).toBe(1);
    expect(s.unknownTrips).toBe(1);
  });
  it("counts multiple potty results as one successful trip", () => {
    const s = summary([
      event(),
      event({ id: "p1", type: "potty", potty: "wee", tripId: "event-1" }),
      event({ id: "p2", type: "potty", potty: "poo", tripId: "event-1" }),
    ]);
    expect(s.successfulTrips).toBe(1);
    expect(s.counts.potty).toBe(2);
  });
  it("excludes play trips from toilet success rates", () => {
    expect(
      summary([event({ purpose: "play", outcome: "no-result" })]).knownTrips,
    ).toBe(0);
  });
  it("rejects simultaneous sessions of the same type but allows valid overlap", () => {
    expect(() => validateEvent(event({ id: "other" }), [event()])).toThrow(
      /already/,
    );
    expect(() =>
      validateEvent(event({ id: "other", type: "play" }), [event()]),
    ).not.toThrow();
  });
  it("rejects future and reversed times", () => {
    expect(() =>
      validateEvent(event({ at: "2099-01-01T00:00:00Z" }), []),
    ).toThrow(/past/);
    expect(() =>
      validateEvent(event({ end: "2026-10-18T00:00:00Z" }), []),
    ).toThrow(/end/);
  });
  it("preserves unknown accident status and prevents spreadsheet formula execution", () => {
    const csv = eventsCSV(
      [event({ type: "potty", potty: "wee", notes: ' =HYPERLINK("bad")' })],
      "UTC",
    );
    expect(csv).toContain("unknown");
    expect(csv).toContain("' =HYPERLINK");
  });
});
describe("routine and timezone semantics", () => {
  it("does not trigger wake prompts from estimates", () => {
    const r = routine([
      {
        id: "after-wake",
        type: "outside",
        time: "07:00",
        days: [0, 1, 2, 3, 4, 5, 6],
        trigger: "wake",
        offset: 5,
      },
    ]);
    expect(
      occurrences(
        [r],
        [event({ type: "sleep", estimatedMinutes: 60 })],
        "2026-10-19",
        "UTC",
      ),
    ).toHaveLength(0);
  });
  it("does trigger a relative prompt after confirmed waking", () => {
    const r = routine([
      {
        id: "wake",
        type: "outside",
        time: "07:00",
        days: [0, 1, 2, 3, 4, 5, 6],
        trigger: "wake",
        offset: 5,
      },
    ]);
    expect(
      occurrences(
        [r],
        [event({ type: "sleep", end: "2026-10-19T01:00:00Z" })],
        "2026-10-19",
        "UTC",
      )[0].at,
    ).toBe("2026-10-19T01:05:00.000Z");
  });
  it("leaves ambiguous schedule matches unlinked", () => {
    const plans = occurrences(
      [
        routine([
          { id: "a", type: "meal", time: "00:00", days: [1] },
          { id: "b", type: "meal", time: "00:10", days: [1] },
        ]),
      ],
      [],
      "2026-10-19",
      "UTC",
    );
    expect(matchPlan(event({ type: "meal" }), plans)).toBeUndefined();
  });
  it("matches unique eligible occurrences and never fulfilled ones", () => {
    const r = routine([{ id: "a", type: "meal", time: "00:00", days: [1] }]);
    const plans = occurrences([r], [], "2026-10-19", "UTC");
    expect(matchPlan(event({ type: "meal" }), plans)).toBe(plans[0].id);
    plans[0].fulfilled = event();
    expect(matchPlan(event({ type: "meal" }), plans)).toBeUndefined();
  });
  it("merges relative outside prompts into a nearby manual opportunity", () => {
    const r = routine([
      { id: "a", type: "outside", time: "00:10", days: [1] },
      {
        id: "b",
        type: "outside",
        time: "00:00",
        days: [1],
        trigger: "meal",
        offset: 5,
      },
    ]);
    const p = occurrences([r], [event({ type: "meal" })], "2026-10-19", "UTC");
    expect(p).toHaveLength(1);
    expect(p[0].reasons).toContain("After a meal");
    expect(p[0].item.id).toBe("a");
  });
  it("retains historical routine versions", () => {
    const r = routine([{ id: "a", type: "meal", time: "07:00", days: [1] }]),
      later = { ...r, id: "later", effectiveDate: "2026-10-20", items: [] };
    expect(occurrences([r, later], [], "2026-10-19", "UTC")).toHaveLength(1);
  });
  it("uses absolute elapsed time across daylight saving", () => {
    expect(elapsed("2026-10-03T15:30:00Z", "2026-10-03T16:30:00Z")).toBe(
      "1 hr",
    );
    expect(day("2026-10-03T16:30:00Z", "Australia/Melbourne")).toBe(
      "2026-10-04",
    );
  });
  it("chooses one repeated clock occurrence", () => {
    expect(atTime("2026-04-05", "02:30", "Australia/Melbourne")).toBe(
      "2026-04-04T15:30:00Z",
    );
  });
  it("protects structured care bounds", () => {
    const c: Constraint = {
      ...base,
      type: "meal",
      earliest: "08:00",
      instruction: "After morning medication",
      source: "Vet",
    };
    expect(
      checkConstraints(
        [{ id: "meal", type: "meal", time: "07:00", days: [1] }],
        [c],
      ),
    ).toHaveLength(1);
  });
});
it("moves a nonexistent clock time to the first valid instant", () => {
  expect(atTime("2026-10-04", "02:30", "Australia/Melbourne")).toBe(
    "2026-10-03T16:00:00Z",
  );
});
it("preserves earlier plans when the routine changes during a day", () => {
  const old = routine([
    { id: "early", type: "meal", time: "07:00", days: [1] },
    { id: "late", type: "meal", time: "18:00", days: [1] },
  ]);
  const edited = {
    ...old,
    id: "edited",
    effectiveDate: "2026-10-19",
    effectiveAt: "2026-10-19T12:00:00Z",
    items: [
      { id: "early", type: "meal" as const, time: "08:00", days: [1] },
      { id: "late", type: "meal" as const, time: "19:00", days: [1] },
    ],
  };
  const result = occurrences([old, edited], [], "2026-10-19", "UTC");
  expect(result.map((x) => x.item.time)).toEqual(["07:00", "19:00"]);
});
it("applies an occurrence exception without changing the following week", () => {
  const r = routine([
    {
      id: "meal",
      type: "meal",
      time: "07:00",
      days: [1],
      exceptions: { "2026-10-19": { time: "08:00", skipped: false } },
    },
  ]);
  expect(occurrences([r], [], "2026-10-19", "UTC")[0].item.time).toBe("08:00");
  expect(occurrences([r], [], "2026-10-26", "UTC")[0].item.time).toBe("07:00");
});

describe("duration timeline", () => {
  it("clips a confirmed session across midnight without losing elapsed minutes", () => {
    const e = event({
      type: "sleep",
      at: "2026-10-18T23:30:00Z",
      end: "2026-10-19T01:00:00Z",
    });
    expect(timelineSegment(e, "2026-10-18", "UTC")?.minutes).toBe(30);
    expect(timelineSegment(e, "2026-10-19", "UTC")?.minutes).toBe(60);
    expect(timelineSegment(e, "2026-10-20", "UTC")).toBeUndefined();
  });
  it("preserves estimated and running labels", () => {
    expect(
      timelineSegment(
        event({ type: "sleep", estimatedMinutes: 60 }),
        "2026-10-19",
        "UTC",
      )?.state,
    ).toBe("estimated");
    expect(
      timelineSegment(
        event({ type: "sleep" }),
        "2026-10-19",
        "UTC",
        Date.parse("2026-10-19T00:30:00Z"),
      )?.minutes,
    ).toBe(30);
  });
});
