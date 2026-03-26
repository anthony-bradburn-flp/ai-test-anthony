import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import GovernanceStarterPage from "@/pages/governance-starter";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
import { useAuth } from "@/hooks/use-auth";

function ProtectedAdminRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  if (user.role === "user") return <Redirect to="/?reason=admin-access" />;
  return <AdminPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={GovernanceStarterPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/admin" component={ProtectedAdminRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
