"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";
import { ensureEvidenceSession, logEvidenceActivity } from "../lib/evidence-client";

export function ProtectedView({ scope, title, description }) {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: null
  });
  const fingerprintApiKey = state.payload?.evidence?.fingerprintApiKey || "";

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

  useEffect(() => {
    if (scope !== "dashboard" || state.loading || !state.payload) {
      return undefined;
    }

    let cancelled = false;

    async function startEvidence() {
      try {
        await ensureEvidenceSession(fingerprintApiKey);

        if (!cancelled) {
          await logEvidenceActivity("dashboard_view", {
            scope,
            stripeConfigured: state.payload?.user?.stripeConfigured === true
          }, fingerprintApiKey);
        }
      } catch {
        return;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        logEvidenceActivity("dashboard_visible", { scope }, fingerprintApiKey).catch(() => {});
      }
    }

    startEvidence();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fingerprintApiKey, scope, state.loading, state.payload]);

  async function handleLogout() {
    if (scope === "dashboard") {
      await logEvidenceActivity("logout_click", { scope }, fingerprintApiKey).catch(() => {});
    }

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

  const expiryLabel = state.payload?.user?.accessExpiration || state.payload?.user?.subscription_expires_at
    ? new Date(
        state.payload.user.accessExpiration || state.payload.user.subscription_expires_at
      ).toLocaleString()
    : null;
  const subscriptionTier = state.payload?.user?.subscriptionTier;
  const performanceFeePercentage = state.payload?.user?.performanceFeePercentage;
  const unpaidPerformanceBalance = state.payload?.user?.unpaidPerformanceBalance;
  const stripeConfigured = state.payload?.user?.stripeConfigured === true;

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
        {subscriptionTier ? (
          <p className="supporting-copy">
            Active plan: {subscriptionTier}
            {typeof performanceFeePercentage === "number"
              ? ` • Performance fee ${(performanceFeePercentage * 100).toFixed(0)}%`
              : ""}
          </p>
        ) : null}
        {scope === "dashboard" ? (
          <p className="supporting-copy">
            Stripe restricted key: {stripeConfigured ? "Configured" : "Not configured"}
          </p>
        ) : null}
        {scope === "dashboard" && typeof unpaidPerformanceBalance === "number" ? (
          <p className="supporting-copy">
            Unpaid performance balance: ${unpaidPerformanceBalance.toFixed(2)}
          </p>
        ) : null}
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <div className="button-row">
          <button className="primary-button" onClick={handleLogout}>
            Logout
          </button>
          <Link
            className="secondary-link"
            href="/"
            onClick={() => {
              if (scope === "dashboard") {
                logEvidenceActivity(
                  "home_navigation_click",
                  { destination: "/" },
                  fingerprintApiKey
                ).catch(() => {});
              }
            }}
          >
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
