"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "../../components/AuthForm";
import { apiRequest } from "../../lib/api";

export default function LoginPage() {
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

  async function handleLogin(values) {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(values)
    });

    router.replace(response.redirectTo);
  }

  return (
    <AuthForm
      mode="Login"
      title="Sign in"
      description="Access your revenue operations workspace securely."
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
          autoComplete: "current-password",
          placeholder: "Enter your password"
        }
      ]}
      onSubmit={handleLogin}
      footer={
        <p>
          Need an account? <Link href="/register">Create one</Link>
        </p>
      }
    />
  );
}
