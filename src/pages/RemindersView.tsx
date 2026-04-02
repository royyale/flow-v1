import { Bell, Clock, CheckCircle2 } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday } from "date-fns";

const typeIcons = { "follow-up": Clock, deadline: Bell, "check-in": CheckCircle2 };

export default function RemindersView() {
  const { data: reminders = [], refetch } = useReminders();
  const activeReminders = reminders.filter(r => !r.is_done);

  const markDone = async (id: string) => {
    const { error } = await supabase.from("reminders").update({ is_done: true } as any).eq("id", id);
    if (error) toast.error(error.message);
    else refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6 text-accent" /> Reminders
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{activeReminders.filter(r => isToday(new Date(r.due_date))).length} due today</p>
      </div>

      {activeReminders.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground text-sm">No active reminders.</p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-border/30">
          {activeReminders.map((r) => {
            const Icon = typeIcons[r.type as keyof typeof typeIcons] || Bell;
            const dueToday = isToday(new Date(r.due_date));
            return (
              <div key={r.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${dueToday ? "text-destructive" : "text-muted-foreground"}`}>
                    {dueToday ? "Today" : format(new Date(r.due_date), "MMM d")}
                  </span>
                  <button onClick={() => markDone(r.id)} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    Done
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
