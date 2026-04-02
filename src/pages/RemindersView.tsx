import { Bell, Clock, CheckCircle2 } from "lucide-react";
import { reminders } from "@/lib/mockData";

const typeIcons = { "follow-up": Clock, deadline: Bell, "check-in": CheckCircle2 };

export default function RemindersView() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6 text-accent" />
          Reminders
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{reminders.filter(r => r.dueDate === "Today").length} due today</p>
      </div>

      <div className="glass-card divide-y divide-border/30">
        {reminders.map((r) => {
          const Icon = typeIcons[r.type];
          return (
            <div key={r.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.clientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${r.dueDate === "Today" ? "text-destructive" : "text-muted-foreground"}`}>
                  {r.dueDate}
                </span>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  Done
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
