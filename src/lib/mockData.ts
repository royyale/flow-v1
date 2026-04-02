export type ClientStatus = "active" | "at-risk" | "stable";
export type TaskStatus = "urgent" | "pending" | "waiting" | "complete";
export type Priority = "high" | "medium" | "low";

export interface Client {
  id: string;
  name: string;
  company: string;
  role: string;
  avatar: string;
  healthScore: number;
  status: ClientStatus;
  lastContact: string;
  nextDeadline: string;
  openTasks: number;
  openIssues: number;
}

export interface Task {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  description?: string;
}

export interface TimelineEvent {
  id: string;
  clientId: string;
  type: "email" | "meeting" | "task" | "note" | "issue";
  title: string;
  description: string;
  date: string;
  status?: string;
}

export interface Reminder {
  id: string;
  title: string;
  clientName: string;
  dueDate: string;
  type: "follow-up" | "deadline" | "check-in";
}

export const clients: Client[] = [
  { id: "1", name: "Sarah Chen", company: "Meridian Corp", role: "VP Operations", avatar: "SC", healthScore: 92, status: "active", lastContact: "Today", nextDeadline: "Apr 4", openTasks: 2, openIssues: 0 },
  { id: "2", name: "James Whitfield", company: "Atlas Group", role: "CEO", avatar: "JW", healthScore: 67, status: "at-risk", lastContact: "3 days ago", nextDeadline: "Apr 3", openTasks: 5, openIssues: 2 },
  { id: "3", name: "Maria Rodriguez", company: "Solace Health", role: "HR Director", avatar: "MR", healthScore: 85, status: "active", lastContact: "Yesterday", nextDeadline: "Apr 8", openTasks: 3, openIssues: 1 },
  { id: "4", name: "David Park", company: "NovaTech", role: "COO", avatar: "DP", healthScore: 78, status: "stable", lastContact: "2 days ago", nextDeadline: "Apr 5", openTasks: 1, openIssues: 0 },
  { id: "5", name: "Rachel Kim", company: "Vertex Inc", role: "General Counsel", avatar: "RK", healthScore: 45, status: "at-risk", lastContact: "5 days ago", nextDeadline: "Apr 2", openTasks: 7, openIssues: 3 },
  { id: "6", name: "Tom Bradley", company: "Ironclad Ltd", role: "CFO", avatar: "TB", healthScore: 88, status: "active", lastContact: "Today", nextDeadline: "Apr 10", openTasks: 1, openIssues: 0 },
  { id: "7", name: "Lisa Nguyen", company: "Bright Path", role: "Director", avatar: "LN", healthScore: 72, status: "stable", lastContact: "4 days ago", nextDeadline: "Apr 6", openTasks: 4, openIssues: 1 },
  { id: "8", name: "Michael Torres", company: "Summit Partners", role: "Managing Partner", avatar: "MT", healthScore: 55, status: "at-risk", lastContact: "1 week ago", nextDeadline: "Apr 3", openTasks: 6, openIssues: 2 },
  { id: "9", name: "Anna Volkov", company: "ClearEdge", role: "VP Strategy", avatar: "AV", healthScore: 94, status: "active", lastContact: "Today", nextDeadline: "Apr 12", openTasks: 0, openIssues: 0 },
];

export const tasks: Task[] = [
  { id: "t1", title: "Review employment agreement draft", clientId: "2", clientName: "Atlas Group", status: "urgent", priority: "high", dueDate: "Apr 2", description: "Final review before board meeting" },
  { id: "t2", title: "Follow up on compliance audit findings", clientId: "5", clientName: "Vertex Inc", status: "urgent", priority: "high", dueDate: "Apr 2", description: "3 outstanding items need resolution" },
  { id: "t3", title: "Send updated policy handbook", clientId: "3", clientName: "Solace Health", status: "pending", priority: "medium", dueDate: "Apr 4" },
  { id: "t4", title: "Schedule quarterly review call", clientId: "1", clientName: "Meridian Corp", status: "pending", priority: "medium", dueDate: "Apr 5" },
  { id: "t5", title: "Prepare investigation summary", clientId: "8", clientName: "Summit Partners", status: "waiting", priority: "high", dueDate: "Apr 3", description: "Waiting on witness statements" },
  { id: "t6", title: "File benefits enrollment changes", clientId: "4", clientName: "NovaTech", status: "complete", priority: "low", dueDate: "Apr 1" },
  { id: "t7", title: "Draft termination letter", clientId: "5", clientName: "Vertex Inc", status: "urgent", priority: "high", dueDate: "Apr 2" },
  { id: "t8", title: "Review contractor agreements", clientId: "7", clientName: "Bright Path", status: "pending", priority: "medium", dueDate: "Apr 6" },
  { id: "t9", title: "Update onboarding checklist", clientId: "6", clientName: "Ironclad Ltd", status: "complete", priority: "low", dueDate: "Mar 30" },
  { id: "t10", title: "Respond to EEOC inquiry", clientId: "8", clientName: "Summit Partners", status: "urgent", priority: "high", dueDate: "Apr 3" },
];

export const timelineEvents: TimelineEvent[] = [
  { id: "e1", clientId: "2", type: "meeting", title: "Strategy call with James", description: "Discussed restructuring timeline. James expressed concern about legal exposure.", date: "Apr 1, 2:00 PM" },
  { id: "e2", clientId: "2", type: "email", title: "Sent employment agreement v2", description: "Updated non-compete clause per James' request.", date: "Mar 31, 4:15 PM" },
  { id: "e3", clientId: "2", type: "task", title: "Created: Review employment agreement draft", description: "Due Apr 2 — marked urgent", date: "Mar 31, 4:30 PM" },
  { id: "e4", clientId: "2", type: "issue", title: "Board deadline approaching", description: "Agreement must be finalized before Apr 5 board meeting", date: "Mar 30, 9:00 AM", status: "open" },
  { id: "e5", clientId: "2", type: "note", title: "Internal note", description: "James mentioned potential M&A activity — may need expanded scope soon.", date: "Mar 28, 11:00 AM" },
  { id: "e6", clientId: "5", type: "issue", title: "Compliance audit — 3 findings", description: "Missing I-9s, outdated handbook policy, incomplete training records", date: "Mar 29, 10:00 AM", status: "open" },
  { id: "e7", clientId: "5", type: "meeting", title: "Audit review call", description: "Walked through findings. Rachel wants resolution plan by EOW.", date: "Mar 30, 3:00 PM" },
];

export const reminders: Reminder[] = [
  { id: "r1", title: "Follow up with Rachel on compliance items", clientName: "Vertex Inc", dueDate: "Today", type: "follow-up" },
  { id: "r2", title: "Board agreement deadline — Atlas Group", clientName: "Atlas Group", dueDate: "Apr 5", type: "deadline" },
  { id: "r3", title: "Check in with Michael — investigation stalled", clientName: "Summit Partners", dueDate: "Today", type: "check-in" },
  { id: "r4", title: "Send quarterly report to Sarah", clientName: "Meridian Corp", dueDate: "Apr 5", type: "follow-up" },
];

export const todayMeetings = [
  { time: "10:00 AM", title: "Weekly sync — Solace Health", client: "Maria Rodriguez" },
  { time: "1:00 PM", title: "Investigation update — Summit Partners", client: "Michael Torres" },
  { time: "3:30 PM", title: "Contract review — Atlas Group", client: "James Whitfield" },
];
