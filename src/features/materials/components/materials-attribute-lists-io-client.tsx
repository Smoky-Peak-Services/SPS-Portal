"use client";

import { useState, useTransition } from "react";
import type { Segment } from "@prisma/client";
import {
  commitAttributeListsImport,
  previewAttributeListsImport,
  type AttributeListsImportPreview,
} from "@/features/materials/attribute-io-actions";
import { Button } from "@/components/ui/button";
import {
  ScopeSelector,
  type ScopeDivisionOption,
} from "@/components/patterns/scope-selector";

export function MaterialsAttributeListsIoClient({
  isAdmin,
  divisionId,
  segment,
  divisions,
  defaultDivisionId,
  defaultSegment,
}: {
  isAdmin: boolean;
  /** Fixed scope (e.g. from the attributes page filter). */
  divisionId?: string;
  segment?: Segment;
  /** When provided (import/export hub), render an embedded scope selector. */
  divisions?: ScopeDivisionOption[];
  /** Active-scope default selection for the embedded selector (prompt 15). */
  defaultDivisionId?: string;
  defaultSegment?: Segment;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AttributeListsImportPreview | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pickedScope, setPickedScope] = useState<{
    divisionId: string;
    segment: Segment;
  }>({
    divisionId: divisionId ?? defaultDivisionId ?? divisions?.[0]?.id ?? "",
    segment: segment ?? defaultSegment ?? "COMMERCIAL",
  });

  const effDivisionId = divisionId ?? pickedScope.divisionId;
  const effSegment = segment ?? pickedScope.segment;

  function buildFormData() {
    if (!file) throw new Error("Choose an .xlsx file first");
    if (!effDivisionId) throw new Error("Choose a scope first");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("divisionId", effDivisionId);
    fd.set("segment", effSegment);
    return fd;
  }

  function runPreview() {
    setError(null);
    setCommitMessage(null);
    startTransition(async () => {
      try {
        setPreview(await previewAttributeListsImport(buildFormData()));
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
        const result = await commitAttributeListsImport(buildFormData());
        setCommitMessage(
          `Committed: ${result.applied.attributesCreated} attributes created, ${result.applied.attributesUpdated} updated; ${result.applied.optionsCreated} options created, ${result.applied.optionsUpdated} updated.`,
        );
        setPreview(await previewAttributeListsImport(buildFormData()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Commit failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Attribute lists</h2>
            <p className="text-sm text-muted-foreground">
              Per-scope picklists (`MaterialAttribute` / options) — each scope
              owns its own attributes. Upsert only — missing rows are never
              deleted. filter_mode, tags, and RFQ columns are ignored. Commit is
              admin-only.
            </p>
          </div>
          <Button asChild variant="outline" disabled={!effDivisionId}>
            <a
              href={`/api/materials/attributes/export?divisionId=${encodeURIComponent(effDivisionId)}&segment=${encodeURIComponent(effSegment)}`}
            >
              Export attribute lists (.xlsx)
            </a>
          </Button>
        </div>

        {divisions && !divisionId ? (
          <ScopeSelector
            divisions={divisions}
            divisionId={effDivisionId}
            segment={effSegment}
            onChange={(next) => {
              setPickedScope(next);
              setPreview(null);
              setCommitMessage(null);
            }}
          />
        ) : null}

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
            onClick={runPreview}
            disabled={!file || pending}
          >
            {pending ? "Working…" : "Preview attribute import"}
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              onClick={runCommit}
              disabled={!file || !preview || !preview.plan.layoutOk || pending}
            >
              Commit attribute import
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
          <h3 className="font-medium">Attribute lists preview</h3>
          <p className="text-sm text-muted-foreground">
            File: {preview.filename} · Scope: {preview.scopeCode}
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-sm">
            <Stat
              label="New attributes"
              value={preview.summary.attributesCreated}
            />
            <Stat
              label="Attr updates"
              value={preview.summary.attributesUpdated}
            />
            <Stat label="New options" value={preview.summary.optionsCreated} />
            <Stat
              label="Option updates"
              value={preview.summary.optionsUpdated}
            />
            <Stat
              label="Unchanged opts"
              value={preview.summary.optionsUnchanged}
            />
            <Stat label="Warnings" value={preview.summary.warningCount} />
          </div>

          {!preview.plan.layoutOk ? (
            <div
              className="rounded border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900"
              role="alert"
            >
              <p className="font-medium">Wrong file type</p>
              <p className="mt-1">
                {preview.plan.layoutMessage ??
                  "This file doesn't look like an attribute-lists export."}
              </p>
              <p className="mt-1 text-red-800">Commit is blocked.</p>
            </div>
          ) : null}

          {preview.plan.optionUpdates.length > 0 ? (
            <div>
              <h4 className="mb-2 text-sm font-medium">Option updates</h4>
              <ul className="max-h-40 space-y-1 overflow-auto text-sm">
                {preview.plan.optionUpdates.map((u) => (
                  <li key={u.id} className="border-b border-border py-1">
                    <span className="font-medium">
                      {u.attributeSlug}/{u.value}
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
            const sheetWarnings = preview.plan.warnings.filter(
              (w) => w.row === 0,
            );
            const rowWarnings = preview.plan.warnings.filter(
              (w) => w.row !== 0,
            );
            return (
              <>
                {sheetWarnings.length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">
                      Sheet warnings ({sheetWarnings.length})
                    </h4>
                    <ul className="max-h-40 space-y-1 overflow-auto text-sm text-amber-950">
                      {sheetWarnings.map((w, i) => (
                        <li key={`s-${w.sheet}-${i}`}>
                          [{w.sheet || "workbook"}] {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {rowWarnings.length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">
                      Row warnings ({rowWarnings.length})
                    </h4>
                    <ul className="max-h-40 space-y-1 overflow-auto text-sm text-amber-900">
                      {rowWarnings.map((w, i) => (
                        <li key={`r-${w.sheet}-${w.row}-${i}`}>
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
