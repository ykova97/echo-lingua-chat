import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GuestJoin from "@/pages/GuestJoin";
import GuestChat from "@/pages/GuestChat";
import GuestSessionTest from "@/pages/GuestSessionTest";
import GuestChatDirect from "@/pages/GuestChatDirect";

// Lazy load non-critical routes
const ChatList = lazy(() => import("./pages/ChatList"));
const Chat = lazy(() => import("./pages/Chat"));
const ComposeNewMessage = lazy(() => import("./pages/ComposeNewMessage"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const InternalRunbook = lazy(() => import("./pages/InternalRunbook"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/chats" element={<ChatList />} />
            <Route path="/chat/:chatId" element={<Chat />} />
            <Route path="/compose" element={<ComposeNewMessage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/internal/runbook" element={<InternalRunbook />} />
            <Route path="/guest/:token" element={<GuestChatDirect />} />
            <Route path="/guest/:token" element={<GuestJoin />} />
            <Route path="/join/:slug" element={<GuestJoin />} />
            <Route path="/guest-chat/:chatId" element={<GuestChat />} />
            <Route path="/guest-session-test" element={<GuestSessionTest />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
