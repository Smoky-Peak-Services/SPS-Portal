"use client";

import { deleteMaterialItem } from "@/features/materials/delete-actions";
import { MaterialItemDeleteButton } from "./material-delete-controls";

export function ItemDeleteCell({ id }: { id: string }) {
  return <MaterialItemDeleteButton id={id} onDelete={deleteMaterialItem} />;
}
