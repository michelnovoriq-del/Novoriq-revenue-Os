"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";

function formatCurrency(value) {
  const amount = typeof value === "number" ? value : 0;
  return `$${amount.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString();
}

export function AdminDashboard() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    error: "",
    admin: null,
    overview: null,
    users: [],
    billingMessage: "",
    runningBilling: false,
    payingUserId: ""
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [adminPayload, overviewPayload, usersPayload] = await Promise.all([
          apiRequest("/admin"),
          apiRequest("/api/admin/overview"),
          apiRequest("/api/admin/users")
        ]);

        if (!active) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          loading: false,
          error: "",
          admin: adminPayload.user,
          overview: overviewPayload,
          users: Array.isArray(usersPayload.users) ? usersPayload.users : []
        }));
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

        if (error.status === 403) {
          router.replace("/dashboard");
          return;
        }

        setState((currentState) => ({
          ...currentState,
          loading: false,
          error: error.message || "Unable to load admin dashboard"
        }));
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function refreshData() {
    const [overviewPayload, usersPayload] = await Promise.all([
      apiRequest("/api/admin/overview"),
      apiRequest("/api/admin/users")
    ]);

    setState((currentState) => ({
      ...currentState,
      overview: overviewPayload,
      users: Array.isArray(usersPayload.users) ? usersPayload.users : []
    }));
  }

  async function handleRunBilling() {
    try {
      setState((currentState) => ({
        ...currentState,
        runningBilling: true,
        billingMessage: "",
        error: ""
      }));

      const result = await apiRequest("/api/billing/run", {
        method: "POST"
      });

      await refreshData();

      setState((currentState) => ({
        ...currentState,
        runningBilling: false,
        billingMessage:
          result.billedCount > 0
            ? `Billing run completed for ${result.billedCount} client${result.billedCount === 1 ? "" : "s"}.`
            : "Billing run completed with no pending client balances."
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        runningBilling: false,
        error: error.message || "Unable to run billing cycle"
      }));
    }
  }

  async function handleMarkPaid(userId) {
    try {
      setState((currentState) => ({
        ...currentState,
        payingUserId: userId,
        billingMessage: "",
        error: ""
      }));

      await apiRequest("/api/admin/mark-paid", {
        method: "POST",
        body: JSON.stringify({ userId })
      });

      await refreshData();

      setState((currentState) => ({
        ...currentState,
        payingUserId: "",
        billingMessage: "Outstanding balance marked as paid."
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        payingUserId: "",
        error: error.message || "Unable to mark balance as paid"
      }));
    }
  }

  async function handleLogout() {
    await apiRequest("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (state.loading) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Admin</p>
          <h1>Loading control center</h1>
          <p className="lede">Pulling billing, revenue, and dispute data from the backend.</p>
        </section>
      </main>
    );
  }

  const overview = state.overview;

  return (
    <main className="app-shell">
      <section className="app-frame">
        <div className="hero-band">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Billing control center</h1>
            <p className="lede">
              Monitor recovered revenue, run billing cycles, and manage outstanding client balances.
            </p>
          </div>
          <div className="button-row">
            <button
              className="primary-button"
              onClick={handleRunBilling}
              disabled={state.runningBilling}
            >
              {state.runningBilling ? "Running billing..." : "Run billing cycle"}
            </button>
            <button className="secondary-link" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {state.admin ? (
          <p className="supporting-copy">
            Signed in as {state.admin.email}. Admin-only billing and settlement actions are enforced
            by the backend.
          </p>
        ) : null}
        {state.billingMessage ? <p className="form-success">{state.billingMessage}</p> : null}
        {state.error ? <p className="form-error">{state.error}</p> : null}

        <section className="metrics-grid admin-metrics-grid">
          <article className="metric-card">
            <span>Total users</span>
            <strong>{overview?.totalUsers ?? 0}</strong>
            <p>All client accounts currently stored in the platform.</p>
          </article>
          <article className="metric-card">
            <span>Active users</span>
            <strong>{overview?.activeUsers ?? 0}</strong>
            <p>Clients with active access windows from the backend access rules.</p>
          </article>
          <article className="metric-card">
            <span>Total recovered revenue</span>
            <strong>{formatCurrency(overview?.totalRecoveredRevenue)}</strong>
            <p>Recovered dispute revenue tracked from automated Stripe outcomes.</p>
          </article>
          <article className="metric-card">
            <span>Total platform fees</span>
            <strong>{formatCurrency(overview?.totalPlatformFees)}</strong>
            <p>Backend-calculated fees attributable to recovered revenue.</p>
          </article>
        </section>

        <section className="detail-grid admin-detail-grid">
          <article className="detail-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Recent disputes</p>
                <h2>Latest dispute activity</h2>
              </div>
              <div className="status-chip">Auto-updated</div>
            </div>
            {overview?.recentDisputes?.length ? (
              <div className="stack-list">
                {overview.recentDisputes.map((dispute) => (
                  <div className="stack-item" key={`${dispute.disputeId}-${dispute.chargeId}`}>
                    <strong>{dispute.userEmail}</strong>
                    <p>Charge: {dispute.chargeId}</p>
                    <p>Dispute: {dispute.disputeId}</p>
                    <p>Status: {dispute.disputeStatus || "unknown"}</p>
                    <p>Recovered: {formatCurrency(dispute.recoveredAmount)}</p>
                    <p>Logged: {formatDate(dispute.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="supporting-copy">No disputes have been recorded yet.</p>
            )}
          </article>

          <article className="detail-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Ops</p>
                <h2>Billing actions</h2>
              </div>
              <div className="status-chip">Manual MVP</div>
            </div>
            <div className="stack-list">
              <div className="stack-item">
                <strong>Run billing cycle</strong>
                <p>Marks pending recovery logs as billed and sends invoice notifications.</p>
              </div>
              <div className="stack-item">
                <strong>Mark client paid</strong>
                <p>Manually clears the user balance and updates their recovery logs to paid.</p>
              </div>
              <div className="stack-item">
                <strong>User-facing metrics</strong>
                <p>
                  The backend also exposes <code>/api/user/metrics</code> for client dashboards and
                  billing transparency.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="detail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Clients</p>
              <h2>Billing roster</h2>
            </div>
            <Link className="secondary-link" href="/">
              Home
            </Link>
          </div>

          {state.users.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Tier</th>
                    <th>Balance</th>
                    <th>Recovered</th>
                    <th>Stripe</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((user) => {
                    const canMarkPaid = (user.unpaidPerformanceBalance ?? 0) > 0;

                    return (
                      <tr key={user.id}>
                        <td data-label="Email">{user.email}</td>
                        <td data-label="Tier">{user.subscriptionTier || "Unassigned"}</td>
                        <td data-label="Balance">{formatCurrency(user.unpaidPerformanceBalance)}</td>
                        <td data-label="Recovered">{formatCurrency(user.totalRecoveredRevenue)}</td>
                        <td data-label="Stripe">{user.stripeConnected ? "Connected" : "Missing"}</td>
                        <td data-label="Created">{formatDate(user.createdAt)}</td>
                        <td data-label="Action">
                          <button
                            className="secondary-link admin-action-button"
                            onClick={() => handleMarkPaid(user.id)}
                            disabled={!canMarkPaid || state.payingUserId === user.id}
                          >
                            {state.payingUserId === user.id ? "Updating..." : "Mark paid"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="supporting-copy">No client users found.</p>
          )}
        </section>
      </section>
    </main>
  );
}
