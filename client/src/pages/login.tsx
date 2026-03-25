import { useState } from "react";
import { Link, Redirect } from "wouter";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useLogin } from "@/hooks/use-auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { user, isLoading } = useAuth();
  const login = useLogin();

  if (isLoading) return null;
  if (user) return <Redirect to="/admin" />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans flex flex-col">
      <header className="mx-auto w-full max-w-[1100px] px-[18px] pb-2 pt-7">
        <div className="flex items-center justify-between">
          <div>
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
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Admin Login</CardTitle>
            <CardDescription>Sign in to access the admin panel</CardDescription>
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
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
