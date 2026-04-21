import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, X, Maximize2, Minimize2, Sparkles, Plus,
  MessageSquare, Pencil, Trash2, Check, ChevronLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { streamChat, type Msg } from "@/lib/chatStream";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatSession {
  id: string;
  title: string;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

const suggestions = [
  "What should I focus on today?",
  "Which clients need attention?",
  "Summarize my urgent tasks",
  "Give me a daily briefing",
];

// ─── Session Hooks ────────────────────────────────────────────────────────────

function useChatSessions() {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createSession = useMutation({
    mutationFn: async (title: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ title, consultant_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as ChatSession;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-sessions"] }),
  });

  const renameSession = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ title })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-sessions"] }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-sessions"] }),
  });

  return { sessions, isLoading, createSession, renameSession, deleteSession };
}

function useChatMessages(sessionId: string | null) {
  const queryClient = useQueryClient();

  const { data: savedMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!sessionId,
  });

  const saveMessage = async (role: "user" | "assistant", content: string) => {
    if (!sessionId) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: user!.id,
      role,
      content,
    });
    queryClient.invalidateQueries({ queryKey: ["chat-messages", sessionId] });
  };

  return { savedMessages, saveMessage };
}

// ─── Chat History Sidebar ─────────────────────────────────────────────────────

