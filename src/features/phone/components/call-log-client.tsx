"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  PhoneMissed,
  Voicemail,
  MessageSquare,
  X,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dismissPhoneNumber } from "@/features/phone/actions";

type Match =
  | { kind: "customer"; id: string; name: string; divisionSlug: string }
  | { kind: "lead"; id: string; name: string; divisionSlug: string }
  | null;

export interface CallLogRow {
  key: string;
  display: string;
  partyE164: string | null;
  leadMessage: string | null;
  lastAtMs: number;
  total: number;
  counts: { calls: number; missed: number; voicemails: number; sms: number };
  statusLine: string | null;
  summary: string | null;
  transcript: string | null;
  latestRecordingUrl: string | null;
  match: Match;
}

function ago(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(ms).toLocaleDateString();
}

function KindChips({ counts }: { counts: CallLogRow["counts"] }) {
  const items: {
    n: number;
    icon: React.ReactNode;
    label: string;
    tone: string;
  }[] = [
    {
      n: counts.missed,
      icon: <PhoneMissed className="h-3.5 w-3.5" />,
      label: "missed",
      tone: "text-rose-400",
    },
    {
      n: counts.voicemails,
      icon: <Voicemail className="h-3.5 w-3.5" />,
      label: "vm",
      tone: "text-amber-400",
    },
    {
      n: counts.calls,
      icon: <Phone className="h-3.5 w-3.5" />,
      label: "calls",
      tone: "text-sky-400",
    },
    {
      n: counts.sms,
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      label: "texts",
      tone: "text-emerald-400",
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items
        .filter((i) => i.n > 0)
        .map((i) => (
          <span
            key={i.label}
            className={cn("flex items-center gap-1 text-xs", i.tone)}
          >
            {i.icon}
            {i.n} {i.label}
          </span>
        ))}
    </div>
  );
}

export function CallLogClient({
  rows,
  canWrite,
}: {
  rows: CallLogRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [visibleRows, setVisibleRows] = useState(rows);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVisibleRows(rows);
  }, [rows]);

  function dismiss(key: string) {
    if (!canWrite) return;
    setError(null);
    startTransition(async () => {
      const res = await dismissPhoneNumber(key);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setVisibleRows((prev) => prev.filter((r) => r.key !== key));
      router.refresh();
    });
  }

  function triageHref(
    mode: "lead" | "customer",
    row: CallLogRow,
  ): string {
    const params = new URLSearchParams();
    if (row.partyE164) params.set("phone", row.partyE164);
    if (row.leadMessage) params.set("message", row.leadMessage);
    if (mode === "lead") return `/leads/new?${params.toString()}`;
    return `/clients/new?${params.toString()}`;
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-12 text-center">
          <Phone className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No calls or texts yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            As calls, voicemails and texts come into your Quo number, they show
            up here for the last 14 days.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((row) => (
            <div
              key={row.key}
              className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {row.match ? (
                    <Link
                      href={
                        row.match.kind === "customer"
                          ? `/clients/${row.match.id}`
                          : `/leads/${row.match.id}`
                      }
                      className="font-medium hover:underline"
                    >
                      {row.match.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{row.display}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {ago(row.lastAtMs)}
                  </span>
                </div>
                {row.match ? (
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {row.display}
                  </p>
                ) : null}
                <div className="mt-2">
                  <KindChips counts={row.counts} />
                </div>
                {row.statusLine ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.statusLine}
                  </p>
                ) : null}
                {row.summary ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {row.summary}
                  </p>
                ) : null}
                {row.latestRecordingUrl ? (
                  <a
                    href={row.latestRecordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    Recording
                  </a>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {row.match ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={
                        row.match.kind === "customer"
                          ? `/clients/${row.match.id}`
                          : `/leads/${row.match.id}`
                      }
                    >
                      Open
                    </Link>
                  </Button>
                ) : canWrite ? (
                  <div className="relative">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        setOpenMenu(openMenu === row.key ? null : row.key)
                      }
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Triage
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                    {openMenu === row.key ? (
                      <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-md">
                        <Link
                          href={triageHref("lead", row)}
                          className="block rounded px-2 py-1.5 text-sm hover:bg-muted"
                          onClick={() => setOpenMenu(null)}
                        >
                          Create lead
                        </Link>
                        <Link
                          href={triageHref("customer", row)}
                          className="block rounded px-2 py-1.5 text-sm hover:bg-muted"
                          onClick={() => setOpenMenu(null)}
                        >
                          New client
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => dismiss(row.key)}
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
