import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import AIChatRail from "@/components/AIChatRail";
import { Bot } from "lucide-react";

export default function DashboardLayout() {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setAiOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Match left margin to sidebar collapsed state
  const leftMargin = collapsed ? "ml-16" : "ml-56";

  // Match right margin to AI panel width
  const rightMargin = !aiOpen
    ? ""
    : aiExpanded
    ? "mr-[640px]"
    : "mr-[360px]";

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar onCollapsedChange={setCollapsed} />

      <main className={`transition-all duration-300 ${leftMargin} p-8 ${rightMargin}`}>
        <Outlet />
      </main>

      {/* AI toggle FAB */}
      {!aiOpen && (
        <button
          onClick={() => setAiOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg glow-primary hover:scale-105 transition-transform z-40"
        >
          <Bot className="w-5 h-5" />
        </button>
      )}

      <AIChatRail
        isOpen={aiOpen}
        onToggle={() => setAiOpen(false)}
        onExpandedChange={setAiExpanded}
      />
    </div>
  );
}