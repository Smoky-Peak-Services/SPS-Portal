"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  resetRoleCapabilityDefaults,
  saveRoleCapabilityMatrix,
} from "@/features/settings/actions";
import type { AppRole } from "@/config/permissions";
import { ROLE_LABELS } from "@/config/permissions";

type Cap = {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

type Row = { role: AppRole; capabilityId: string; allowed: boolean };

export function PermissionsMatrixForm({
  capabilities,
  roles,
  initialRows,
}: {
  capabilities: readonly Cap[];
  roles: readonly AppRole[];
  initialRows: Row[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const initialMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of initialRows) {
      m.set(`${r.role}:${r.capabilityId}`, r.allowed);
    }
    return m;
  }, [initialRows]);

  const [matrix, setMatrix] = useState(() => {
    const m: Record<string, boolean> = {};
    for (const role of roles) {
      for (const cap of capabilities) {
        const key = `${role}:${cap.id}`;
        m[key] = initialMap.get(key) ?? false;
      }
    }
    return m;
  });

  function toggle(role: AppRole, capabilityId: string) {
    const key = `${role}:${capabilityId}`;
    setMatrix((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function onSave() {
    setError(null);
    setMessage(null);
    start(async () => {
      try {
        const entries = roles.flatMap((role) =>
          capabilities.map((cap) => ({
            role,
            capabilityId: cap.id,
            allowed: matrix[`${role}:${cap.id}`] ?? false,
          })),
        );
        await saveRoleCapabilityMatrix({ entries });
        setMessage("Saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function onReset() {
    setError(null);
    setMessage(null);
    start(async () => {
      try {
        await resetRoleCapabilityDefaults();
        setMessage("Reset to defaults. Refreshing…");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reset failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={onSave}>
          {pending ? "Saving…" : "Save matrix"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onReset}
        >
          Reset to code defaults
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-teal-800">{message}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">Capability</th>
              {roles.map((r) => (
                <th key={r} className="px-2 py-2 text-center">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((cap) => (
              <tr key={cap.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{cap.label}</div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {cap.id}
                  </div>
                </td>
                {roles.map((role) => {
                  const key = `${role}:${cap.id}`;
                  return (
                    <td key={key} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={matrix[key] ?? false}
                        onChange={() => toggle(role, cap.id)}
                        disabled={pending}
                        aria-label={`${ROLE_LABELS[role]} — ${cap.label}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
