"use client";

import {
  deleteMaterialCategory,
  forceDeleteMaterialCategory,
} from "@/features/materials/delete-actions";
import { MaterialDeleteControls } from "./material-delete-controls";

export function CategoryDeleteCell({
  id,
  name,
  itemCount,
  isAdmin,
}: {
  id: string;
  name: string;
  itemCount: number;
  isAdmin: boolean;
}) {
  return (
    <MaterialDeleteControls
      id={id}
      name={name}
      isAdmin={isAdmin}
      childCount={itemCount}
      childLabel="items"
      onSafeDelete={deleteMaterialCategory}
      onForceDelete={forceDeleteMaterialCategory}
    />
  );
}
