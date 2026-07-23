import { redirect } from "next/navigation";

export default async function ClientActivityRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clients/${id}/notes`);
}
