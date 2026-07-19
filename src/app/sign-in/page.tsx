import { Suspense } from "react";
import { SignInForm } from "@/features/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-teal-50 p-6">
      <Suspense
        fallback={<div className="text-sm text-slate-500">Loading…</div>}
      >
        <SignInForm />
      </Suspense>
    </main>
  );
}
