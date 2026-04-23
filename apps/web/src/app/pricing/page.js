"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";

export default function PricingPage() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    unlocking: false,
    error: "",
    expiresAt: null
  });

  useEffect(() => {
    let active = true;

    apiRequest("/auth/me")
      .then((response) => {
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
          unlocking: false,
          error: "",
          expiresAt: response.user?.subscription_expires_at || null
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (error.status === 401) {
          router.replace("/login");
          return;
        }

        setState({
          loading: false,
          unlocking: false,
          error: error.message || "Unable to load pricing",
          expiresAt: null
        });
      });

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
      setState((current) => ({
        ...current,
        unlocking: false,
        error: error.message || "Unable to renew access"
      }));
    }
  }

  if (state.loading) {
    return (
      <main className="app-shell">
        <section className="app-frame">
          <p className="eyebrow">Pricing</p>
          <h1>Checking your access status</h1>
          <p className="lede">Confirming whether your 48-hour window is still active.</p>
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
        <h1>Your full-access window has ended.</h1>
        <p className="lede">
          The backend marked your subscription as expired, so dashboard requests now stop
          here until access is renewed.
        </p>
        {state.expiresAt ? (
          <p className="supporting-copy">
            Previous access ended {new Date(state.expiresAt).toLocaleString()}.
          </p>
        ) : null}

        <section className="detail-grid">
          <div className="detail-panel">
            <div className="panel-heading">
              <h2>What unlock includes</h2>
            </div>
            <div className="stack-list">
              <article className="stack-item">
                <strong>48-hour live dashboard access</strong>
                <p>Backend-enforced access to the protected revenue workspace.</p>
              </article>
              <article className="stack-item">
                <strong>Reusable payment contract</strong>
                <p>The same unlock path can later be driven by a real Whop webhook.</p>
              </article>
            </div>
          </div>

          <div className="detail-panel">
            <div className="panel-heading">
              <h2>Next step</h2>
            </div>
            <div className="stack-list">
              <article className="stack-item">
                <strong>Unlock Full Access — $10 (48 hours)</strong>
                <p>Dev mode currently grants access through the backend unlock endpoint.</p>
              </article>
            </div>
          </div>
        </section>

        <div className="button-row">
          <button
            className="primary-button"
            type="button"
            onClick={handleUnlock}
            disabled={state.unlocking}
          >
            {state.unlocking ? "Renewing..." : "Unlock Full Access — $10 (48 hours)"}
          </button>
          <Link className="secondary-link" href="/demo">
            View demo
          </Link>
        </div>

        {state.error ? <p className="form-error">{state.error}</p> : null}
      </section>
    </main>
  );
}
