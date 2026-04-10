import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Maximize2, Minimize2, Sparkles, Plus, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { streamChat, type Msg } from "@/lib/chatStream";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import jsPDF from "jspdf";

const suggestions = [
  "What should I focus on today?",
  "Which clients need attention?",
  "Summarize my urgent tasks",
  "Give me a daily briefing",
];

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
      <button onClick={() => onSubmit(form)}
        className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
        Generate PDF
      </button>
    </div>
  );
}

export default function AIChatRail({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { session } = useAuth();
  const { createTask } = useTasks();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showJDForm, setShowJDForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
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
        onError: (msg) => { toast.error(msg); setIsLoading(false); },
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to AI");
      setIsLoading(false);
    }
  };

  const generateDoc = async (title: string, filename: string, prompt: string, subtitle: string) => {
    if (!session?.access_token) return;
    toast.info(`Generating ${title}...`);
    setIsLoading(true);
    let fullContent = "";
    setMessages(prev => [...prev, { role: "user", content: `Generate a ${title}` }]);
    try {
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        accessToken: session.access_token,
        onDelta: (chunk) => {
          fullContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent } : m);
            return [...prev, { role: "assistant", content: fullContent }];
          });
        },
        onDone: () => {
          setIsLoading(false);
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
        onError: (msg) => { toast.error(msg); setIsLoading(false); },
      });
    } catch (e) { toast.error("Failed to generate document"); setIsLoading(false); }
  };

  const generateOfferLetter = (form: any) => {
    setShowOfferForm(false);
    generateDoc("Offer Letter", `${form.candidateName.replace(/\s+/g, "_")}_Offer_Letter.pdf`,
      `Generate a professional, formal offer letter for the following candidate. Include sections for: greeting, position details, compensation, benefits, start date, conditions of employment, and a warm closing.
Candidate: ${form.candidateName}
Role: ${form.role}
Company: ${form.company}
Salary: ${form.salary}
Start Date: ${form.startDate}
Benefits: ${form.benefits}`,
      `${form.company} - ${form.role}`);
  };

  const generateOnboarding = (form: any) => {
    setShowOnboardingForm(false);
    generateDoc("Onboarding Checklist", `${form.employeeName.replace(/\s+/g, "_")}_Onboarding.pdf`,
      `Generate a comprehensive onboarding checklist for a new employee. Include sections for: Before Day 1, Day 1, Week 1, Month 1, and 90-Day milestones. Make it practical and actionable.
Employee: ${form.employeeName}
Role: ${form.role}
Company: ${form.company}
Start Date: ${form.startDate}
Manager: ${form.manager}
Tools to set up: ${form.tools}`,
      `${form.company} - ${form.role}`);
  };

  const generateFeedback = (form: any) => {
    setShowFeedbackForm(false);
    generateDoc("Performance Feedback", `${form.employeeName.replace(/\s+/g, "_")}_Feedback_${form.period.replace(/\s+/g, "_")}.pdf`,
      `Generate a professional performance feedback document. Include sections for: Executive Summary, Key Strengths, Areas for Development, Goals for Next Period, and Overall Rating with commentary.
Employee: ${form.employeeName}
Role: ${form.role}
Company: ${form.company}
Review Period: ${form.period}
Strengths: ${form.strengths}
Areas for Improvement: ${form.improvements}`,
      `${form.company} - ${form.period}`);
  };


  const generateJobDescription = async (form: any) => {
    setShowJDForm(false);
    if (!session?.access_token) return;
    toast.info("Generating job description...");
    setIsLoading(true);

    const prompt = `Generate a professional, comprehensive job description for the following role. Format it clearly with sections for: Job Title, Company Overview, Role Summary, Key Responsibilities, Required Qualifications, Preferred Qualifications, and What We Offer.

Role: ${form.role}
Company: ${form.company}
Department: ${form.department}
Experience Required: ${form.experience} years
Key Responsibilities: ${form.responsibilities}
Requirements: ${form.requirements}

Make it compelling, inclusive, and professional. Use clear formatting with bullet points.`;

    let fullContent = "";
    const userMsg: Msg = { role: "user", content: `Generate a job description for ${form.role} at ${form.company}` };
    setMessages(prev => [...prev, userMsg]);

    try {
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        accessToken: session.access_token,
        onDelta: (chunk) => {
          fullContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullContent } : m);
            }
            return [...prev, { role: "assistant", content: fullContent }];
          });
        },
        onDone: () => {
          setIsLoading(false);
          // Generate PDF
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();
          const margin = 20;
          const maxWidth = pageWidth - margin * 2;

          doc.setFontSize(20);
          doc.setFont("helvetica", "bold");
          doc.text(`${form.role}`, margin, 30);

          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text(`${form.company} · ${form.department}`, margin, 42);

          doc.setDrawColor(45, 212, 191);
          doc.setLineWidth(0.5);
          doc.line(margin, 48, pageWidth - margin, 48);

          const clean = fullContent
          .replace(/#{1,6}\s/g, "")
          .replace(/\*\*/g, "")
          .replace(/\*/g, "")
          .replace(/━/g, "-")
          .replace(/[^\x00-\x7F]/g, "");
          const lines = doc.splitTextToSize(clean, maxWidth);

          let y = 58;
          doc.setFontSize(10);
          lines.forEach((line: string) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(line, margin, y);
            y += 6;
          });

          doc.save(`${form.role.replace(/\s+/g, "_")}_Job_Description.pdf`);
          toast.success("PDF downloaded!");
        },
        onError: (msg) => { toast.error(msg); setIsLoading(false); },
      });
    } catch (e) {
      toast.error("Failed to generate job description");
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
            <span className="font-semibold text-sm text-foreground">Flow Chief of Staff</span>
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
        {messages.length === 0 && !showJDForm && (
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
              msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
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
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground animate-pulse">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        {showMenu && (
          <div className="bg-muted rounded-xl border border-border/30 overflow-hidden">
            <button onClick={() => { setShowJDForm(true); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/80 transition-colors border-b border-border/20">
              <FileText className="w-4 h-4 text-primary" /> Job Description
            </button>
            <button onClick={() => { setShowOfferForm(true); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/80 transition-colors border-b border-border/20">
              <FileText className="w-4 h-4 text-primary" /> Offer Letter
            </button>
            <button onClick={() => { setShowOnboardingForm(true); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/80 transition-colors border-b border-border/20">
              <FileText className="w-4 h-4 text-primary" /> Onboarding Checklist
            </button>
            <button onClick={() => { setShowFeedbackForm(true); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/80 transition-colors">
              <FileText className="w-4 h-4 text-primary" /> Performance Feedback
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <button onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors">
            <Plus className="w-4 h-4" />
          </button>
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