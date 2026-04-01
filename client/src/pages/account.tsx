import { useState } from "react";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { SiteLogo } from "@/components/page-header";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to update profile"); }
      return res.json();
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (e: Error) => toast.error(e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("New passwords do not match");
      const res = await fetch("/api/auth/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to change password"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <header className="mx-auto max-w-[700px] px-[18px] pb-2 pt-7">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <SiteLogo />
            <div className="flex items-center gap-2 mb-1.5">
              <User className="h-6 w-6 text-primary" />
              <h1 className="text-[26px] font-extrabold tracking-[0.2px] text-foreground m-0 leading-none">My Account</h1>
            </div>
            <p className="text-muted-foreground text-sm m-0">Update your profile and password.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/"><Button variant="outline" className="font-bold">Back to Form</Button></Link>
            {isAdmin && <Link href="/admin"><Button variant="outline" className="font-bold">Admin</Button></Link>}
            <Button variant="ghost" className="font-bold" onClick={() => logout.mutate()}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[700px] px-[18px] pb-12 pt-6 space-y-6">

        {/* Must change password banner */}
        {user?.mustChangePassword && (
          <div className="flex items-start gap-3 rounded-[10px] border border-amber-400 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Password change required</p>
              <p className="text-xs mt-0.5">Your account requires a new password before you can continue. Please update it below.</p>
            </div>
          </div>
        )}

        {/* Profile */}
        <Card className="border border-border shadow-sm rounded-[14px]">
          <CardHeader className="border-b border-border bg-muted px-4 py-[14px]">
            <CardTitle className="text-base font-bold">Profile</CardTitle>
            <CardDescription className="text-xs mt-1">Update your display name and email address.</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form
              onSubmit={(e) => { e.preventDefault(); updateProfileMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <Button type="submit" className="font-bold" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? "Saving…" : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="border border-border shadow-sm rounded-[14px]">
          <CardHeader className="border-b border-border bg-muted px-4 py-[14px]">
            <CardTitle className="text-base font-bold">Change Password</CardTitle>
            <CardDescription className="text-xs mt-1">Must be at least 8 characters with one capital letter and one number or special character.</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form
              onSubmit={(e) => { e.preventDefault(); changePasswordMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current Password</Label>
                <PasswordInput id="current-password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <PasswordInput id="new-password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="font-bold" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Changing…" : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Future integrations placeholder */}
        <Card className="border border-border shadow-sm rounded-[14px] opacity-60">
          <CardHeader className="border-b border-border bg-muted px-4 py-[14px]">
            <CardTitle className="text-base font-bold">Microsoft 365</CardTitle>
            <CardDescription className="text-xs mt-1">Coming soon — link your M365 account for SharePoint document storage and single sign-on.</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <Button variant="outline" className="font-bold" disabled>Connect Microsoft Account</Button>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
