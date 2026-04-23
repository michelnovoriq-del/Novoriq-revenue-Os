"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";

export function ProtectedView({ scope, title, description }) {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: null
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await apiRequest(scope === "admin" ? "/admin" : "/dashboard");

        if (active) {
          setState({ loading: false, error: "", payload });
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const redirectTo = error.payload?.redirectTo;
        if (redirectTo) {
          router.replace(redirectTo);
          return;
        }

        if (error.status === 401) {
          router.replace("/login");
          return;
        }

        setState({
          loading: false,
          error: error.message || "Unable to load page",
          payload: null
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router, scope]);

  async function handleLogout() {
    await apiRequest("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (state.loading) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Loading</p>
          <h1>Checking access</h1>
          <p className="lede">Validating your session with the backend.</p>
        </section>
      </main>
    );
  }

  const expiryLabel = state.payload?.user?.subscription_expires_at
    ? new Date(state.payload.user.subscription_expires_at).toLocaleString()
    : null;

  return (
    <main className="app-shell">
      <section className="app-frame">
        <div className="hero-band">
          <p className="eyebrow">{scope}</p>
          <div className="status-chip">Backend verified</div>
        </div>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
        {expiryLabel ? (
          <p className="supporting-copy">Access window ends {expiryLabel}</p>
        ) : null}
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <div className="button-row">
          <button className="primary-button" onClick={handleLogout}>
            Logout
          </button>
          <Link className="secondary-link" href="/">
            Home
          </Link>
        </div>
        {scope === "dashboard" ? (
          <section className="metrics-grid">
            <article className="metric-card">
              <span>Live status</span>
              <strong>Unlocked</strong>
              <p>Revenue workspace is available for the active access window.</p>
            </article>
            <article className="metric-card">
              <span>Policy</span>
              <strong>Server enforced</strong>
              <p>Dashboard access is granted only when the backend says the window is active.</p>
            </article>
          </section>
        ) : null}
      </section>
    </main>
  );
}
