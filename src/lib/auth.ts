import { betterAuth } from "better-auth";
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
        defaultValue: "staff",
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
});

export type Auth = typeof auth;
