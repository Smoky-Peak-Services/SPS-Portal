"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type DeleteFn = (raw: { id: string }) => Promise<unknown>;
type ForceDeleteFn = (raw: {
  id: string;
  confirmName: string;
}) => Promise<unknown>;

export function MaterialDeleteControls({
  id,
  name,
  isAdmin,
  childCount,
  childLabel,
  onSafeDelete,
  onForceDelete,
}: {
  id: string;
  name: string;
  isAdmin: boolean;
  /** When > 0, safe delete will fail server-side; show force UI for admins. */
  childCount: number;
  childLabel: string;
  onSafeDelete: DeleteFn;
  onForceDelete?: ForceDeleteFn;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [forceOpen, setForceOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  function runSafe() {
    setError(null);
    startTransition(async () => {
      try {
        await onSafeDelete({ id });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  function runForce() {
    if (!onForceDelete) return;
    setError(null);
    startTransition(async () => {
      try {
        await onForceDelete({ id, confirmName });
        setForceOpen(false);
        setConfirmName("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Force delete failed");
      }
    });
  }

  return (
    <div className="space-y-1 text-right">
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || (childCount > 0 && !forceOpen)}
          onClick={runSafe}
          title={
            childCount > 0
              ? `Has ${childCount} ${childLabel} — safe delete blocked`
              : "Safe delete"
          }
        >
          Delete
        </Button>
        {isAdmin && onForceDelete && childCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setForceOpen((v) => !v);
              setError(null);
            }}
          >
            Force…
          </Button>
        ) : null}
      </div>
      {forceOpen && onForceDelete ? (
        <div className="mt-1 space-y-1 rounded border border-red-200 bg-red-50 p-2 text-left text-xs">
          <p className="text-red-900">
            Type <span className="font-semibold">{name}</span> to permanently
            delete this and all {childLabel} under it.
          </p>
          <input
            className="w-full rounded border border-red-300 px-2 py-1"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={name}
            disabled={pending}
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending || confirmName.trim().length === 0}
            onClick={runForce}
          >
            Confirm force delete
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

/** Item delete — no force path (leaf entity). */
export function MaterialItemDeleteButton({
  id,
  onDelete,
}: {
  id: string;
  onDelete: DeleteFn;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await onDelete({ id });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Delete failed");
            }
          });
        }}
      >
        Delete
      </Button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
