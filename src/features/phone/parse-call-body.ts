export type ParsedCallBody = {
  statusLine: string | null;
  transcript: string | null;
  summary: string | null;
  nextSteps: string | null;
  /** Inbound SMS text without the "SMS: " prefix (latest if multiple). */
  smsPreview: string | null;
};

function isStatusLine(line: string): boolean {
  if (line.startsWith("Transcript:") || line.startsWith("Summary:"))
    return false;
  return (
    line.startsWith("SMS:") ||
    line.startsWith("Inbound call") ||
    line.startsWith("Outbound call") ||
    line.startsWith("Missed call") ||
    line.startsWith("Voicemail") ||
    line.startsWith("AI answered") ||
    line.startsWith("Recording available")
  );
}

/** Split merged phone_event.body into display sections for the call log list. */
export function parseCallBody(body: string | null): ParsedCallBody {
  const lines = (body ?? "").split("\n").filter(Boolean);
  let statusLine: string | null = null;
  let transcript: string | null = null;
  let summary: string | null = null;
  let nextSteps: string | null = null;
  let smsPreview: string | null = null;

  for (const line of lines) {
    if (line.startsWith("Transcript: ")) {
      transcript = line.slice("Transcript: ".length);
    } else if (line.startsWith("Summary: ")) {
      const rest = line.slice("Summary: ".length);
      const nextIdx = rest.indexOf(" | Next: ");
      if (nextIdx >= 0) {
        summary = rest.slice(0, nextIdx);
        nextSteps = rest.slice(nextIdx + " | Next: ".length);
      } else {
        summary = rest;
      }
    } else if (line.startsWith("SMS: ")) {
      smsPreview = line.slice("SMS: ".length);
      statusLine = line;
    } else if (isStatusLine(line)) {
      statusLine = line;
    }
  }

  return { statusLine, transcript, summary, nextSteps, smsPreview };
}
