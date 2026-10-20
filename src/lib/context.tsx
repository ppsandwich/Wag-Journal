import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { api, ApiError, supabase } from "./api";
import {
  applyMutation,
  clearLocal,
  mergeRemote,
  queueMutation,
  readLocal,
  resolveMutation,
  settleMutation,
  writeLocal,
} from "./storage";
import type { LocalState } from "./storage";
import { emptySnapshot, entityKeys, now, sampleData } from "./domain";
import type {
  Entity,
  RecordType,
  Snapshot,
  Household,
  Mutation,
} from "./domain";
type Kiosk = { token: string; id: string; householdId: string; name: string };
type Toast = { text: string; undo?: () => void; details?: () => void };
type Context = {
  state: LocalState;
  household?: Household;
  householdId: string;
  selectHousehold: (id: string) => void;
  userId: string;
  user: User | null;
  demo: boolean;
  kiosk: Kiosk | null;
  locked: boolean;
  online: boolean;
  loading: boolean;
  syncing: boolean;
  error: string;
  toast: Toast | null;
  notify: (text: string, undo?: () => void) => void;
  setError: (s: string) => void;
  mutate: (entity: Entity, record: RecordType) => Promise<void>;
  sync: () => Promise<void>;
  startDemo: () => Promise<void>;
  leave: () => Promise<void>;
  resolve: (id: string, choice: "mine" | "remote") => Promise<void>;
  refresh: () => Promise<void>;
  pair: (k: Kiosk) => Promise<void>;
  unlock: () => void;
  allData: () => Promise<Snapshot>;
};
const C = createContext<Context>(null!);
export const useJournal = () => useContext(C);
export function JournalProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(!supabase);
  const [demo, setDemo] = useState(
    () => location.pathname.replace(/\/$/, "") === "/sample",
  );
  const [kiosk, setKiosk] = useState<Kiosk | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("wag-kiosk") || "null");
    } catch {
      return null;
    }
  });
  const [unlocked, setUnlocked] = useState(false);
  const locked = Boolean(kiosk && !unlocked);
  const key = locked
    ? `kiosk:${kiosk!.id}`
    : demo
      ? "demo"
      : user
        ? `user:${user.id}`
        : "";
  const userId = locked
    ? kiosk!.id
    : demo
      ? "sample-caregiver"
      : user?.id || "";
  const [state, setState] = useState<LocalState>({
    snapshot: emptySnapshot(),
    queue: [],
  });
  const [householdId, setHouseholdId] = useState(
    localStorage.getItem("wag-household") || "",
  );
  const [online, setOnline] = useState(navigator.onLine),
    [loading, setLoading] = useState(true),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState<Toast | null>(null);
  const busy = useRef(false),
    activeKey = useRef(key);
  activeKey.current = key;
  const notify = useCallback(
    (text: string, undo?: () => void) => setToast({ text, undo }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (_e === "PASSWORD_RECOVERY")
        sessionStorage.setItem("wag-recovery", "true");
      setUser(s?.user || null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const up = () => setOnline(true),
      down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!key) return;
    if (demo && !locked) {
      setState(await readLocal(key));
      return;
    }
    const remote = await api<Snapshot>(
      "snapshot",
      {},
      locked ? kiosk?.token : undefined,
    );
    if (activeKey.current !== key) return;
    const next = await mergeRemote(key, remote);
    setState(next);
  }, [key, demo, locked, kiosk]);
  const sync = useCallback(async () => {
    if (!key || !navigator.onLine || busy.current) return;
    if (demo && !locked) {
      setState(await readLocal(key));
      return;
    }
    const run = async () => {
      busy.current = true;
      setSyncing(true);
      try {
        let local = await readLocal(key);
        for (const m of local.queue) {
          if (m.conflict) continue;
          if (
            local.queue.some((q) => q.conflict && q.record.id === m.record.id)
          )
            continue;
          try {
            await api<{ record: RecordType }>(
              "mutate",
              m,
              locked ? kiosk?.token : undefined,
            );
            await settleMutation(key, m.id);
            local = await readLocal(key);
          } catch (e) {
            if (e instanceof ApiError && [400, 409].includes(e.status)) {
              await settleMutation(key, m.id, {
                message: e.message,
                current: e.current as RecordType | undefined,
              });
              local = await readLocal(key);
              continue;
            }
            throw e;
          }
        }
        if (activeKey.current === key) {
          setState(await readLocal(key));
          await refresh();
          setError("");
        }
      } catch (e) {
        if (activeKey.current === key) {
          setError(
            e instanceof Error
              ? e.message
              : "Waiting for a connection. Your pending entries are safe.",
          );
          if (e instanceof ApiError && e.status === 403) {
            const pending = (await readLocal(key)).queue;
            if (pending.length) {
              try {
                for (let i = 0; i < pending.length; i += 100) {
                  const batch = pending.slice(i, i + 100);
                  await api(
                    "quarantine",
                    {
                      id: batch[0].id,
                      householdId: batch[0].record.householdId,
                      changes: batch,
                    },
                    locked ? kiosk?.token : undefined,
                  );
                }
                setError(
                  "Access was removed. Pending entries were sent to the owner for review and remain on this device.",
                );
              } catch {
                /* Preserve pending entries if upload fails. */
              }
            }
            setState({
              snapshot: emptySnapshot(),
              queue: (await readLocal(key)).queue,
            });
          }
        }
      } finally {
        busy.current = false;
        setSyncing(false);
      }
    };
    if (navigator.locks)
      await navigator.locks.request(
        `wag-sync-${key}`,
        { ifAvailable: true },
        async (lock) => {
          if (lock) await run();
        },
      );
    else await run();
  }, [key, demo, locked, kiosk, refresh]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    if (!key) {
      setState({ snapshot: emptySnapshot(), queue: [] });
      setLoading(false);
      return;
    }
    readLocal(key)
      .then(async (s) => {
        if (key === "demo" && !s.snapshot.households.length) {
          s = { snapshot: sampleData(), queue: [] };
          await writeLocal(key, s);
        }
        return s;
      })
      .then((s) => {
        if (!cancelled) {
          setState(s);
          setLoading(false);
          void sync();
        }
      })
      .catch(() => {
        setError(
          "Device storage is unavailable. Entries cannot be saved. Check browser storage settings.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  useEffect(() => {
    if (!online) return;
    void sync();
    const interval = setInterval(() => void sync(), 4000);
    return () => clearInterval(interval);
  }, [sync, online]);
  useEffect(() => {
    if (!kiosk || !unlocked) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const personalKey = activeKey.current;
        if (personalKey.startsWith("user:"))
          void readLocal(personalKey).then((local) =>
            writeLocal(personalKey, {
              snapshot: emptySnapshot(),
              queue: local.queue,
            }),
          );
        setUnlocked(false);
        void supabase?.auth.signOut();
      }, 120000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [kiosk, unlocked]);
  const household =
    state.snapshot.households.find((h) => h.id === householdId) ||
    state.snapshot.households[0];
  const selectHousehold = (id: string) => {
    setHouseholdId(id);
    localStorage.setItem("wag-household", id);
  };
  const mutate = async (entity: Entity, record: RecordType) => {
    if (!key) throw Error("Sign in before recording.");
    try {
      const actor = locked
        ? kiosk!.name
        : demo
          ? "You"
          : state.snapshot.members.find((m) => m.id === userId)?.name ||
            "Caregiver";
      const result = await queueMutation(
        key,
        entity,
        record,
        demo && !locked,
        actor,
      );
      setState(result.state);
      void sync();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "This entry has not been saved. Check device storage and try again.";
      setError(message);
      throw e;
    }
  };
  const startDemo = async () => {
    window.location.assign("/sample");
  };
  const leave = async () => {
    if (demo && !locked) {
      // Leaving the sample must not delete its entries or sign out an account.
      window.location.assign("/");
      return;
    }
    if (
      state.queue.length &&
      !window.confirm(
        `${state.queue.length} entries have not reached the account. Discard these pending entries and sign out? Choose Cancel to stay and sync.`,
      )
    )
      return;
    await clearLocal(key);
    if (kiosk) {
      localStorage.removeItem("wag-kiosk");
      setKiosk(null);
    }
    localStorage.removeItem("wag-mode");
    setDemo(false);
    await supabase?.auth.signOut();
    setUser(null);
    setState({ snapshot: emptySnapshot(), queue: [] });
  };
  const resolve = async (id: string, choice: "mine" | "remote") => {
    setState(await resolveMutation(key, id, choice));
    await sync();
  };
  const pair = async (k: Kiosk) => {
    await clearLocal(key);
    localStorage.setItem("wag-kiosk", JSON.stringify(k));
    setKiosk(k);
    setUnlocked(false);
    setDemo(false);
    await supabase?.auth.signOut();
  };
  const allData = async () => {
    if (!navigator.onLine)
      throw Error("Connect to the internet to export the complete diary.");
    if (demo) return state.snapshot;
    await sync();
    if ((await readLocal(key)).queue.length)
      throw Error(
        "Resolve pending entries before exporting the complete diary.",
      );
    return api<Snapshot>("snapshot", { all: true });
  };
  return (
    <C.Provider
      value={{
        state,
        household,
        householdId: household?.id || "",
        selectHousehold,
        userId,
        user,
        demo,
        kiosk,
        locked,
        online,
        loading: loading || !authReady,
        syncing,
        error,
        toast,
        notify,
        setError,
        mutate,
        sync,
        startDemo,
        leave,
        resolve,
        refresh,
        pair,
        unlock: () => setUnlocked(true),
        allData,
      }}
    >
      {children}
    </C.Provider>
  );
}
