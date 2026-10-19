import { useState } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { supabase, cloudConfigured, api } from "../lib/api";
import { useJournal } from "../lib/context";
import { Field, Puppy, submit } from "../components/ui";
import { day, uid } from "../lib/domain";
const emailReady = import.meta.env.VITE_EMAIL_READY === "true";
export function Welcome() {
  const j = useJournal();
  const [mode, setMode] = useState<
    "welcome" | "signin" | "signup" | "reset" | "password"
  >(
    location.hash.includes("type=recovery") ||
      sessionStorage.getItem("wag-recovery") === "true"
      ? "password"
      : "welcome",
  );
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const auth = async (data: FormData) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!supabase)
        throw Error(
          "Account services are not connected yet. You can explore the sample diary.",
        );
      const email = String(data.get("email") || ""),
        password = String(data.get("password") || "");
      let result;
      if (mode === "signup")
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: data.get("name") },
            emailRedirectTo: location.origin,
          },
        });
      else if (mode === "reset")
        result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/#type=recovery",
        });
      else if (mode === "password")
        result = await supabase.auth.updateUser({ password });
      else result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup")
        setMessage("Check your email to confirm your account, then sign in.");
      if (mode === "reset")
        setMessage("If that account exists, a recovery link is on its way.");
      if (mode === "password") {
        sessionStorage.removeItem("wag-recovery");
        history.replaceState(null, "", location.pathname);
        setMessage("Your password has been updated.");
        setMode("signin");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="welcome">
      <header className="welcome-header">
        <a className="brand" href="/">
          <img src="/icon.svg" alt="" />
          Wag Journal<span className="brand-dot">.</span>
        </a>
        <span className="small-muted">A little rhythm, together.</span>
      </header>
      <main className="welcome-grid">
        <div className="welcome-story">
          <span className="eyebrow">For the little days that matter</span>
          <h1>
            Less guessing.
            <br />
            More tail wagging.
          </h1>
          <p className="lede">
            A thoughtful little journal for life with your puppy. Record the
            everyday moments, share the care and find your rhythm.
          </p>
          <div className="welcome-values">
            {[
              "Quick enough for a sleepy morning",
              "One shared diary for your household",
              "A clearer picture, one day at a time",
            ].map((s) => (
              <p key={s}>
                <Check size={18} />
                {s}
              </p>
            ))}
          </div>
          <div className="notebook-illustration">
            <Puppy size={180} />
            <span>
              Little moments.
              <br />
              <em>Lovely beginnings.</em>
            </span>
            <div className="drawn-line" />
          </div>
        </div>
        <section className="welcome-form">
          <span className="eyebrow">Welcome to your journal</span>
          <h2>
            {mode === "welcome"
              ? "Make room for a little rhythm."
              : mode === "signup"
                ? "Start your household."
                : mode === "reset"
                  ? "Let’s get you back in."
                  : mode === "password"
                    ? "Choose a new password."
                    : "Good to have you back."}
          </h2>
          {mode === "welcome" ? (
            <>
              <p>Everything your puppy’s people need, in one calm place.</p>
              <button
                className="primary full"
                disabled={!cloudConfigured || !emailReady}
                onClick={() => setMode("signup")}
              >
                Start your journal <ArrowRight size={18} />
              </button>
              <button
                className="secondary full"
                disabled={!cloudConfigured}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <div className="divider">
                <span>Take a look around</span>
              </div>
              <button
                className="sample-button"
                onClick={() => void j.startDemo()}
              >
                <Puppy size={54} />
                <span>
                  <strong>Meet Alfie’s sample diary</strong>
                  <small>Try logging, routines and patterns</small>
                </span>
                <ArrowRight size={18} />
              </button>
              {cloudConfigured && !emailReady && (
                <p className="setup-note">
                  New accounts are opening soon. For now, sign in to an existing
                  account or explore the sample diary.
                </p>
              )}
              {!cloudConfigured && (
                <p className="setup-note">
                  Accounts are being set up. The sample diary works on this
                  device and contains fictional entries.
                </p>
              )}
            </>
          ) : (
            <form onSubmit={submit(auth)}>
              {mode === "signup" && (
                <Field label="Your name">
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    maxLength={80}
                  />
                </Field>
              )}
              {mode !== "password" && (
                <Field label="Email address">
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </Field>
              )}
              {mode !== "reset" && (
                <Field
                  label="Password"
                  hint={
                    mode === "signup"
                      ? "Use at least 12 characters."
                      : undefined
                  }
                >
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={mode === "signin" ? 1 : 12}
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                  />
                </Field>
              )}
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="success-message">
                  <Mail size={18} />
                  {message}
                </p>
              )}
              <button className="primary full" disabled={busy}>
                {busy
                  ? "One moment…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send recovery link"
                      : mode === "password"
                        ? "Update password"
                        : "Sign in"}
                <ArrowRight size={18} />
              </button>
              <div className="form-links">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setMode("welcome");
                    setError("");
                  }}
                >
                  Back
                </button>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={!emailReady}
                    onClick={() => setMode("reset")}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </main>
      <footer className="welcome-footer">
        Made for real life. Muddy paws and all.
        <span>A private diary. A shared little adventure.</span>
      </footer>
    </div>
  );
}
export function Onboarding() {
  const j = useJournal(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const invite = new URLSearchParams(location.search).get("invite");
  return (
    <main className="onboarding">
      <Puppy size={100} />
      <span className="eyebrow">Your first page</span>
      <h1>
        {invite ? "Join your puppy’s people." : "Tell us about your puppy."}
      </h1>
      <p>Start with the essentials. Your routine can come later.</p>
      {j.error && (
        <p className="error-message" role="alert">
          {j.error}
        </p>
      )}
      <form
        onSubmit={submit(async (d) => {
          setBusy(true);
          setError("");
          try {
            if (invite) {
              await api("acceptInvite", { token: invite });
              history.replaceState(null, "", location.pathname);
            } else
              await api("createHousehold", {
                id: uid(),
                name: d.get("name"),
                puppy: d.get("puppy"),
                birthDate: d.get("birthDate"),
                timezone: d.get("timezone"),
              });
            await j.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        })}
      >
        {invite ? (
          <p>The invitation must match the email address you signed in with.</p>
        ) : (
          <>
            <Field label="Puppy’s name">
              <input
                autoFocus
                name="puppy"
                required
                maxLength={100}
                placeholder="e.g. Alfie"
              />
            </Field>
            <Field
              label="Date of birth"
              hint="An approximate date is fine if you’re not sure."
            >
              <input name="birthDate" type="date" required max={day()} />
            </Field>
            <Field label="Household name">
              <input
                name="name"
                defaultValue="Our household"
                maxLength={100}
                required
              />
            </Field>
            <Field label="Household timezone">
              <select
                name="timezone"
                defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
              >
                {[
                  ...new Set([
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    "Australia/Melbourne",
                    "Australia/Sydney",
                    "Australia/Brisbane",
                    "Australia/Perth",
                    "Australia/Adelaide",
                    "Pacific/Auckland",
                    "Europe/London",
                    "America/New_York",
                    "America/Los_Angeles",
                    "UTC",
                  ]),
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy
            ? "Setting things up…"
            : invite
              ? "Accept invitation"
              : "Open our journal"}
          <ArrowRight size={18} />
        </button>
      </form>
      <button className="text-button" onClick={() => void j.leave()}>
        Sign out
      </button>
    </main>
  );
}
