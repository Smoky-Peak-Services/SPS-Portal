import {
  assertCapability,
  requireCapability,
  type SessionUser,
} from "@/lib/session";
import { userCan } from "@/config/permissions";

export async function requireMaterialsAccess(): Promise<SessionUser> {
  return requireCapability("materials.access");
}

export function assertCatalogWrite(user: SessionUser) {
  assertCapability(user, "materials.catalog.write");
}

export function assertAttributesWrite(user: SessionUser) {
  assertCapability(user, "materials.attributes.write");
}

export function assertFinancialsWrite(user: SessionUser) {
  assertCapability(user, "materials.financials.write");
}

export function assertDelete(user: SessionUser) {
  assertCapability(user, "materials.delete");
}

export function assertForceDelete(user: SessionUser) {
  assertCapability(user, "materials.force_delete");
}

export function assertImportExport(user: SessionUser) {
  assertCapability(user, "materials.import_export");
}

export function assertTaxReview(user: SessionUser) {
  assertCapability(user, "materials.tax_review");
}

export function canViewFinancials(user: SessionUser): boolean {
  return userCan(user, "materials.financials.view");
}

export function canWriteFinancials(user: SessionUser): boolean {
  return userCan(user, "materials.financials.write");
}

export function canWriteCatalog(user: SessionUser): boolean {
  return userCan(user, "materials.catalog.write");
}

export function canForceDelete(user: SessionUser): boolean {
  return userCan(user, "materials.force_delete");
}
