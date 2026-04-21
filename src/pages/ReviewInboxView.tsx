import { format } from "date-fns";
import { Check, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { toast } from "sonner";

export default function ReviewInboxView() {
  const { data: items = [], approve, dismiss, isLoading } = useReviewQueue();

  const handleApprove = async (id: string) => {
    try {
      await approve(id);
      toast.success("Task approved and added to Tasks.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve task.");
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismiss(id);
      toast.success("Suggestion dismissed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not dismiss task.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Inbox className="w-6 h-6 text-primary" /> AI Review Inbox
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review Gmail-generated task suggestions before they are added.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading review queue...</p>}

      {!isLoading && !items.length && (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground text-sm">No pending AI-generated tasks.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="glass-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{item.task_title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.sender_name || item.sender_email} • {item.email_subject || "No subject"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Priority: {item.priority} • Due: {item.due_date ? format(new Date(item.due_date), "MMM d, yyyy") : "Not specified"}
                </p>
                {item.email_snippet && <p className="text-xs text-muted-foreground">{item.email_snippet}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleDismiss(item.id)} className="gap-1">
                  <X className="w-4 h-4" /> Dismiss
                </Button>
                <Button size="sm" onClick={() => handleApprove(item.id)} className="gap-1">
                  <Check className="w-4 h-4" /> Approve
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
