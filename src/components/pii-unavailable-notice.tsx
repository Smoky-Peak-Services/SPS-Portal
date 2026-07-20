export function PiiUnavailableNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">Client (PII) database isn&apos;t configured</p>
      <p className="mt-1 text-amber-900/80">
        This deployment doesn&apos;t have a PII database URL yet, so clients,
        contacts, and service locations are unavailable. Field ops (jobs,
        tickets, schedule) still work without customer names.
      </p>
    </div>
  );
}
