"use client";

import { useState, useTransition } from "react";
import {
  commitDomainFlatImport,
  previewDomainFlatImport,
  type DomainFlatImportPreview,
} from "@/features/materials/domain-io-actions";
import { Button } from "@/components/ui/button";

export function DomainIoToolbar({ isAdmin }: { isAdmin: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DomainFlatImportPreview | null>(null);
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
        setPreview(await previewDomainFlatImport(buildFormData()));
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
        const result = await commitDomainFlatImport(buildFormData());
        setCommitMessage(
          `Committed: ${result.applied.created} created, ${result.applied.updated} updated.`,
        );
        setPreview(await previewDomainFlatImport(buildFormData()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Commit failed");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Domains Excel</h2>
          <p className="text-xs text-muted-foreground">
            Flat list: division, segment, name, slug, sortOrder. Additive import —
            missing rows are never deleted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/materials/domains/export">Export</a>
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
            <p className="text-sm">
              Creates: {preview.summary.creates} · Updates:{" "}
              {preview.summary.updates} · Unchanged: {preview.summary.unchanged}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
