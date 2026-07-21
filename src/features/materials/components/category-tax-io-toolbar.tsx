"use client";

import { useState, useTransition } from "react";
import {
  commitCategoryTaxImport,
  previewCategoryTaxImport,
  type CategoryTaxImportPreview,
} from "@/features/materials/category-tax-io-actions";
import { Button } from "@/components/ui/button";

export function CategoryTaxIoToolbar({ isAdmin }: { isAdmin: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CategoryTaxImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function buildFormData() {
    if (!file) throw new Error("Choose an .xlsx file first");
    const fd = new FormData();
    fd.set("file", file);
    return fd;
  }

  function runPreview() {
    setError(null);
    setCommitMessage(null);
    startTransition(async () => {
      try {
        setPreview(await previewCategoryTaxImport(buildFormData()));
      } catch (e) {
        setPreview(null);
        setError(e instanceof Error ? e.message : "Preview failed");
      }
    });
  }

  function runCommit() {
    if (!isAdmin) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await commitCategoryTaxImport(buildFormData());
        setCommitMessage(
          `Committed: ${result.applied.categoriesUpdated} categories updated.`,
        );
        setPreview(await previewCategoryTaxImport(buildFormData()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Commit failed");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Tax / linkage Excel</h2>
          <p className="text-xs text-muted-foreground">
            Flat Categories sheet for bulk tax codes. Re-export before import —
            blank tax code cells clear overrides.{" "}
            <span className="text-foreground/80">
              taxProfile follows stripeTaxCodeId (txcd_00000000/blank →
              REAL_PROPERTY; else TPP) and is ignored on import.
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/materials/categories/tax-export">Export</a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide import" : "Import"}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-border pt-3">
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setCommitMessage(null);
              setError(null);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={runPreview}
              disabled={!file || pending}
            >
              {pending ? "Working…" : "Preview"}
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                size="sm"
                onClick={runCommit}
                disabled={
                  !file || !preview || !preview.plan.layoutOk || pending
                }
              >
                Commit
              </Button>
            ) : (
              <p className="self-center text-xs text-muted-foreground">
                Commit requires admin (force-delete) permission.
              </p>
            )}
          </div>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {commitMessage ? (
            <p className="text-sm text-primary">{commitMessage}</p>
          ) : null}
          {preview ? (
            <div className="space-y-2 text-sm">
              <p>
                Updates: {preview.summary.updates} · Unchanged:{" "}
                {preview.summary.unchanged} · Unresolved:{" "}
                {preview.summary.unresolved} · Warnings:{" "}
                {preview.summary.warnings}
              </p>
              {!preview.plan.layoutOk && preview.plan.layoutMessage ? (
                <p className="text-amber-700">{preview.plan.layoutMessage}</p>
              ) : null}
              {preview.plan.updates.length > 0 ? (
                <ul className="max-h-40 overflow-auto text-xs text-muted-foreground">
                  {preview.plan.updates.slice(0, 40).map((u) => (
                    <li key={`${u.id}-${u.row}`}>
                      Row {u.row}: {u.domain} / {u.category} —{" "}
                      {u.changes.map((c) => `${c.field}: ${c.from}→${c.to}`).join("; ")}
                    </li>
                  ))}
                  {preview.plan.updates.length > 40 ? (
                    <li>…and {preview.plan.updates.length - 40} more</li>
                  ) : null}
                </ul>
              ) : null}
              {preview.plan.warnings.length > 0 ? (
                <ul className="max-h-32 overflow-auto text-xs text-amber-800">
                  {preview.plan.warnings.slice(0, 20).map((w, i) => (
                    <li key={`${w.row}-${i}`}>
                      Row {w.row}: {w.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
