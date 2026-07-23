"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { archiveCustomer, restoreCustomer } from "@/features/crm/actions";
import { Button } from "@/components/ui/button";

export function ArchiveCustomerButton({
  customerId,
  archived,
}: {
  customerId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        start(async () => {
          if (archived) {
            await restoreCustomer({ id: customerId });
            router.push(`/clients/${customerId}`);
          } else {
            await archiveCustomer({ id: customerId });
            router.push("/clients/archive");
          }
          router.refresh();
        });
      }}
    >
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
