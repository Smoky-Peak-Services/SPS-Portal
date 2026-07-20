"use client";

import {
  deleteMaterialDomain,
  forceDeleteMaterialDomain,
} from "@/features/materials/delete-actions";
import { MaterialDeleteControls } from "./material-delete-controls";

export function DomainDeleteCell({
  id,
  name,
  categoryCount,
  isAdmin,
}: {
  id: string;
  name: string;
  categoryCount: number;
  isAdmin: boolean;
}) {
  return (
    <MaterialDeleteControls
      id={id}
      name={name}
      isAdmin={isAdmin}
      childCount={categoryCount}
      childLabel="categories"
      onSafeDelete={deleteMaterialDomain}
      onForceDelete={forceDeleteMaterialDomain}
    />
  );
}
