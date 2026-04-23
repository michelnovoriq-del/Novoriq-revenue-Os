"use client";

import { useState } from "react";

export function AuthForm({
  mode,
  title,
  description,
  fields,
  onSubmit,
  footer
}) {
  const initialValues = fields.reduce((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});

  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onSubmit(values);
    } catch (submissionError) {
      setError(submissionError.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Novoriq Revenue OS</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.name} className="field">
              <span>{field.label}</span>
              <input
                name={field.name}
                type={field.type}
                value={values[field.name]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value
                  }))
                }
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                required
              />
            </label>
          ))}

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? `${mode}...` : mode}
          </button>
        </form>

        <div className="auth-footer">{footer}</div>
      </section>
    </main>
  );
}
