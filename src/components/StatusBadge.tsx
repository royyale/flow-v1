import type { TaskStatus } from "@/lib/mockData";

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "status-urgent" },
  pending: { label: "Pending", className: "status-pending" },
  waiting: { label: "Waiting on Client", className: "status-waiting" },
  complete: { label: "Complete", className: "status-complete" },
};

export default function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
