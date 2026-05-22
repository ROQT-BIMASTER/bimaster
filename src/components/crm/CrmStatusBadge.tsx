import { cn } from "@/lib/utils";
import { statusBadgeClass, statusLabel } from "@/lib/crm/format";

interface Props {
  status: string;
  className?: string;
}

export function CrmStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        statusBadgeClass(status),
        className,
      )}
    >
      {statusLabel[status] ?? status}
    </span>
  );
}
