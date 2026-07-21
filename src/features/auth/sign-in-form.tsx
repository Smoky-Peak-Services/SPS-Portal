"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppLogo } from "@/components/layout/app-logo";
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
    <Card className="mx-auto w-full max-w-sm border-border/80 bg-card/90 shadow-xl shadow-black/40">
      <CardHeader className="space-y-4 text-center">
        <div className="flex justify-center">
          <AppLogo href={undefined} variant="mark" markClassName="h-14 w-14" priority />
        </div>
        <div>
          <CardTitle className="text-xl">{company.shortName}</CardTitle>
          <CardDescription>Sign in to the operations portal</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {reason === "idle" ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-200">
              You were signed out after 45 minutes of inactivity.
            </p>
          ) : null}
          {reason === "expired" ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-200">
              Your session expired. Please sign in again.
            </p>
          ) : null}
          <div className="space-y-2 text-left">
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
          <div className="space-y-2 text-left">
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {buttonLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
