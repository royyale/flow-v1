import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CheckSquare, Clock, Bot,
  ChevronLeft, ChevronRight, LogOut,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Today", path: "/" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: CheckSquare, label: "Tasks", path: "/tasks" },
  { icon: Clock, label: "Reminders", path: "/reminders" },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, profile, user } = useAuth();

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}>
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 rounded-full border-[2px] border-primary-foreground border-r-transparent border-b-transparent rotate-45" />
            <div className="absolute inset-[17.5%] rounded-full border-[2px] border-primary-foreground border-l-transparent border-t-transparent rotate-45" />
            <div className="absolute w-[22%] h-[22%] bg-primary-foreground rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
        {!collapsed && <span className="text-foreground font-semibold text-lg tracking-tight">Clairo</span>}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${active ? "bg-primary/10 text-primary glow-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <button onClick={() => navigate("/ai")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${location.pathname === "/ai" ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
          <Bot className="w-5 h-5 shrink-0" />
          {!collapsed && <span>AI Chief of Staff</span>}
        </button>
      </div>

      {/* User & Sign out */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
          {user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          {!collapsed && <span className="text-xs text-sidebar-foreground truncate flex-1">{profile?.full_name || "User"}</span>}
          {!collapsed && (
            <button onClick={signOut} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}