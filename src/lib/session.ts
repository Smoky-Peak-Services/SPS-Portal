import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/config/permissions";
import {
  canAccess,
  defaultRouteForRole,
  type Area,
} from "@/config/permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  phone: string | null;
};

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, phone: true },
  });

  if (!user) {
    redirect("/sign-in");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AppRole,
    phone: user.phone,
  };
}

export async function requireArea(area: Area): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccess(user.role, area)) {
    redirect(defaultRouteForRole(user.role));
  }
  return user;
}
