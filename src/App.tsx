import { useEffect, useState } from "react";
import {
  Sun,
  BookOpen,
  CalendarDays,
  BarChart3,
  Settings,
  WifiOff,
  Cloud,
  RefreshCw,
  Bell,
  BellOff,
  Tablet,
  ArrowRight,
  AlertCircle,
  Check,
  Menu,
  X,
  LockKeyhole,
} from "lucide-react";
import { useJournal } from "./lib/context";
import { now, preferencesFor } from "./lib/domain";
import { api } from "./lib/api";
import { Modal, Field, Puppy, submit } from "./components/ui";
import { Welcome, Onboarding } from "./pages/Auth";
import { Today } from "./pages/Today";
import { Diary } from "./pages/Diary";
import { Routine } from "./pages/Routine";
import { Patterns } from "./pages/Patterns";
import { Settings as SettingsPage } from "./pages/Settings";
const tabs = [
  ["today", "Today", Sun],
  ["diary", "Diary", BookOpen],
  ["routine", "Routine", CalendarDays],
  ["patterns", "Patterns", BarChart3],
] as const;
export default function App() {
  const j = useJournal();
  const [tab, setTab] = useState("today"),
    [menu, setMenu] = useState(false),
    [unlock, setUnlock] = useState(false),
    [pinError, setPinError] = useState(""),
    [conflicts, setConflicts] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const handler = (e: Event) => j.setError((e as CustomEvent).detail);
    window.addEventListener("wag-error", handler);
    return () => window.removeEventListener("wag-error", handler);
  }, [j.setError]);
  useEffect(() => {
    setTab("today");
  }, [j.householdId, j.locked]);
  const navigate = (t: string) => {
    setTab(t);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  if (j.loading)
    return (
      <div className="app-loading">
        <Puppy />
        <p>Opening your journal…</p>
      </div>
    );
  if (
    (!j.demo && !j.user && !j.locked) ||
    location.hash.includes("type=recovery") ||
    sessionStorage.getItem("wag-recovery") === "true"
  )
    return <Welcome />;
  if (!j.household) {
    if (j.locked)
      return (
        <main className="onboarding">
          <LockKeyhole size={36} />
          <h1>This kiosk is locked.</h1>
          <p>
            {j.error ||
              "Connect to the internet to check this device’s access."}
          </p>
          <p>
            Pending entries remain on this device. Ask the household owner to
            review them.
          </p>
          <button className="secondary" onClick={() => void j.sync()}>
            Check connection
          </button>
        </main>
      );
    return <Onboarding />;
  }
  const h = j.household,
    pref = j.state.snapshot.preferences.find(
      (p) => p.householdId === h.id && p.userId === j.userId,
    ),
    muted =
      pref?.mutedUntil &&
      (pref.mutedUntil === "forever" ||
        Date.parse(pref.mutedUntil) > Date.now()),
    pending = j.state.queue.length,
    conflictCount = j.state.queue.filter((m) => m.conflict).length;
  if (h.deletionAt)
    return (
      <main className="onboarding">
        <Puppy />
        <h1>This journal is resting.</h1>
        <p>
          Your household is pending deletion. You can cancel within seven days
          of {new Date(h.deletionAt).toLocaleDateString("en-AU")}.
        </p>
        {h.ownerId === j.userId && (
          <button
            className="primary"
            onClick={async () => {
              await api("cancelDeletion", { householdId: h.id });
              await j.refresh();
            }}
          >
            Cancel deletion
          </button>
        )}
        <button className="text-button" onClick={() => void j.leave()}>
          Sign out
        </button>
      </main>
    );
  return (
    <div className={`app-shell ${j.locked ? "kiosk-shell" : ""}`}>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
        >
          <img src="/icon.svg" alt="" />
          Wag Journal<span className="brand-dot">.</span>
        </a>
        <div className="household-switch">
          <span className="puppy-avatar">
            <Puppy size={56} />
          </span>
          <div>
            <strong>{h.puppy}’s journal</strong>
            {j.state.snapshot.households.length > 1 && !j.locked ? (
              <label>
                <span className="sr-only">Choose household</span>
                <select
                  value={h.id}
                  onChange={(e) => j.selectHousehold(e.target.value)}
                >
                  {j.state.snapshot.households.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>{h.name}</span>
            )}
          </div>
        </div>
        <nav aria-label="Main navigation">
          {tabs
            .filter(([key]) => !j.locked || key === "today")
            .map(([key, label, Icon]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => navigate(key)}
                aria-current={tab === key ? "page" : undefined}
              >
                <Icon size={21} strokeWidth={1.7} />
                {label}
                {tab === key && <i />}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Puppy size={82} />
            <p>
              Every little moment
              <br />
              makes a bigger picture.
            </p>
          </div>
          {!j.locked ? (
            <button
              className={
                tab === "settings" ? "nav-settings active" : "nav-settings"
              }
              onClick={() => navigate("settings")}
            >
              <Settings size={20} />
              Household & settings
            </button>
          ) : (
            <button className="nav-settings" onClick={() => setUnlock(true)}>
              <LockKeyhole size={20} />
              Unlock management
            </button>
          )}
          <span className="sidebar-caption">A little rhythm, together.</span>
        </div>
      </aside>
      <div className="main-wrapper">
        <header className="topbar">
          <div className="mobile-brand">
            <button
              className="icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <span>Wag Journal.</span>
          </div>
          <div className="breadcrumb">
            {h.puppy}’s journal<span>/</span>
            {j.locked
              ? "Shared tablet"
              : tabs.find(([key]) => key === tab)?.[1] || "Settings"}
          </div>
          <div className="topbar-status">
            <span className={`save-status ${pending ? "pending" : ""}`}>
              {!j.online ? (
                <WifiOff size={16} />
              ) : j.syncing ? (
                <RefreshCw size={16} className="spin" />
              ) : (
                <Cloud size={17} />
              )}
              <span>
                {j.demo
                  ? "Sample · saved on this device"
                  : pending
                    ? `${pending} waiting to sync`
                    : !j.online
                      ? "Offline · saved on this device"
                      : "Saved to the account"}
              </span>
            </span>
            {!j.locked && (
              <button
                className={`reminder-toggle ${muted ? "muted" : ""}`}
                onClick={() =>
                  void j.mutate("preference", {
                    ...(pref ||
                      preferencesFor(j.state.snapshot, h.id, j.userId)),
                    mutedUntil: muted
                      ? undefined
                      : new Date(Date.now() + 3600000).toISOString(),
                  })
                }
              >
                {muted ? <BellOff size={17} /> : <Bell size={17} />}
                <span>
                  {muted
                    ? pref?.mutedUntil === "forever"
                      ? "Reminders muted"
                      : `Muted until ${new Date(pref!.mutedUntil!).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`
                    : "Reminders on"}
                </span>
              </button>
            )}
          </div>
        </header>
        {j.demo && (
          <div className="demo-banner">
            <span>
              You’re exploring Alfie’s sample diary. Entries stay on this
              device.
            </span>
            <button onClick={() => void j.leave()}>
              Start your own journal <ArrowRight size={15} />
            </button>
          </div>
        )}
        {j.error && (
          <div className="global-error" role="alert">
            <AlertCircle size={18} />
            <span>{j.error}</span>
            <button onClick={() => void j.sync()}>Retry</button>
            <button aria-label="Dismiss error" onClick={() => j.setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {conflictCount > 0 && (
          <button
            className="conflict-banner"
            onClick={() => setConflicts(true)}
          >
            <AlertCircle size={18} />
            {conflictCount} change{conflictCount > 1 ? "s" : ""} need a second
            look. Review to continue syncing.
            <ArrowRight size={18} />
          </button>
        )}
        <main id="main-content" className="main-content">
          {tab === "today" ? (
            <Today key={h.id} navigate={navigate} />
          ) : tab === "diary" ? (
            <Diary key={h.id} />
          ) : tab === "routine" ? (
            <Routine key={h.id} />
          ) : tab === "patterns" ? (
            <Patterns key={h.id} navigate={navigate} />
          ) : (
            <SettingsPage key={h.id} />
          )}
        </main>
        <footer className="app-footer">
          <span>Small moments. A lovely life together.</span>
          <span>Wag Journal · {j.locked ? "Kiosk" : h.timezone}</span>
        </footer>
      </div>
      {!j.locked && (
        <nav className="bottom-nav" aria-label="Phone navigation">
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => navigate(key)}
              aria-current={tab === key ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
          <button
            className={tab === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <Settings size={21} />
            <span>Settings</span>
          </button>
        </nav>
      )}
      {j.toast && (
        <div className="toast" role="status">
          <Check size={19} />
          <span>{j.toast.text}</span>
          {j.toast.undo && <button onClick={j.toast.undo}>Undo</button>}
        </div>
      )}
      {unlock && (
        <Modal title="Unlock management" onClose={() => setUnlock(false)}>
          <p>
            Enter the kiosk PIN, then sign in with your personal account. The
            PIN does not grant owner permissions.
          </p>
          <form
            onSubmit={submit(async (d) => {
              setPinError("");
              try {
                await api("unlockKiosk", { pin: d.get("pin") }, j.kiosk!.token);
                j.unlock();
                setUnlock(false);
              } catch (e) {
                setPinError((e as Error).message);
              }
            })}
          >
            <Field label="Six-digit PIN">
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                required
              />
            </Field>
            {pinError && (
              <p role="alert" className="error-message">
                {pinError}
              </p>
            )}
            <button className="primary full">
              Continue to personal sign-in
            </button>
          </form>
        </Modal>
      )}
      {conflicts && (
        <Modal
          title="Let’s resolve these changes"
          onClose={() => setConflicts(false)}
          wide
        >
          {j.state.queue
            .filter((m) => m.conflict)
            .map((m) => (
              <article className="conflict-review" key={m.id}>
                <h3>{m.conflict!.message}</h3>
                <div className="form-grid">
                  <div>
                    <strong>Your pending change</strong>
                    <pre>{JSON.stringify(m.record, null, 2)}</pre>
                  </div>
                  <div>
                    <strong>Saved account version</strong>
                    <pre>
                      {m.conflict?.current
                        ? JSON.stringify(m.conflict.current, null, 2)
                        : "No saved version is available."}
                    </pre>
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="secondary"
                    onClick={() => void j.resolve(m.id, "remote")}
                  >
                    Keep account version
                  </button>
                  <button
                    className="primary"
                    onClick={() => void j.resolve(m.id, "mine")}
                  >
                    Retry my change
                  </button>
                </div>
                <p className="fine-print">
                  A running-session or plan conflict must be corrected in the
                  diary before retrying. Keeping the account version removes
                  dependent pending edits to this record.
                </p>
              </article>
            ))}
        </Modal>
      )}
    </div>
  );
}
