import Link from "next/link";

export default function HomePage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Foundation</p>
        <h1>Production auth system scaffolded.</h1>
        <p className="lede">
          Users authenticate through the backend, sessions live in secure cookies,
          and role access is enforced server-side.
        </p>
        <div className="button-row">
          <Link className="primary-link" href="/login">
            Login
          </Link>
          <Link className="secondary-link" href="/register">
            Register
          </Link>
        </div>
      </section>
    </main>
  );
}
