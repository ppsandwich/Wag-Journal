import { useState } from "react";
import {
  Bell,
  Users,
  Tablet,
  ShieldCheck,
  LogOut,
  Plus,
  Download,
} from "lucide-react";
import { useJournal } from "../lib/context";
import { api } from "../lib/api";
import { addDays, atTime, day, now, preferencesFor, uid } from "../lib/domain";
import { Field, Modal, SectionTitle, submit } from "../components/ui";
import { exportPDF } from "../lib/exports";
export function Settings() {
  const j = useJournal(),
    h = j.household!,
    owner = h.ownerId === j.userId;
  const [prefDefault] = useState(() =>
      preferencesFor(j.state.snapshot, h.id, j.userId),
    ),
    pref =
      j.state.snapshot.preferences.find(
        (p) => p.householdId === h.id && p.userId === j.userId,
      ) || prefDefault;
  const [dialog, setDialog] = useState<
      "invite" | "pair" | "household" | "delete" | "account" | "recovery" | null
    >(null),
    [error, setError] = useState(""),
    [inviteUrl, setInviteUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [recovery, setRecovery] = useState<any[]>([]);
  const cloudAction = async (fn: () => Promise<void>) => {
    setError("");
    if (j.demo) {
      setError(
        "This is a sample diary. Sign in to manage real household accounts and devices.",
      );
      return;
    }
    setBusy(true);
    try {
      await fn();
      await j.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const mute = async (until?: string) => {
    await j.mutate("preference", { ...pref, mutedUntil: until });
    j.notify(until ? "Your reminders are muted." : "Your reminders are on.");
  };
  const enablePush = async () => {
    setError("");
    try {
      if (j.demo)
        throw Error("Sign in to enable reminders for your household.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw Error(
          "This browser does not support push. On iPhone or iPad, add Wag Journal to your Home Screen and open it there.",
        );
      if (!import.meta.env.VITE_VAPID_PUBLIC_KEY)
        throw Error(
          "Notifications are not connected yet. In-app upcoming activities are still available.",
        );
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw Error(
          "Notifications are not allowed. You can change this in your browser settings.",
        );
      const reg = await navigator.serviceWorker.ready;
      const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const bytes = Uint8Array.from(
        atob(key.replaceAll("-", "+").replaceAll("_", "/")),
        (c) => c.charCodeAt(0),
      );
      const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      await api("subscribe", {
        householdId: h.id,
        subscription: subscription.toJSON(),
      });
      j.notify("Notifications enabled on this device.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Make yourself at home</span>
          <h1>
            Household & settings<span className="heading-dot">.</span>
          </h1>
          <p>The people, preferences and little details behind your journal.</p>
        </div>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </p>
      )}
      <div className="settings-grid">
        <section className="panel">
          <SectionTitle title="Your household" />
          <dl className="profile-details">
            <div>
              <dt>Puppy</dt>
              <dd>{h.puppy}</dd>
            </div>
            <div>
              <dt>Birthday</dt>
              <dd>{h.birthDate}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{h.timezone}</dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>{owner ? "Owner" : "Caregiver"}</dd>
            </div>
          </dl>
          <button className="secondary" onClick={() => setDialog("household")}>
            <Plus size={17} />
            Create another household
          </button>
          <p className="fine-print">
            One puppy per household. Switch households from the journal
            navigation.
          </p>
        </section>
        <section className="panel">
          <SectionTitle title="Your reminders" aside={<Bell size={21} />} />
          <p>
            {pref.mutedUntil &&
            (pref.mutedUntil === "forever" ||
              Date.parse(pref.mutedUntil) > Date.now())
              ? pref.mutedUntil === "forever"
                ? "Muted until you turn them on."
                : `Muted until ${new Date(pref.mutedUntil).toLocaleString("en-AU")}`
              : "Reminders are on, subject to device permission."}
          </p>
          <div className="button-wrap">
            <button
              className="secondary small"
              onClick={() => void mute(undefined)}
            >
              Unmute
            </button>
            <button
              className="secondary small"
              onClick={() =>
                void mute(new Date(Date.now() + 3600000).toISOString())
              }
            >
              Mute 1 hour
            </button>
            <button
              className="secondary small"
              onClick={() => {
                const date = day(new Date(), h.timezone),
                  morning = atTime(date, pref.wakeTime, h.timezone),
                  until =
                    Date.parse(morning) > Date.now()
                      ? morning
                      : atTime(addDays(date, 1), pref.wakeTime, h.timezone);
                if (
                  confirm(
                    `Mute until ${new Date(until).toLocaleString("en-AU")}?`,
                  )
                )
                  void mute(until);
              }}
            >
              Until morning
            </button>
            <button
              className="secondary small"
              onClick={() => void mute("forever")}
            >
              Mute indefinitely
            </button>
          </div>
          <button className="primary" onClick={() => void enablePush()}>
            <Bell size={16} />
            Enable this device
          </button>
          <form
            className="quiet-form"
            onSubmit={submit(async (d) => {
              await j.mutate("preference", {
                ...pref,
                wakeTime: String(d.get("wake")),
                quietStart: String(d.get("start") || "") || undefined,
                quietEnd: String(d.get("end") || "") || undefined,
              });
              j.notify("Reminder preferences saved.");
            })}
          >
            <div className="form-grid">
              <Field label="Morning starts">
                <input
                  type="time"
                  name="wake"
                  defaultValue={pref.wakeTime}
                  required
                />
              </Field>
              <Field label="Quiet hours start (optional)">
                <input
                  type="time"
                  name="start"
                  defaultValue={pref.quietStart}
                />
              </Field>
              <Field label="Quiet hours end">
                <input type="time" name="end" defaultValue={pref.quietEnd} />
              </Field>
            </div>
            <button className="text-button">Save quiet hours</button>
          </form>
          <p className="fine-print">
            These preferences affect only you. Household times use {h.timezone}.
          </p>
        </section>
        <section className="panel">
          <SectionTitle
            title="Your puppy’s people"
            aside={<Users size={21} />}
          />
          {j.state.snapshot.members
            .filter((m) => m.householdId === h.id)
            .map((m) => (
              <div className="member-row" key={m.id}>
                <span className="avatar">{m.name.charAt(0)}</span>
                <div>
                  <strong>
                    {m.name}
                    {m.id === j.userId ? " (you)" : ""}
                  </strong>
                  <small>{m.role}</small>
                </div>
                {owner && m.id !== j.userId && (
                  <>
                    <button
                      className="text-button"
                      onClick={() =>
                        void cloudAction(async () => {
                          await api("transfer", {
                            householdId: h.id,
                            userId: m.id,
                          });
                          j.notify(
                            "Ownership transfer offered. The caregiver must accept it.",
                          );
                        })
                      }
                    >
                      Offer ownership
                    </button>
                    <button
                      className="danger-text"
                      onClick={() => {
                        if (confirm(`Remove ${m.name} from this household?`))
                          void cloudAction(async () => {
                            await api("removeMember", {
                              householdId: h.id,
                              userId: m.id,
                            });
                          });
                      }}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            ))}
          {owner && (
            <button
              className="secondary"
              onClick={() => {
                setInviteUrl("");
                setDialog("invite");
              }}
            >
              <Plus size={17} />
              Invite a caregiver
            </button>
          )}
          {(j.state.snapshot as any).transfers?.some(
            (t: any) => t.householdId === h.id && t.userId === j.userId,
          ) && (
            <button
              className="primary"
              onClick={() =>
                void cloudAction(async () => {
                  await api("acceptTransfer", { householdId: h.id });
                })
              }
            >
              Accept household ownership
            </button>
          )}
          <p className="fine-print">
            Caregivers can log, correct, export and edit the routine. Only the
            owner manages access and protected instructions.
          </p>
        </section>
        <section className="panel">
          <SectionTitle title="Shared tablet" aside={<Tablet size={21} />} />
          <p>
            Pair a household kiosk for quick logging without signing in each
            time. A PIN protects management; personal sign-in still controls
            permissions.
          </p>
          {j.state.snapshot.devices
            .filter((d) => d.householdId === h.id)
            .map((d) => (
              <div className="member-row" key={d.id}>
                <Tablet size={20} />
                <div>
                  <strong>{d.name}</strong>
                  <small>
                    {d.revokedAt ? "Access revoked" : "Paired kiosk"}
                  </small>
                </div>
                {owner && !d.revokedAt && (
                  <button
                    className="danger-text"
                    onClick={() =>
                      void cloudAction(async () => {
                        await api("revokeKiosk", { deviceId: d.id });
                      })
                    }
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          {owner && (
            <button className="secondary" onClick={() => setDialog("pair")}>
              <Tablet size={17} />
              Pair this device
            </button>
          )}
          <p className="fine-print">
            Disconnected devices learn about revocation when they reconnect.
            Their pending entries are retained for review.
          </p>
        </section>
        <section className="panel">
          <SectionTitle title="Your data" aside={<ShieldCheck size={21} />} />
          <p>
            Your diary belongs to your household. Download a copy any time from
            the Diary page.
          </p>
          <button
            className="secondary"
            onClick={async () => {
              try {
                const s = await j.allData();
                await exportPDF(
                  s,
                  h,
                  addDays(day(new Date(), h.timezone), -6),
                  day(new Date(), h.timezone),
                  true,
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Download size={17} />
            Download this week
          </button>
          {owner && (
            <button
              className="danger-text spaced"
              onClick={() => setDialog("delete")}
            >
              Delete household
            </button>
          )}
          <p className="fine-print">
            Household deletion has a seven-day cancellation period. Release
            retention and backup policies must be verified before public use.
          </p>
        </section>
        {owner && (
          <section className="panel">
            <SectionTitle title="Recovered offline entries" />
            <p>
              Review pending changes from kiosks that were revoked while
              disconnected.
            </p>
            <button
              className="secondary"
              onClick={() =>
                void cloudAction(async () => {
                  setRecovery(
                    await api("quarantineList", { householdId: h.id }),
                  );
                  setDialog("recovery");
                })
              }
            >
              Review recovered entries
            </button>
          </section>
        )}
        <section className="panel signout-panel">
          <SectionTitle title={j.demo ? "Sample diary" : "Your account"} />
          <p>
            {j.demo
              ? "These fictional entries are stored only on this device. Leave the sample diary to create your own account."
              : "Sign out when you finish on a shared device. You’ll be warned if entries are waiting to sync."}
          </p>
          <button className="secondary" onClick={() => void j.leave()}>
            <LogOut size={17} />
            {j.demo ? "Leave sample diary" : "Sign out"}
          </button>
          {!j.demo && !owner && (
            <button
              className="danger-text spaced"
              onClick={() => {
                if (
                  confirm(
                    "Leave this household? Your shared entries will remain.",
                  )
                )
                  void cloudAction(async () => {
                    await api("leaveHousehold", { householdId: h.id });
                  });
              }}
            >
              Leave this household
            </button>
          )}
          {!j.demo && (
            <button
              className="danger-text spaced"
              onClick={() => setDialog("account")}
            >
              Delete personal account
            </button>
          )}
        </section>
      </div>
      {dialog === "account" && (
        <Modal
          title="Delete your personal account"
          onClose={() => setDialog(null)}
        >
          <p>
            Transfer ownership or finish deleting every household you own first.
            Shared care entries remain with “Former caregiver” attribution. Your
            account and sign-in will be permanently removed.
          </p>
          <form
            onSubmit={submit(async (d) => {
              if (d.get("confirm") !== "DELETE") {
                setError("Type DELETE to confirm.");
                return;
              }
              if (j.state.queue.length) {
                setError(
                  "Sync or resolve pending changes before deleting your account.",
                );
                return;
              }
              setBusy(true);
              try {
                await api("deleteAccount");
                await j.leave();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            })}
          >
            <Field label="Type DELETE to confirm">
              <input name="confirm" required />
            </Field>
            {error && <p className="error-message">{error}</p>}
            <button className="danger full" disabled={busy}>
              Permanently delete account
            </button>
          </form>
        </Modal>
      )}
      {dialog === "recovery" && (
        <Modal
          title="Recovered kiosk changes"
          onClose={() => setDialog(null)}
          wide
        >
          {recovery.length ? (
            recovery.map((batch) => (
              <article key={batch.id} className="constraint">
                <h3>{batch.device || "Revoked device"}</h3>
                <p>
                  {new Date(batch.at).toLocaleString("en-AU")}. Review each
                  change before accepting it.
                </p>
                {(batch.changes || []).map((m: any) => (
                  <div key={m.id}>
                    <details>
                      <summary>
                        {m.record?.type || m.entity} · {m.record?.at}
                      </summary>
                      <pre>{JSON.stringify(m.record, null, 2)}</pre>
                    </details>
                    {m.entity === "event" && (
                      <button
                        className="secondary small"
                        onClick={async () => {
                          const r = {
                            ...m.record,
                            notes: [
                              m.record.notes,
                              `Reviewed offline recovery from ${batch.device || "revoked kiosk"}.`,
                            ]
                              .filter(Boolean)
                              .join(" "),
                          };
                          await j.mutate("event", r);
                          j.notify(
                            "Recovered entry queued with your review attribution. Resolve any conflicts before discarding the recovery batch.",
                          );
                        }}
                      >
                        Accept as reviewed entry
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="danger-text"
                  onClick={() => {
                    if (
                      confirm(
                        "Discard this recovery batch? Make sure any accepted entries have synced.",
                      )
                    )
                      void cloudAction(async () => {
                        await api("quarantineDiscard", {
                          householdId: h.id,
                          id: batch.id,
                        });
                        setRecovery(recovery.filter((b) => b.id !== batch.id));
                      });
                  }}
                >
                  Discard reviewed batch
                </button>
              </article>
            ))
          ) : (
            <p>No recovered kiosk changes are waiting.</p>
          )}
          {error && <p className="error-message">{error}</p>}
        </Modal>
      )}
      {dialog === "invite" && (
        <Modal title="Invite a caregiver" onClose={() => setDialog(null)}>
          {inviteUrl ? (
            <>
              <p>
                Share this single-use link with the invited person. They must
                sign in using the invited email address within seven days.
              </p>
              <Field label="Invitation link">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.target.select()}
                />
              </Field>
              <button
                className="primary full"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(inviteUrl)
                    .then(() => j.notify("Invitation link copied."))
                }
              >
                Copy invitation link
              </button>
            </>
          ) : (
            <form
              onSubmit={submit((d) =>
                cloudAction(async () => {
                  const result = await api<{ token: string }>("invite", {
                    householdId: h.id,
                    email: d.get("email"),
                  });
                  setInviteUrl(`${location.origin}/?invite=${result.token}`);
                }),
              )}
            >
              <Field label="Caregiver email">
                <input name="email" type="email" required />
              </Field>
              <button className="primary full" disabled={busy}>
                Create invitation
              </button>
            </form>
          )}
          {error && <p className="error-message">{error}</p>}
        </Modal>
      )}
      {dialog === "pair" && (
        <Modal
          title="Pair this household kiosk"
          onClose={() => setDialog(null)}
        >
          <p>
            This signs you out and switches to limited logging access. A
            disconnected kiosk can keep logging until it reconnects, even after
            revocation.
          </p>
          <form
            onSubmit={submit((d) =>
              cloudAction(async () => {
                if (j.state.queue.length)
                  throw Error("Sync pending entries before pairing.");
                const k = await api<any>("pairKiosk", {
                  householdId: h.id,
                  name: d.get("name"),
                  pin: d.get("pin"),
                });
                await j.pair(k);
                setDialog(null);
              }),
            )}
          >
            <Field label="Device name">
              <input
                name="name"
                defaultValue="Kitchen tablet"
                maxLength={80}
                required
              />
            </Field>
            <Field label="Six-digit management PIN">
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </Field>
            <button className="primary full" disabled={busy}>
              Pair and enter kiosk mode
            </button>
            {error && <p className="error-message">{error}</p>}
          </form>
        </Modal>
      )}
      {dialog === "household" && (
        <Modal title="Create another household" onClose={() => setDialog(null)}>
          <form
            onSubmit={submit((d) =>
              cloudAction(async () => {
                const result = await api<any>("createHousehold", {
                  id: uid(),
                  name: d.get("name"),
                  puppy: d.get("puppy"),
                  birthDate: d.get("birthDate"),
                  timezone: h.timezone,
                });
                j.selectHousehold(result.id);
                setDialog(null);
              }),
            )}
          >
            <Field label="Household name">
              <input name="name" required />
            </Field>
            <Field label="Puppy’s name">
              <input name="puppy" required />
            </Field>
            <Field label="Approximate birth date">
              <input name="birthDate" type="date" max={day()} required />
            </Field>
            <button className="primary full" disabled={busy}>
              Create household
            </button>
            {error && <p className="error-message">{error}</p>}
          </form>
        </Modal>
      )}
      {dialog === "delete" && (
        <Modal title="Delete this household?" onClose={() => setDialog(null)}>
          <p>
            This stops reminders and ordinary access immediately. You have seven
            days to cancel, then permanent deletion begins.
          </p>
          <form
            onSubmit={submit((d) =>
              cloudAction(async () => {
                if (d.get("confirm") !== h.puppy)
                  throw Error("Enter the puppy’s name exactly to confirm.");
                await api("deleteHousehold", { householdId: h.id });
                setDialog(null);
              }),
            )}
          >
            <Field label={`Type ${h.puppy} to confirm`}>
              <input name="confirm" required />
            </Field>
            <button className="danger full" disabled={busy}>
              Start seven-day deletion period
            </button>
            {error && <p className="error-message">{error}</p>}
          </form>
        </Modal>
      )}
    </>
  );
}
