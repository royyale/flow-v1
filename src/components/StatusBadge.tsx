const statusConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "status-urgent" },
  pending: { label: "Pending", className: "status-pending" },
  waiting: { label: "Waiting on Client", className: "status-waiting" },
  complete: { label: "Complete", className: "status-complete" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
