"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not sign in.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Email</span>
        <input className="field" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">Password</span>
        <input className="field" name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button className="btn btn-primary w-full" disabled={loading}>
        <LogIn size={17} />
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
