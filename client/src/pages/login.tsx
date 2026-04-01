import { useState } from "react";
import { SiteLogo } from "@/components/page-header";
import { useMutation } from "@tanstack/react-query";
import { Link, Redirect, useSearch } from "wouter";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useLogin } from "@/hooks/use-auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<"login" | "forgot">("login");
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const { user, isLoading } = useAuth();
  const login = useLogin();
  const search = useSearch();
  const accessDenied = new URLSearchParams(search).get("reason") === "admin-access";

  const forgotPassword = useMutation({
    mutationFn: async (u: string) => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      const data = await res.json();
      return data.message as string;
    },
    onSuccess: (msg) => setForgotMessage(msg),
  });

  if (isLoading) return null;
  if (user) return <Redirect to={user.role === "user" ? "/" : "/admin"} />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    forgotPassword.mutate(forgotUsername.trim());
  };

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans flex flex-col">
      <header className="mx-auto w-full max-w-[1100px] px-[18px] pb-2 pt-7">
        <div className="flex items-center justify-between">
          <div>
            <SiteLogo />
            <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[0.2px] text-foreground">
              Project Intake Form
            </h1>
            <p className="text-muted-foreground m-0">
              Capture project information, stakeholders, and documentation needs.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" className="font-bold">
              Back to Form
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        {view === "login" ? (
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-xl">Admin Login</CardTitle>
              <CardDescription>
                {accessDenied
                  ? "Only admin and manager users can access the admin section."
                  : "Sign in to access the admin panel"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {login.isError && (
                  <p className="text-sm text-destructive">Invalid username or password.</p>
                )}
                <Button type="submit" className="w-full" disabled={login.isPending}>
                  {login.isPending ? "Signing in…" : "Sign In"}
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary text-center underline underline-offset-2 bg-transparent border-none cursor-pointer"
                  onClick={() => setView("forgot")}
                >
                  Forgot password?
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-xl">Reset Password</CardTitle>
              <CardDescription>Enter your username. If your account has a registered email, a temporary password will be sent. Otherwise, contact your admin to reset your password.</CardDescription>
            </CardHeader>
            <CardContent>
              {forgotMessage ? (
                <div className="space-y-4">
                  <p className="text-sm text-foreground text-center">{forgotMessage}</p>
                  <Button variant="outline" className="w-full" onClick={() => { setView("login"); setForgotMessage(""); setForgotUsername(""); }}>
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="forgot-username">Username</Label>
                    <Input
                      id="forgot-username"
                      type="text"
                      autoComplete="username"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      required
                    />
                  </div>
                  {forgotPassword.isError && (
                    <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
                  )}
                  <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                    {forgotPassword.isPending ? "Sending…" : "Send Temporary Password"}
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-primary text-center underline underline-offset-2 bg-transparent border-none cursor-pointer"
                    onClick={() => setView("login")}
                  >
                    Back to Sign In
                  </button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
