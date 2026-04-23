"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";

export default function DemoPage() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    unlocking: false,
    error: "",
    payload: null
  });

  useEffect(() => {
    let active = true;

    async function loadDemo() {
      try {
        const payload = await apiRequest("/demo");

        if (active) {
          setState({
            loading: false,
            unlocking: false,
            error: "",
            payload
          });
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
          unlocking: false,
          error: error.message || "Unable to load demo",
          payload: null
        });
      }
    }

    loadDemo();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleUnlock() {
    setState((current) => ({ ...current, unlocking: true, error: "" }));

    try {
      const response = await apiRequest("/api/dev/unlock", { method: "POST" });
      router.replace(response.redirectTo || "/dashboard");
    } catch (error) {
      const redirectTo = error.payload?.redirectTo;
      if (redirectTo) {
        router.replace(redirectTo);
        return;
      }

      setState((current) => ({
        ...current,
        unlocking: false,
        error: error.message || "Unable to unlock access"
      }));
    }
  }

  if (state.loading) {
    return (
      <main className="app-shell">
        <section className="app-frame">
          <p className="eyebrow">Demo</p>
          <h1>Loading preview workspace</h1>
          <p className="lede">Pulling the backend-approved demo data for your account.</p>
        </section>
      </main>
    );
  }

  const payload = state.payload;

  return (
    <main className="app-shell">
      <section className="app-frame">
        <div className="hero-band">
          <p className="eyebrow">Demo Dashboard</p>
          <div className="status-chip">Simulated data</div>
        </div>

        <h1>Preview the revenue cockpit before you unlock it.</h1>
        <p className="lede">
          Explore simulated metrics, fake analytics, and example activity. Full access
          opens the live dashboard for 48 hours.
        </p>

        <section className="metrics-grid">
          {payload?.metrics?.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <em>{metric.delta}</em>
              <p>{metric.trend}</p>
            </article>
          ))}
        </section>

        <section className="detail-grid">
          <div className="detail-panel">
            <div className="panel-heading">
              <h2>Fake analytics</h2>
            </div>
            <div className="stack-list">
              {payload?.analytics?.map((item) => (
                <article className="stack-item" key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="detail-panel">
            <div className="panel-heading">
              <h2>Example activity</h2>
            </div>
            <div className="stack-list">
              {payload?.activity?.map((item) => (
                <article className="stack-item" key={item}>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="unlock-banner">
          <div>
            <p className="eyebrow">Unlock</p>
            <h2>{payload?.unlockOffer?.cta || "Unlock Full Access — $10 (48 hours)"}</h2>
            <p className="supporting-copy">
              Temporary dev endpoint for now. The backend owns the access window and can
              later swap this out for a Whop webhook without changing the UI contract.
            </p>
          </div>
          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={handleUnlock}
              disabled={state.unlocking}
            >
              {state.unlocking
                ? "Unlocking..."
                : payload?.unlockOffer?.cta || "Unlock Full Access — $10 (48 hours)"}
            </button>
            <Link className="secondary-link" href="/login">
              Back to sign in
            </Link>
          </div>
        </section>

        {state.error ? <p className="form-error">{state.error}</p> : null}
      </section>
    </main>
  );
}
