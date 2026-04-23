import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="lede">The page you requested does not exist.</p>
        <Link className="primary-link" href="/">
          Go home
        </Link>
      </section>
    </main>
  );
}
