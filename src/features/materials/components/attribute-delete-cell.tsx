"use client";

import {
  deleteMaterialAttribute,
  forceDeleteMaterialAttribute,
} from "@/features/materials/delete-actions";
import { MaterialDeleteControls } from "./material-delete-controls";

export function AttributeDeleteCell({
  id,
  name,
  usageCount,
  isAdmin,
}: {
  id: string;
  name: string;
  /** Assignments + item values that block safe delete. */
  usageCount: number;
  isAdmin: boolean;
}) {
  return (
    <MaterialDeleteControls
      id={id}
      name={name}
      isAdmin={isAdmin}
      childCount={usageCount}
      childLabel="usages"
      onSafeDelete={deleteMaterialAttribute}
      onForceDelete={forceDeleteMaterialAttribute}
    />
  );
}
