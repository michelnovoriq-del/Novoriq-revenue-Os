"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { WHOP_PLANS } from "../../lib/whop-plans";

const ACCESS_STATUS_POLL_MS = 15000;

export default function PricingPage() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    error: "",
    expiresAt: null
  });

  useEffect(() => {
    let active = true;

    async function loadPricing() {
      try {
        const response = await apiRequest("/auth/me");

        if (!active) {
          return;
        }

        if (response.redirectTo === "/dashboard") {
          router.replace("/dashboard");
          return;
        }

        if (response.redirectTo === "/demo") {
          router.replace("/demo");
          return;
        }

        setState({
          loading: false,
          error: "",
          expiresAt: response.user?.accessExpiration || response.user?.subscription_expires_at || null
        });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error.status === 401) {
          router.replace("/login");
          return;
        }

        setState({
          loading: false,
          error: error.message || "Unable to load pricing",
          expiresAt: null
        });
      }
    }

    loadPricing();

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadPricing();
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
          <p className="eyebrow">Pricing</p>
          <h1>Checking your access status</h1>
          <p className="lede">Confirming whether your paid access window is still active.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="app-frame">
        <div className="hero-band">
          <p className="eyebrow">Pricing</p>
          <div className="status-chip status-chip-alert">Expired</div>
        </div>
        <h1>Your paid access window has ended.</h1>
        <p className="lede">
          The backend now blocks dashboard access until Whop confirms a new purchase
          through the webhook flow.
        </p>
        {state.expiresAt ? (
          <p className="supporting-copy">
            Previous access ended {new Date(state.expiresAt).toLocaleString()}.
          </p>
        ) : null}

        <section className="detail-grid">
          <div className="detail-panel">
            <div className="panel-heading">
              <h2>How unlock works</h2>
            </div>
            <div className="stack-list">
              <article className="stack-item">
                <strong>Frontend redirects only</strong>
                <p>The app sends you to Whop checkout and never decides access on its own.</p>
              </article>
              <article className="stack-item">
                <strong>Backend-enforced activation</strong>
                <p>Access changes only after the backend processes a Whop webhook.</p>
              </article>
            </div>
          </div>

          <div className="detail-panel">
            <div className="panel-heading">
              <h2>After payment</h2>
            </div>
            <div className="stack-list">
              <article className="stack-item">
                <strong>Automatic re-check</strong>
                <p>This page keeps checking your access while you stay signed in.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="detail-panel">
          <div className="panel-heading">
            <h2>Choose your Whop plan</h2>
          </div>
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
          <Link className="secondary-link" href="/demo">
            View demo
          </Link>
        </div>

        {state.error ? <p className="form-error">{state.error}</p> : null}
      </section>
    </main>
  );
}
