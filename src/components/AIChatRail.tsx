import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, X, Maximize2, Minimize2, Sparkles, Plus, FileText,
  MessageSquare, Pencil, Trash2, Check, ChevronLeft, Paperclip
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { streamChat, type Msg } from "@/lib/chatStream";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import jsPDF from "jspdf";

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
    mutationFn: async (title = "New Chat") => {
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
      return data;
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

// ─── Document Forms (unchanged from your original) ────────────────────────────

function OfferLetterForm({ onSubmit, onClose }: { onSubmit: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ candidateName: "", role: "", company: "", salary: "", startDate: "", benefits: "" });
  return (
    <div className="p-4 bg-muted/50 rounded-xl border border-border/30 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Offer Letter</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      {[
        { key: "candidateName", placeholder: "Candidate full name" },
        { key: "role", placeholder: "Job title" },
        { key: "company", placeholder: "Company name" },
        { key: "salary", placeholder: "Salary (e.g. $85,000/year)" },
        { key: "startDate", placeholder: "Start date (e.g. May 1, 2026)" },
      ].map(({ key, placeholder }) => (
        <input key={key} placeholder={placeholder} value={form[key as keyof typeof form]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
      ))}
      <textarea placeholder="Benefits (health, PTO, remote, etc.)" value={form.benefits}
        onChange={e => setForm(f => ({ ...f, benefits: e.target.value }))}
        className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 h-20 resize-none" />
      <button onClick={() => onSubmit(form)} className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors">Generate PDF</button>
    </div>
  );
}

function OnboardingForm({ onSubmit, onClose }: { onSubmit: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ employeeName: "", role: "", company: "", startDate: "", manager: "", tools: "" });
  return (
    <div className="p-4 bg-muted/50 rounded-xl border border-border/30 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Onboarding Checklist</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      {[
        { key: "employeeName", placeholder: "Employee full name" },
        { key: "role", placeholder: "Job title" },
        { key: "company", placeholder: "Company name" },
        { key: "startDate", placeholder: "Start date" },
        { key: "manager", placeholder: "Manager name" },
      ].map(({ key, placeholder }) => (
        <input key={key} placeholder={placeholder} value={form[key as keyof typeof form]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
      ))}
      <textarea placeholder="Tools & systems to set up (Slack, Google Workspace, etc.)" value={form.tools}
        onChange={e => setForm(f => ({ ...f, tools: e.target.value }))}
        className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 h-20 resize-none" />
      <button onClick={() => onSubmit(form)} className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors">Generate PDF</button>
    </div>
  );
}

function FeedbackForm({ onSubmit, onClose }: { onSubmit: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ employeeName: "", role: "", company: "", period: "", strengths: "", improvements: "" });
  return (
    <div className="p-4 bg-muted/50 rounded-xl border border-border/30 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Performance Feedback</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      {[
        { key: "employeeName", placeholder: "Employee full name" },
        { key: "role", placeholder: "Job title" },
        { key: "company", placeholder: "Company name" },
        { key: "period", placeholder: "Review period (e.g. Q1 2026)" },
      ].map(({ key, placeholder }) => (
        <input key={key} placeholder={placeholder} value={form[key as keyof typeof form]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
      ))}
      <textarea placeholder="Key strengths observed" value={form.strengths}
        onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
        className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 h-20 resize-none" />
      <textarea placeholder="Areas for improvement" value={form.improvements}
        onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))}
        className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 h-20 resize-none" />
      <button onClick={() => onSubmit(form)} className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors">Generate PDF</button>
    </div>
  );
}

