"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { WHOP_PLANS } from "../../lib/whop-plans";

const ACCESS_STATUS_POLL_MS = 15000;

export default function DemoPage() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
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
          error: error.message || "Unable to load demo",
          payload: null
        });
      }
    }

    loadDemo();

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadDemo();
      }
    }, ACCESS_STATUS_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(pollInterval);
    };
  }, [router]);

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
          Explore simulated metrics, fake analytics, and example activity. Payments are
          handled by Whop, and the backend unlocks access only after the Whop webhook is
          received and applied to your account.
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

        <section className="detail-panel">
          <div className="panel-heading">
            <h2>Unlock with Whop</h2>
          </div>
          <p className="supporting-copy">
            Choose the plan you want, complete checkout on Whop, then return here. This
            page re-checks your access automatically while you are signed in.
          </p>
          <div className="metrics-grid">
            {WHOP_PLANS.map((plan) => (
              <article className="metric-card" key={plan.id}>
                <span>{plan.name}</span>
                <strong>{plan.priceLabel}</strong>
                <em>{plan.termLabel}</em>
                <p>{plan.description}</p>
                <div className="button-row">
                  <a className="primary-link" href={plan.checkoutUrl} rel="noreferrer">
                    Go to checkout
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="button-row">
          <Link className="secondary-link" href="/login">
            Back to sign in
          </Link>
        </div>

        {state.error ? <p className="form-error">{state.error}</p> : null}
      </section>
    </main>
  );
}
