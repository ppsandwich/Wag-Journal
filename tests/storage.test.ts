import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  queueMutation,
  readLocal,
  writeLocal,
  mergeRemote,
  settleMutation,
  resolveMutation,
} from "../src/lib/storage";
import { emptySnapshot, uid, now } from "../src/lib/domain";
import type { Event } from "../src/lib/domain";
const event = (): Event => ({
  id: uid(),
  householdId: uid(),
  version: 0,
  updatedAt: now(),
  at: now(),
  type: "meal",
});
describe("durable offline writes", () => {
  it("persists pending entries across store reads", async () => {
    const key = uid(),
      e = event();
    await queueMutation(key, "event", e, false, "Alex");
    const read = await readLocal(key);
    expect(read.queue).toHaveLength(1);
    expect(read.snapshot.events[0].id).toBe(e.id);
  });
  it("serialises simultaneous writes without losing either", async () => {
    const key = uid();
    await Promise.all([
      queueMutation(key, "event", event(), false, "Alex"),
      queueMutation(key, "event", event(), false, "Alex"),
    ]);
    expect((await readLocal(key)).queue).toHaveLength(2);
  });
  it("preserves queued changes when merging account data", async () => {
    const key = uid(),
      e = event();
    await queueMutation(key, "event", e, false, "Alex");
    await mergeRemote(key, emptySnapshot());
    expect((await readLocal(key)).snapshot.events).toHaveLength(1);
  });
  it("chains versions for offline corrections", async () => {
    const key = uid(),
      e = event();
    await queueMutation(key, "event", e, false, "Alex");
    await queueMutation(
      key,
      "event",
      { ...e, notes: "Correction" },
      false,
      "Alex",
    );
    expect((await readLocal(key)).queue.map((q) => q.expectedVersion)).toEqual([
      0, 1,
    ]);
  });
  it("retains conflicts and removes dependent edits when choosing remote", async () => {
    const key = uid(),
      e = event();
    const { mutation } = await queueMutation(key, "event", e, false, "Alex");
    await queueMutation(
      key,
      "event",
      { ...e, notes: "Later edit" },
      false,
      "Alex",
    );
    await settleMutation(key, mutation.id, {
      message: "Conflict",
      current: { ...e, version: 3, notes: "Remote" },
    });
    await resolveMutation(key, mutation.id, "remote");
    const state = await readLocal(key);
    expect(state.queue).toHaveLength(0);
    expect(state.snapshot.events[0].notes).toBe("Remote");
  });
  it("partitions accounts", async () => {
    const a = uid(),
      b = uid();
    await queueMutation(a, "event", event(), false, "Alex");
    expect((await readLocal(b)).snapshot.events).toHaveLength(0);
  });
});
