"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setUserCapabilityOverride,
  updateUserRole,
} from "@/features/settings/actions";
import { ALL_ROLES, ROLE_LABELS, type AppRole } from "@/config/permissions";
import { CAPABILITIES } from "@/config/capabilities";
import { Button } from "@/components/ui/button";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  capabilityOverrides: { capabilityId: string; effect: "ALLOW" | "DENY" }[];
};

export function UsersPermissionsPanel({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  function changeRole(role: AppRole) {
    if (!selected) return;
    setError(null);
    start(async () => {
      try {
        await updateUserRole({ userId: selected.id, role });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  function setOverride(capabilityId: string, effect: "ALLOW" | "DENY" | "INHERIT") {
    if (!selected) return;
    setError(null);
    start(async () => {
      try {
        await setUserCapabilityOverride({
          userId: selected.id,
          capabilityId,
          effect,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Override failed");
      }
    });
  }

  const overrideMap = new Map(
    (selected?.capabilityOverrides ?? []).map((o) => [o.capabilityId, o.effect]),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <ul className="rounded-lg border border-border bg-card text-sm">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className={`w-full px-3 py-2 text-left hover:bg-muted ${
                u.id === selectedId ? "bg-primary/10 font-medium" : ""
              }`}
              onClick={() => setSelectedId(u.id)}
            >
              <div>{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <p className="text-sm text-muted-foreground">{selected.email}</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Role
            </label>
            <select
              className="flex h-10 w-full max-w-xs rounded-md border border-border px-3 text-sm"
              value={selected.role}
              disabled={pending}
              onChange={(e) => changeRole(e.target.value as AppRole)}
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Capability overrides</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Inherit uses the role matrix. Deny always wins over role allow.
            </p>
            <ul className="space-y-2">
              {CAPABILITIES.map((cap) => {
                const effect = overrideMap.get(cap.id) ?? "INHERIT";
                return (
                  <li
                    key={cap.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                  >
                    <div>
                      <div className="font-medium">{cap.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {cap.id}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(["INHERIT", "ALLOW", "DENY"] as const).map((e) => (
                        <Button
                          key={e}
                          type="button"
                          size="sm"
                          variant={effect === e ? "default" : "outline"}
                          disabled={pending}
                          onClick={() => setOverride(cap.id, e)}
                        >
                          {e === "INHERIT" ? "Inherit" : e === "ALLOW" ? "Allow" : "Deny"}
                        </Button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
