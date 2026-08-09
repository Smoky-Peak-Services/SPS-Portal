/** Legacy Quo webhook URL still present in Quo config. Single implementation lives in /api/webhooks/openphone. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@/app/api/webhooks/openphone/route";
