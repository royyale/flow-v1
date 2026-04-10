import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { streamChat, type Msg } from "@/lib/chatStream";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const suggestions = [
  "What should I focus on today?",
  "Which clients need attention?",
  "Summarize my urgent tasks",
  "Give me a daily briefing",
];

export default function AIChatRail({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !session?.access_token) return;
    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        accessToken: session.access_token,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (msg) => {
          toast.error(msg);
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to AI");
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed right-0 top-0 h-screen bg-sidebar border-l border-sidebar-border flex flex-col z-50 animate-slide-in-right transition-all duration-300 ${isExpanded ? "w-[480px]" : "w-[360px]"}`}>
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm text-foreground">AI Chief of Staff</span>
            <p className="text-xs text-muted-foreground">Powered by Claude AI</p>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs">Try asking:</span>
            </div>
            {suggestions.map((s) => (
              <button key={s} onClick={() => sendMessage(s)}
                className="w-full text-left p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border/30">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about your clients..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isLoading} />
          <button onClick={() => sendMessage(input)}
            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors" disabled={isLoading}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
