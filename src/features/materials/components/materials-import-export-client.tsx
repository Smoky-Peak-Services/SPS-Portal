"use client";

import { useMemo, useState, useTransition } from "react";
import type { Segment } from "@prisma/client";
import {
  commitMaterialsImport,
  previewMaterialsImport,
  type MaterialsImportPreview,
} from "@/features/materials/io-actions";
import { Button } from "@/components/ui/button";

type ScopeDivision = {
  id: string;
  name: string;
  slug: string;
  code: string;
  segments: string[];
  scopes: { segment: Segment; scopeCode: string }[];
};

export function MaterialsImportExportClient({
  divisions,
  isAdmin,
}: {
  divisions: ScopeDivision[];
  isAdmin: boolean;
}) {
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");
  const [segment, setSegment] = useState<Segment>(
    (divisions[0]?.scopes[0]?.segment as Segment) ?? "COMMERCIAL",
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MaterialsImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedDivision = useMemo(
    () => divisions.find((d) => d.id === divisionId) ?? null,
    [divisions, divisionId],
  );

  const segmentOptions = selectedDivision?.scopes ?? [];

  function onDivisionChange(id: string) {
    setDivisionId(id);
    setPreview(null);
    setCommitMessage(null);
    const d = divisions.find((x) => x.id === id);
    if (d?.scopes[0]) {
      setSegment(d.scopes[0].segment);
    }
  }

  function buildFormData() {
    if (!file) throw new Error("Choose an .xlsx file first");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("divisionId", divisionId);
    fd.set("segment", segment);
    return fd;
  }

  function onFileChange(f: File | null) {
    setFile(f);
    setPreview(null);
    setCommitMessage(null);
    setError(null);
    if (!f) return;
    // Filename guess is applied after preview; here we only store the file.
  }

  function runPreview() {
    setError(null);
    setCommitMessage(null);
    startTransition(async () => {
      try {
        const result = await previewMaterialsImport(buildFormData());
        setPreview(result);
        if (
          result.filenameGuess &&
          result.filenameGuess.scopeCode !== result.scopeCode
        ) {
          // Keep user selection; surface mismatch in UI via preview.filenameGuess
        }
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
        const result = await commitMaterialsImport(buildFormData());
        setCommitMessage(
          `Committed: ${result.applied.domainsCreated} domains, ${result.applied.categoriesCreated} categories, ${result.applied.unitsCreated} units, ${result.applied.itemsCreated} items created, ${result.applied.itemsUpdated} items updated.`,
        );
        const refreshed = await previewMaterialsImport(buildFormData());
        setPreview(refreshed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Commit failed");
      }
    });
  }

  const exportHref =
    divisionId && segment
      ? `/api/materials/export?divisionId=${encodeURIComponent(divisionId)}&segment=${encodeURIComponent(segment)}`
      : null;

  const scopeCode =
    selectedDivision?.scopes.find((s) => s.segment === segment)?.scopeCode ??
    "—";

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium">Scope</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Division</span>
            <select
              className="mt-1 w-full rounded border border-border px-2 py-2"
              value={divisionId}
              onChange={(e) => onDivisionChange(e.target.value)}
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Segment</span>
            <select
              className="mt-1 w-full rounded border border-border px-2 py-2"
              value={segment}
              onChange={(e) => {
                setSegment(e.target.value as Segment);
                setPreview(null);
                setCommitMessage(null);
              }}
            >
              {segmentOptions.map((s) => (
                <option key={s.segment} value={s.segment}>
                  {s.segment} ({s.scopeCode})
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm">
            <div className="text-muted-foreground">Scope code</div>
            <div className="mt-2 font-mono text-base">{scopeCode}</div>
          </div>
        </div>
        {exportHref ? (
          <div>
            <Button asChild variant="outline">
              <a href={exportHref}>Export current scope (.xlsx)</a>
            </Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium">Import</h2>
        <p className="text-sm text-muted-foreground">
          Upload a catalog workbook. Preview shows creates/updates only — missing
          rows are never deleted. Commit is admin-only and re-parses the file.
        </p>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={runPreview}
            disabled={!file || !divisionId || pending}
          >
            {pending ? "Working…" : "Preview import"}
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              variant="default"
              onClick={runCommit}
              disabled={!file || !preview || !preview.plan.layoutOk || pending}
            >
              Commit import
            </Button>
          ) : (
            <p className="self-center text-sm text-muted-foreground">
              Commit requires an admin account.
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
      </section>

      {preview ? (
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium">Preview report</h2>
          <p className="text-sm text-muted-foreground">
            File: {preview.filename}
            {preview.filenameGuess
              ? ` · filename suggests ${preview.filenameGuess.scopeCode}`
              : ""}
            {preview.filenameGuess &&
            preview.filenameGuess.scopeCode !== preview.scopeCode ? (
              <span className="text-amber-700">
                {" "}
                (differs from selected {preview.scopeCode})
              </span>
            ) : null}
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-sm">
            <Stat label="New domains" value={preview.summary.domainsCreated} />
            <Stat
              label="New categories"
              value={preview.summary.categoriesCreated}
            />
            <Stat label="New units" value={preview.summary.unitsCreated} />
            <Stat label="New items" value={preview.summary.itemsCreated} />
            <Stat label="Item updates" value={preview.summary.itemsUpdated} />
            <Stat
              label="Unchanged items"
              value={preview.summary.itemsUnchanged}
            />
          </div>

          {!preview.plan.layoutOk ? (
            <div
              className="rounded border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900"
              role="alert"
            >
              <p className="font-medium">Wrong file type</p>
              <p className="mt-1">
                {preview.plan.layoutMessage ??
                  "This file doesn't look like a materials catalog export."}
              </p>
              <p className="mt-1 text-red-800">
                Matched {preview.plan.sheetsMatched} of{" "}
                {preview.plan.sheetsTotal} sheets. Commit is blocked.
              </p>
            </div>
          ) : null}

          {preview.plan.itemUpdates.length > 0 ? (
            <div>
              <h3 className="mb-2 font-medium">Item updates</h3>
              <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                {preview.plan.itemUpdates.map((u) => (
                  <li key={u.id} className="border-b border-border py-1">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      ({u.sheet}:{u.row})
                    </span>
                    <ul className="ml-4 text-muted-foreground">
                      {u.changes.map((c) => (
                        <li key={c.field}>
                          {c.field}: {c.from || "∅"} → {c.to || "∅"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(() => {
            const sheetWarnings = preview.plan.warnings.filter((w) => w.row === 0);
            const rowWarnings = preview.plan.warnings.filter((w) => w.row !== 0);
            return (
              <>
                {sheetWarnings.length > 0 ? (
                  <div>
                    <h3 className="mb-2 font-medium">
                      Sheet warnings ({sheetWarnings.length})
                    </h3>
                    <ul className="max-h-48 space-y-1 overflow-auto text-sm text-amber-950">
                      {sheetWarnings.map((w, i) => (
                        <li key={`sheet-${w.sheet}-${i}`}>
                          [{w.sheet}] {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {rowWarnings.length > 0 ? (
                  <div>
                    <h3 className="mb-2 font-medium">
                      Row warnings ({rowWarnings.length})
                    </h3>
                    <ul className="max-h-48 space-y-1 overflow-auto text-sm text-amber-900">
                      {rowWarnings.map((w, i) => (
                        <li key={`${w.sheet}-${w.row}-${i}`}>
                          [{w.sheet}:{w.row}] {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            );
          })()}
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-muted/40 px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
