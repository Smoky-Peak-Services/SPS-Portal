import { requireUser } from "@/lib/session";
import { PortalShell } from "@/components/portal-shell";
import { SessionWatchdog } from "@/components/session-watchdog";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <PortalShell
      capabilities={[...user.capabilities]}
      userName={user.name}
    >
      <SessionWatchdog />
      {children}
    </PortalShell>
  );
}
