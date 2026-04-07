import { Bot } from "lucide-react";
import AIChatRail from "@/components/AIChatRail";

export default function AIView() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)] animate-fade-in">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">AI Chief of Staff</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Use the chat panel on the right to ask about your clients, tasks, and priorities. 
          The AI provides context-aware suggestions and surfaces what needs attention.
        </p>
        <p className="text-xs text-muted-foreground">
          Click the AI button in the sidebar or use the chat rail →
        </p>
      </div>
    </div>
  );
}