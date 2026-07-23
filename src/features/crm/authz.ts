import { requireCapability, requireUser, type SessionUser } from "@/lib/session";
import { userCan } from "@/config/permissions";

export async function requireCrmAccess(): Promise<SessionUser> {
  return requireCapability("crm.access");
}

export async function requireCrmWrite(): Promise<SessionUser> {
  await requireUser();
  return requireCapability("crm.write");
}

export async function requireCrmArchive(): Promise<SessionUser> {
  await requireUser();
  return requireCapability("crm.archive");
}

export function canWriteCrm(user: SessionUser): boolean {
  return userCan(user, "crm.write");
}

export function canArchiveCrm(user: SessionUser): boolean {
  return userCan(user, "crm.archive");
}
