"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { company } from "@/config/company";

export function SignInForm() {
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const reason = search.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"idle" | "signing" | "loading">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setPhase("signing");
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(data?.message ?? "Sign-in failed");
        setPending(false);
        setPhase("idle");
        return;
      }
      // Keep pending through full navigation so the form never looks frozen.
      setPhase("loading");
      window.location.assign(next);
    } catch {
      setError("Network error");
      setPending(false);
      setPhase("idle");
    }
  }

  const buttonLabel =
    phase === "loading"
      ? "Loading dashboard…"
      : phase === "signing"
        ? "Signing in…"
        : "Sign in";

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {company.shortName}
        </h1>
        <p className="text-sm text-slate-500">Sign in to the portal</p>
      </div>
      {reason === "idle" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You were signed out after 45 minutes of inactivity.
        </p>
      ) : null}
      {reason === "expired" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your session expired. Please sign in again.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {buttonLabel}
      </Button>
    </form>
  );
}
