import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

/** Local + configured production origin (avoids CSRF rejects when .env.local points at prod). */
const trustedOrigins = Array.from(
  new Set(
    [
      baseURL,
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].filter((v): v is string => Boolean(v)),
  ),
);

/**
 * Session: 60-minute lifetime that slides on activity (updateAge).
 * Client SessionWatchdog enforces a shorter idle window (45 min default).
 * Cookie sliding must happen from the client (or route handlers) — RSCs cannot Set-Cookie.
 * nextCookies must be last in plugins.
 */
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "power_user",
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60,
    updateAge: 60 * 5,
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
