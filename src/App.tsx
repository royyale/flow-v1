import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import TodayView from "@/pages/TodayView";
import ClientsView from "@/pages/ClientsView";
import ClientDetail from "@/pages/ClientDetail";
import TasksView from "@/pages/TasksView";
import RemindersView from "@/pages/RemindersView";
import AIView from "@/pages/AIView";
import AnalyticsView from "@/pages/AnalyticsView";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/NotFound";
import SettingsView from "@/pages/SettingsView";
import GmailCallbackPage from "@/pages/GmailCallbackPage";
import ReviewInboxView from "@/pages/ReviewInboxView";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/settings/gmail/callback" element={<ProtectedRoute><GmailCallbackPage /></ProtectedRoute>} />
    <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
      <Route path="/" element={<TodayView />} />
      <Route path="/clients" element={<ClientsView />} />
      <Route path="/clients/:id" element={<ClientDetail />} />
      <Route path="/tasks" element={<TasksView />} />
      <Route path="/analytics" element={<AnalyticsView />} />
      <Route path="/reminders" element={<RemindersView />} />
      <Route path="/ai" element={<AIView />} />
      <Route path="/inbox" element={<ReviewInboxView />} />
      <Route path="/settings" element={<SettingsView />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
