import { useRegisterSW } from "virtual:pwa-register/react";
export function AppUpdate() {
  const {
    needRefresh: [needsUpdate, setNeedsUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration)
        window.addEventListener("online", () => {
          void registration.update();
        });
    },
  });
  if (!needsUpdate) return null;
  return (
    <aside className="app-update" aria-label="App update">
      <div>
        <strong>A fresh version is ready.</strong>
        <p>
          Finish any open edits, then update. Saved entries and pending changes
          stay on this device.
        </p>
      </div>
      <button
        className="primary"
        onClick={() => void updateServiceWorker(true)}
      >
        Update journal
      </button>
      <button className="text-button" onClick={() => setNeedsUpdate(false)}>
        Later
      </button>
    </aside>
  );
}
