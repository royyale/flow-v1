import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import TodayView from "@/pages/TodayView";
import ClientsView from "@/pages/ClientsView";
import ClientDetail from "@/pages/ClientDetail";
import TasksView from "@/pages/TasksView";
import RemindersView from "@/pages/RemindersView";
import AIView from "@/pages/AIView";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<TodayView />} />
            <Route path="/clients" element={<ClientsView />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/tasks" element={<TasksView />} />
            <Route path="/reminders" element={<RemindersView />} />
            <Route path="/ai" element={<AIView />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
