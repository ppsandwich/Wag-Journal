import { openDB } from "idb";
import { emptySnapshot, entityKeys, now, uid } from "./domain";
import type { Snapshot, Mutation, Entity, RecordType } from "./domain";
export type LocalState = { snapshot: Snapshot; queue: Mutation[] };
const db = () =>
  openDB("wag-journal-v1", 1, {
    upgrade(d) {
      d.createObjectStore("accounts");
    },
  });
export async function readLocal(key: string): Promise<LocalState> {
  return (
    (await (await db()).get("accounts", key)) || {
      snapshot: emptySnapshot(),
      queue: [],
    }
  );
}
export async function writeLocal(key: string, value: LocalState) {
  const d = await db();
  await d.put("accounts", value, key);
}
export async function clearLocal(key: string) {
  await (await db()).delete("accounts", key);
}
export function applyMutation(snapshot: Snapshot, m: Mutation) {
  const key = entityKeys[m.entity];
  const next = structuredClone(snapshot);
  const records = next[key] as RecordType[];
  const index = records.findIndex((r) => r.id === m.record.id);
  if (index >= 0) records[index] = m.record;
  else records.push(m.record);
  return next;
}
export async function queueMutation(
  key: string,
  entity: Entity,
  record: RecordType,
  demo: boolean,
  actor: string,
) {
  const d = await db();
  const tx = d.transaction("accounts", "readwrite");
  const state: LocalState = (await tx.store.get(key)) || {
    snapshot: emptySnapshot(),
    queue: [],
  };
  const records = state.snapshot[entityKeys[entity]] as RecordType[];
  const before = records.find((r) => r.id === record.id);
  const base = before?.version || 0;
  const m: Mutation = {
    id: uid(),
    entity,
    expectedVersion: base,
    record: { ...record, version: base + 1, updatedAt: now(), actor },
    createdAt: now(),
  };
  state.snapshot = applyMutation(state.snapshot, m);
  if (demo) {
    state.snapshot.history.unshift({
      id: m.id,
      entity,
      recordId: record.id,
      at: now(),
      actor,
      before: (before || null) as any,
      after: m.record as any,
    });
  } else state.queue.push(m);
  await tx.store.put(state, key);
  await tx.done;
  return { state, mutation: m, before };
}
export async function mergeRemote(key: string, remote: Snapshot) {
  const d = await db();
  const tx = d.transaction("accounts", "readwrite");
  const old: LocalState = (await tx.store.get(key)) || {
    snapshot: emptySnapshot(),
    queue: [],
  };
  let snapshot = remote;
  for (const m of old.queue) snapshot = applyMutation(snapshot, m);
  const value = { snapshot, queue: old.queue };
  await tx.store.put(value, key);
  await tx.done;
  return value;
}
export async function settleMutation(
  key: string,
  id: string,
  conflict?: Mutation["conflict"],
) {
  const d = await db();
  const tx = d.transaction("accounts", "readwrite");
  const old: LocalState = await tx.store.get(key);
  if (old) {
    old.queue = conflict
      ? old.queue.map((m) => (m.id === id ? { ...m, conflict } : m))
      : old.queue.filter((m) => m.id !== id);
    await tx.store.put(old, key);
  }
  await tx.done;
  return old;
}
export async function resolveMutation(
  key: string,
  id: string,
  choice: "remote" | "mine",
) {
  const d = await db();
  const tx = d.transaction("accounts", "readwrite");
  const old: LocalState = await tx.store.get(key);
  const m = old.queue.find((m) => m.id === id);
  if (!m) throw Error("This change has already been resolved.");
  const current = m.conflict?.current;
  if (choice === "mine") {
    m.expectedVersion = current?.id === m.record.id ? current.version : 0;
    if (m.entity === "routine" && current && current.id !== m.record.id)
      (m.record as any).baseRoutineId = current.id;
    m.record.version = m.expectedVersion + 1;
    m.id = uid();
    delete m.conflict;
  } else {
    old.queue = old.queue.filter((q) => q.record.id !== m.record.id);
    if (current)
      old.snapshot = applyMutation(old.snapshot, { ...m, record: current });
    else {
      const k = entityKeys[m.entity];
      (old.snapshot[k] as RecordType[]) = (
        old.snapshot[k] as RecordType[]
      ).filter((r) => r.id !== m.record.id);
    }
  }
  await tx.store.put(old, key);
  await tx.done;
  return old;
}
