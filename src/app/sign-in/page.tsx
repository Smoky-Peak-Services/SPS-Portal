import { Suspense } from "react";
import { SignInForm } from "@/features/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.35_0.08_180_/_0.35),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.25_0.06_250_/_0.4),_transparent_50%)]"
      />
      <div className="relative z-10 w-full">
        <Suspense
          fallback={
            <p className="text-center text-sm text-muted-foreground">
              Loading…
            </p>
          }
        >
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
