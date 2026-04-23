"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "../../components/AuthForm";
import { apiRequest } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    apiRequest("/auth/me")
      .then((response) => {
        if (active) {
          router.replace(response.redirectTo);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [router]);

  async function handleRegister(values) {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(values)
    });

    router.replace(response.redirectTo);
  }

  return (
    <AuthForm
      mode="Register"
      title="Create account"
      description="Set up a secure account for your revenue workspace."
      fields={[
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          placeholder: "name@company.com"
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
          placeholder: "Use 12+ characters"
        },
        {
          name: "confirmPassword",
          label: "Confirm password",
          type: "password",
          autoComplete: "new-password",
          placeholder: "Re-enter your password"
        }
      ]}
      onSubmit={handleRegister}
      footer={
        <p>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      }
    />
  );
}
