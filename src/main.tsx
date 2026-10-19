import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/fraunces/latin-500.css";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "./styles.css";
import App from "./App";
import { JournalProvider } from "./lib/context";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="onboarding">
        <h1>Let’s reopen your journal.</h1>
        <p>
          Something interrupted the page. Your saved entries remain on this
          device.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload journal
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <JournalProvider>
        <App />
      </JournalProvider>
    </Boundary>
  </React.StrictMode>,
);