function ChatHistorySidebar({
  sessions,
  isLoading,
  activeSessionId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
}: {
  sessions: ChatSession[];
  isLoading: boolean;
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  // Group by recency
  const grouped = sessions.reduce((acc, s) => {
    const days = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / 86400000);
    const group = days === 0 ? "Today" : days === 1 ? "Yesterday" : days <= 7 ? "This Week" : "Older";
    if (!acc[group]) acc[group] = [];
    acc[group].push(s);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  const groupOrder = ["Today", "Yesterday", "This Week", "Older"];

  return (
    <div className="flex flex-col h-full w-[200px] border-r border-sidebar-border bg-sidebar shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chats</span>
        <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New Chat */}
      <div className="p-2">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-primary border border-primary/25 bg-primary/8 hover:bg-primary/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading && (
          <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
        )}
        {!isLoading && sessions.length === 0 && (
          <div className="text-center py-6">
            <MessageSquare className="w-5 h-5 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs text-muted-foreground">No chats yet</p>
          </div>
        )}
        {groupOrder.map((group) => {
          const items = grouped[group];
          if (!items?.length) return null;
          return (
            <div key={group}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-3 pb-1">
                {group}
              </p>
              {items.map((session) => (
                <div
                  key={session.id}
                  onClick={() => onSelect(session.id)}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer mb-0.5 transition-all ${
                    activeSessionId === session.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/60 border border-transparent"
                  }`}
                >
                  <MessageSquare className={`w-3 h-3 shrink-0 ${activeSessionId === session.id ? "text-primary" : "text-muted-foreground"}`} />

                  {editingId === session.id ? (
                    <input
                      ref={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { onRename(session.id, editValue); setEditingId(null); }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-background border border-primary/40 rounded px-1 text-xs text-foreground outline-none min-w-0"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-xs truncate min-w-0 ${activeSessionId === session.id ? "text-foreground" : "text-muted-foreground"}`}
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingId(session.id); setEditValue(session.title); }}
                    >
                      {session.title}
                    </span>
                  )}

                  {/* Action icons */}
                  <div className={`flex gap-0.5 shrink-0 transition-opacity ${
                    editingId === session.id || hoveredId === session.id || activeSessionId === session.id ? "opacity-100" : "opacity-0"
                  }`}>
                    {editingId === session.id ? (
                      <button onClick={(e) => { e.stopPropagation(); onRename(session.id, editValue); setEditingId(null); }}
                        className="p-0.5 text-primary hover:text-primary/80">
                        <Check className="w-3 h-3" />
                      </button>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(session.id); setEditValue(session.title); }}
                          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                          className="p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Flow Loading Indicator ───────────────────────────────────────────────────

function FlowLoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2.5">
        <style>{`
          @keyframes flowPulse {
            0%, 100% { transform: scale(0.4); opacity: 0.3; }
            50%       { transform: scale(1.0); opacity: 1.0; }
          }
        `}</style>
        <div style={{ display: "flex", gap: "3px", alignItems: "center", height: "8px" }}>
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="bg-primary rounded-sm"
              style={{
                width: "8px",
                height: "8px",
                animation: "flowPulse 900ms ease-in-out infinite",
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIChatRail({
  isOpen,
  onToggle,
  onExpandedChange,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onExpandedChange?: (v: boolean) => void;
}) {
  const { session } = useAuth();
  const { createTask } = useTasks();
  const queryClient = useQueryClient();

  // Session management
  const { sessions, isLoading, createSession, renameSession, deleteSession } = useChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);

  // Form state

  const bottomRef = useRef<HTMLDivElement>(null);
  const { savedMessages, saveMessage } = useChatMessages(activeSessionId);

  // Load saved messages when switching sessions
  useEffect(() => {
    if (savedMessages.length > 0) {
      setMessages(savedMessages.map(m => ({ role: m.role, content: m.content })));
      setIsFirstMessage(false);
    }
  }, [savedMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Session actions ──────────────────────────────────────────────────────

  const handleNewChat = async () => {
    const newSession = await createSession.mutateAsync("New Chat");
    setActiveSessionId(newSession.id);
    setMessages([]);
    setIsFirstMessage(true);
    setShowHistory(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setMessages([]);
    setIsFirstMessage(false);
    setShowHistory(false);
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Delete this chat?")) return;
    await deleteSession.mutateAsync(id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
      setIsFirstMessage(true);
    }
  };

  const handleRenameSession = async (id: string, title: string) => {
    if (!title.trim()) return;
    await renameSession.mutateAsync({ id, title: title.trim() });
  };

  // Auto-title after first message — calls dedicated edge function
  const autoTitle = async (sessionId: string, firstMessage: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-title`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ sessionId, firstMessage }),
      });
      // Refresh sidebar so new title appears immediately
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    } catch {
      // silently fail — title stays "New Chat"
    }
  };

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming || !session?.access_token) return;

    // Create session on first message if none exists
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const newSession = await createSession.mutateAsync("New Chat");
      currentSessionId = newSession.id;
      setActiveSessionId(currentSessionId);
    }

    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Save user message to Supabase
    await saveMessage("user", text);

    // Auto-title on first real message
    if (isFirstMessage) {
      setIsFirstMessage(false);
      autoTitle(currentSessionId, text);
    }

    let assistantContent = "";

    try {
      await streamChat({
        messages: newMessages,
        onDelta: (chunk) => { assistantContent += chunk; },
        onDone: async () => {
          setIsStreaming(false);
          if (assistantContent) {
            setMessages(prev => [...prev, { role: "assistant", content: assistantContent }]);
            await saveMessage("assistant", assistantContent);
          }
          queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
        },
        onError: (msg) => { toast.error(msg); setIsStreaming(false); },
      });
    } catch (e) {
      toast.error("Failed to connect to AI");
      setIsStreaming(false);
    }
  };

  if (!isOpen) return null;

  const panelWidth = isExpanded ? "w-[640px]" : "w-[360px]";

  return (
    <div className={`fixed right-0 top-0 h-screen bg-sidebar border-l border-sidebar-border flex flex-row z-50 animate-slide-in-right transition-all duration-300 ${panelWidth}`}>

      {/* ── Chat History Sidebar ── */}
      {showHistory && (
        <ChatHistorySidebar
          sessions={sessions}
          isLoading={isLoading}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onNew={handleNewChat}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* ── Main Chat Panel ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* History toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              title="Chat history"
              className={`p-1.5 rounded-lg transition-colors ${showHistory ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-sm text-foreground">Flow Chief of Staff</span>
              <p className="text-xs text-muted-foreground">Powered by Claude AI</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { handleNewChat(); setShowHistory(true); toast.success("New chat started"); }}
              title="New chat"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => { const next = !isExpanded; setIsExpanded(next); onExpandedChange?.(next); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onToggle}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
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
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="space-y-2">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <button
                      onClick={() => {
                        const title = msg.content.split("\n").find(l => l.trim()) || "Follow up task";
                        const clean = title.replace(/^[-*#>\s]+/, "").slice(0, 80);
                        createTask({ title: clean, description: "Created from AI chat", priority: "medium" });
                        toast.success("Task created!");
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                      + Create task from this
                    </button>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          ))}

          {isStreaming && <FlowLoadingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-sidebar-border space-y-2 shrink-0">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about your clients..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              disabled={isStreaming}
            />
            <button onClick={() => sendMessage(input)}
              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              disabled={isStreaming}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}