function JobDescriptionForm({ onSubmit, onClose }: { onSubmit: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ role: "", company: "", department: "", experience: "", responsibilities: "", requirements: "" });
  return (
    <div className="p-4 bg-muted/50 rounded-xl border border-border/30 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Job Description</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      {[
        { key: "role", placeholder: "Job title (e.g. HR Manager)" },
        { key: "company", placeholder: "Company name" },
        { key: "department", placeholder: "Department (e.g. People & Culture)" },
        { key: "experience", placeholder: "Years of experience required" },
      ].map(({ key, placeholder }) => (
        <input key={key} placeholder={placeholder} value={form[key as keyof typeof form]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
      ))}
      <textarea placeholder="Key responsibilities (one per line)" value={form.responsibilities}
        onChange={e => setForm(f => ({ ...f, responsibilities: e.target.value }))}
        className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 h-20 resize-none" />
      <textarea placeholder="Requirements & qualifications (one per line)" value={form.requirements}
        onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
        className="w-full bg-background border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 h-20 resize-none" />
      <button onClick={() => onSubmit(form)} className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors">Generate PDF</button>
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
  const [showMenu, setShowMenu] = useState(false);
  const [showJDForm, setShowJDForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

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

  // File upload handler
  const handleFileUpload = async (file: File) => {
    if (!session?.access_token) return;
    toast.info(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (activeSessionId) formData.append("sessionId", activeSessionId);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-document`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,  // ← quoted key fixes it
  } as HeadersInit,  // ← cast tells TypeScript to trust us
  body: formData,
});

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`${file.name} uploaded and indexed!`);
      // Let the AI know a document was added
      sendMessage(`I just uploaded a document called "${file.name}". Please acknowledge it and let me know you can answer questions about it.`);
    } catch (e: any) {
      toast.error(`Upload failed: ${e.message}`);
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
    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        onDelta: upsertAssistant,
        onDone: async () => {
          setIsStreaming(false);
          // Save assistant response to Supabase
          if (assistantContent) await saveMessage("assistant", assistantContent);
          // Refresh session list so updated_at sorts correctly
          queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
        },
        onError: (msg) => { toast.error(msg); setIsStreaming(false); },
      });
    } catch (e) {
      toast.error("Failed to connect to AI");
      setIsStreaming(false);
    }
  };

  // ── PDF generation (unchanged from your original) ────────────────────────

  const generateDoc = async (title: string, filename: string, prompt: string, subtitle: string) => {
    if (!session?.access_token) return;
    toast.info(`Generating ${title}...`);
    setIsStreaming(true);
    let fullContent = "";
    setMessages(prev => [...prev, { role: "user", content: `Generate a ${title}` }]);
    try {
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        onDelta: (chunk) => {
          fullContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent } : m);
            return [...prev, { role: "assistant", content: fullContent }];
          });
        },
        onDone: () => {
          setIsStreaming(false);
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();
          const margin = 20;
          const maxWidth = pageWidth - margin * 2;
          doc.setFontSize(20); doc.setFont("helvetica", "bold");
          doc.text(title, margin, 30);
          doc.setFontSize(12); doc.setFont("helvetica", "normal");
          doc.text(subtitle, margin, 42);
          doc.setDrawColor(45, 212, 191); doc.setLineWidth(0.5);
          doc.line(margin, 48, pageWidth - margin, 48);
          const clean = fullContent.replace(/#{1,6}\s/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/━/g, "-").replace(/[^\x00-\x7F]/g, "");
          const lines = doc.splitTextToSize(clean, maxWidth);
          let y = 58; doc.setFontSize(10);
          lines.forEach((line: string) => { if (y > 270) { doc.addPage(); y = 20; } doc.text(line, margin, y); y += 6; });
          doc.save(filename);
          toast.success("PDF downloaded!");
        },
        onError: (msg) => { toast.error(msg); setIsStreaming(false); },
      });
    } catch { toast.error("Failed to generate document"); setIsStreaming(false); }
  };

  const generateOfferLetter = (form: any) => {
    setShowOfferForm(false);
    generateDoc("Offer Letter", `${form.candidateName.replace(/\s+/g, "_")}_Offer_Letter.pdf`,
      `Generate a professional, formal offer letter for the following candidate. Include sections for: greeting, position details, compensation, benefits, start date, conditions of employment, and a warm closing.\nCandidate: ${form.candidateName}\nRole: ${form.role}\nCompany: ${form.company}\nSalary: ${form.salary}\nStart Date: ${form.startDate}\nBenefits: ${form.benefits}`,
      `${form.company} - ${form.role}`);
  };

  const generateOnboarding = (form: any) => {
    setShowOnboardingForm(false);
    generateDoc("Onboarding Checklist", `${form.employeeName.replace(/\s+/g, "_")}_Onboarding.pdf`,
      `Generate a comprehensive onboarding checklist for a new employee. Include sections for: Before Day 1, Day 1, Week 1, Month 1, and 90-Day milestones.\nEmployee: ${form.employeeName}\nRole: ${form.role}\nCompany: ${form.company}\nStart Date: ${form.startDate}\nManager: ${form.manager}\nTools: ${form.tools}`,
      `${form.company} - ${form.role}`);
  };

  const generateFeedback = (form: any) => {
    setShowFeedbackForm(false);
    generateDoc("Performance Feedback", `${form.employeeName.replace(/\s+/g, "_")}_Feedback_${form.period.replace(/\s+/g, "_")}.pdf`,
      `Generate a professional performance feedback document. Include: Executive Summary, Key Strengths, Areas for Development, Goals for Next Period, Overall Rating.\nEmployee: ${form.employeeName}\nRole: ${form.role}\nCompany: ${form.company}\nPeriod: ${form.period}\nStrengths: ${form.strengths}\nImprovements: ${form.improvements}`,
      `${form.company} - ${form.period}`);
  };

  const generateJobDescription = async (form: any) => {
    setShowJDForm(false);
    generateDoc("Job Description", `${form.role.replace(/\s+/g, "_")}_Job_Description.pdf`,
      `Generate a professional, comprehensive job description. Format with sections: Job Title, Company Overview, Role Summary, Key Responsibilities, Required Qualifications, Preferred Qualifications, What We Offer.\nRole: ${form.role}\nCompany: ${form.company}\nDepartment: ${form.department}\nExperience: ${form.experience} years\nResponsibilities: ${form.responsibilities}\nRequirements: ${form.requirements}`,
      `${form.company} · ${form.department}`);
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
          {messages.length === 0 && !showJDForm && !showOfferForm && !showOnboardingForm && !showFeedbackForm && (
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

          {showJDForm && <JobDescriptionForm onSubmit={generateJobDescription} onClose={() => setShowJDForm(false)} />}
          {showOfferForm && <OfferLetterForm onSubmit={generateOfferLetter} onClose={() => setShowOfferForm(false)} />}
          {showOnboardingForm && <OnboardingForm onSubmit={generateOnboarding} onClose={() => setShowOnboardingForm(false)} />}
          {showFeedbackForm && <FeedbackForm onSubmit={generateFeedback} onClose={() => setShowFeedbackForm(false)} />}

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

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-sidebar-border space-y-2 shrink-0">
          {/* Hidden file input */}
          <input
            type="file"
            id="flow-file-upload"
            accept=".pdf,.docx,.txt,.csv,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { handleFileUpload(file); setShowMenu(false); }
              e.target.value = "";
            }}
          />
          {showMenu && (
            <div className="bg-muted rounded-xl border border-border/30 overflow-hidden">
              {/* Upload Document — Week 4 RAG */}
              <button
                onClick={() => document.getElementById("flow-file-upload")?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/80 transition-colors border-b border-border/20">
                <Paperclip className="w-4 h-4 text-primary" /> Upload Document
              </button>
              {[
                { label: "Job Description", action: () => { setShowJDForm(true); setShowMenu(false); } },
                { label: "Offer Letter", action: () => { setShowOfferForm(true); setShowMenu(false); } },
                { label: "Onboarding Checklist", action: () => { setShowOnboardingForm(true); setShowMenu(false); } },
                { label: "Performance Feedback", action: () => { setShowFeedbackForm(true); setShowMenu(false); } },
              ].map(({ label, action }, i, arr) => (
                <button key={label} onClick={action}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/80 transition-colors ${i < arr.length - 1 ? "border-b border-border/20" : ""}`}>
                  <FileText className="w-4 h-4 text-primary" /> {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
            <button onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </button>
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