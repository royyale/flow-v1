import { useState } from "react";
import { Bot, Send, X, Maximize2, Minimize2, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "What's pending for Atlas Group?",
  "What should I do before my 1 PM call?",
  "Which clients need attention today?",
  "Summarize Rachel Kim's open issues",
];

const mockResponses: Record<string, string> = {
  "What's pending for Atlas Group?":
    "**Atlas Group — 3 pending items:**\n\n1. 🔴 **Review employment agreement draft** — Due today (Apr 2). Final review needed before Apr 5 board meeting.\n2. ⚠️ **Board deadline approaching** — Agreement must be finalized before the board meeting.\n3. 📞 **Contract review call** scheduled at 3:30 PM today.\n\n**Suggested next action:** Review the agreement draft now so it's ready for this afternoon's call with James.",
  "What should I do before my 1 PM call?":
    "**Before your 1:00 PM — Summit Partners call:**\n\n1. Review the investigation summary (currently waiting on witness statements)\n2. Check Michael Torres' timeline — last contact was 1 week ago\n3. Prepare an update on the EEOC inquiry response (due Apr 3)\n\n**⚡ Priority:** The investigation has been stalled. Consider asking Michael directly about the witness statements.",
  "Which clients need attention today?":
    "**3 clients need attention today:**\n\n1. 🔴 **Rachel Kim (Vertex Inc)** — Health score 45. 3 compliance findings unresolved, 7 open tasks. Follow-up due today.\n2. 🔴 **Michael Torres (Summit Partners)** — Health score 55. Investigation stalled for 1 week. EEOC response due Apr 3.\n3. ⚠️ **James Whitfield (Atlas Group)** — Health score 67. Employment agreement must be reviewed today.\n\n**Anna Volkov and Tom Bradley are in great shape** — no action needed.",
};

export default function AIChatRail({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTimeout(() => {
      const response = mockResponses[text] || 
        `I've reviewed your request about "${text}". Based on your current workload, I'd recommend prioritizing the urgent items first. Would you like me to break this down further?`;
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed right-0 top-0 h-screen bg-sidebar border-l border-sidebar-border flex flex-col z-50 animate-slide-in-right transition-all duration-300 ${
        isExpanded ? "w-[480px]" : "w-[360px]"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm text-foreground">AI Chief of Staff</span>
            <p className="text-xs text-muted-foreground">Ask anything about your clients</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onToggle} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs">Try asking:</span>
            </div>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="w-full text-left p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border/30"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask about your clients..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={() => sendMessage(input)}
            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
