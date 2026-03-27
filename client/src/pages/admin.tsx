import { useState, useRef, useEffect } from "react";
import mammoth from "mammoth/mammoth.browser";
import { useLogout, useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Plus, Settings, FileText, Package, Trash2, Edit2, UploadCloud, Users, UserPlus, Key, BrainCircuit, Save, BookOpen, CheckCircle2, X, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ApiUser = {
  id: string;
  username: string;
  email: string | null;
  role: string;
};

// Mock Data
const INITIAL_TEMPLATES = [
  { id: "t1", name: "RACI Matrix Template", type: "Excel (.xlsx)", size: "45 KB", lastUpdated: "2024-02-15" },
  { id: "t2", name: "RAID Log Master", type: "Excel (.xlsx)", size: "62 KB", lastUpdated: "2024-01-10" },
  { id: "t3", name: "Communications Plan", type: "Word (.docx)", size: "38 KB", lastUpdated: "2024-03-01" },
  { id: "t4", name: "Risk Register Standard", type: "Excel (.xlsx)", size: "50 KB", lastUpdated: "2023-11-20" },
  { id: "t5", name: "Project Kickoff Deck", type: "PowerPoint (.pptx)", size: "2.4 MB", lastUpdated: "2024-03-05" },
];

const INITIAL_PACKAGES = [
  { 
    id: "p1", 
    type: "Web", 
    description: "Standard pack for web build projects",
    documents: ["RACI Matrix Template", "RAID Log Master", "Communications Plan", "Project Kickoff Deck"] 
  },
  { 
    id: "p2", 
    type: "App", 
    description: "Mobile app development docs",
    documents: ["RACI Matrix Template", "Risk Register Standard", "Communications Plan", "Project Kickoff Deck"] 
  },
  { 
    id: "p3", 
    type: "Strategy", 
    description: "Lightweight pack for consulting",
    documents: ["RACI Matrix Template", "Communications Plan"] 
  },
  { 
    id: "p4", 
    type: "Design", 
    description: "Design-only project governance",
    documents: ["RACI Matrix Template", "RAID Log Master", "Project Kickoff Deck"] 
  },
  { 
    id: "p5", 
    type: "Content", 
    description: "Content and copywriting",
    documents: ["Communications Plan", "RAID Log Master"] 
  },
  { 
    id: "p6", 
    type: "XR/AR", 
    description: "Experimental & XR projects",
    documents: ["RACI Matrix Template", "RAID Log Master", "Risk Register Standard", "Communications Plan", "Project Kickoff Deck"] 
  }
];

type AiSettingsResponse = {
  provider: "openai" | "anthropic";
  orgId: string;
  systemPrompt: string;
  companyName: string;
  hasOpenAIKey: boolean;
  hasAnthropicKey: boolean;
  trainingDocFilename: string | null;
  trainingDocUploadedAt: string | null;
  trainingDocSize: number | null;
};

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border border-border bg-card shadow-[0_6px_18px_rgba(17,24,39,0.08)] rounded-[14px]">
      <CardHeader className="border-b border-border bg-muted px-4 py-[14px] dark:bg-muted/80 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">{description}</CardDescription>
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className="p-0">
        {children}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const logout = useLogout();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";


  // Add User form state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "manager" | "user">("user");

  // Package state
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [newPkgType, setNewPkgType] = useState("");
  const [newPkgDesc, setNewPkgDesc] = useState("");
  const [newPkgDocs, setNewPkgDocs] = useState<string[]>([]);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [editPkgType, setEditPkgType] = useState("");
  const [editPkgDesc, setEditPkgDesc] = useState("");
  const [editPkgDocs, setEditPkgDocs] = useState<string[]>([]);

  // Template state
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplType, setNewTplType] = useState("");
  const [newTplMode, setNewTplMode] = useState<"ai" | "passthrough">("ai");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTplName, setEditTplName] = useState("");
  const [editTplType, setEditTplType] = useState("");
  const [editTplMode, setEditTplMode] = useState<"ai" | "passthrough">("ai");

  // Edit User state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "manager" | "user">("user");
  const [editPassword, setEditPassword] = useState("");

  // AI Settings state
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [orgId, setOrgId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showDocContent, setShowDocContent] = useState(false);
  const [docContentPreview, setDocContentPreview] = useState<string | null>(null);
  const trainingDocInputRef = useRef<HTMLInputElement>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery<ApiUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; email?: string; role: "admin" | "manager" }) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowAddUser(false);
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("manager");
      toast.success("User created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast.success("User deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; username: string; email: string; role: "admin" | "manager"; password: string }) => {
      const body: Record<string, string> = { username: data.username, email: data.email, role: data.role };
      if (data.password) body.password = data.password;
      const res = await fetch(`/api/admin/users/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUserId(null);
      setEditPassword("");
      toast.success("User updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEditing = (u: ApiUser) => {
    setEditingUserId(u.id);
    setEditUsername(u.username);
    setEditEmail(u.email ?? "");
    setEditRole(u.role as "admin" | "manager" | "user");
    setEditPassword("");
    setShowAddUser(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId || !editUsername.trim()) return;
    updateUserMutation.mutate({ id: editingUserId, username: editUsername.trim(), email: editEmail.trim(), role: editRole, password: editPassword });
  };

  // Template API
  type ApiTemplate = { id: string; name: string; type: string; lastUpdated: string; originalFilename?: string; fileSize?: number; generateMode?: "ai" | "passthrough" };

  const { data: templatesData, isLoading: templatesLoading } = useQuery<ApiTemplate[]>({
    queryKey: ["/api/admin/templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; generateMode: "ai" | "passthrough" }) => {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      // PATCH immediately to set generateMode (POST only sets name/type)
      const created = await res.json();
      await fetch(`/api/admin/templates/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateMode: data.generateMode }),
      });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      setShowAddTemplate(false);
      setNewTplName("");
      setNewTplType("");
      setNewTplMode("ai");
      toast.success("Template created");
    },
    onError: () => toast.error("Failed to create template"),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; type: string; generateMode: "ai" | "passthrough" }) => {
      const res = await fetch(`/api/admin/templates/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, type: data.type, generateMode: data.generateMode }),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      setEditingTemplateId(null);
      toast.success("Template updated");
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const tplFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingForTemplateId, setUploadingForTemplateId] = useState<string | null>(null);

  const uploadTemplateFileMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await fetch(`/api/admin/templates/${id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64, originalFilename: file.name, fileSize: file.size }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Upload failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      setUploadingForTemplateId(null);
      toast.success("Template file uploaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const ALLOWED_EXTENSIONS = [".docx", ".xlsx", ".xls", ".txt", ".md"];
  const MAX_FILE_SIZE_MB = 20;

  const handleTplFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadingForTemplateId) return;

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Unsupported file type "${ext}". Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`);
      setUploadingForTemplateId(null);
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      toast.error(`File too large (${sizeMB.toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
      setUploadingForTemplateId(null);
      return;
    }

    uploadTemplateFileMutation.mutate({ id: uploadingForTemplateId, file });
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplName.trim() || !newTplType.trim()) return;
    createTemplateMutation.mutate({ name: newTplName.trim(), type: newTplType.trim(), generateMode: newTplMode });
  };

  const handleEditTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplateId || !editTplName.trim() || !editTplType.trim()) return;
    updateTemplateMutation.mutate({ id: editingTemplateId, name: editTplName.trim(), type: editTplType.trim(), generateMode: editTplMode });
  };

  // Package API
  type ApiPackage = { id: string; type: string; description: string; documents: string[] };

  const { data: packagesData, isLoading: packagesLoading } = useQuery<ApiPackage[]>({
    queryKey: ["/api/admin/packages"],
    queryFn: async () => {
      const res = await fetch("/api/admin/packages");
      if (!res.ok) throw new Error("Failed to load packages");
      return res.json();
    },
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data: { type: string; description: string; documents: string[] }) => {
      const res = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create package");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      setShowAddPackage(false);
      setNewPkgType(""); setNewPkgDesc(""); setNewPkgDocs([]);
      toast.success("Package created");
    },
    onError: () => toast.error("Failed to create package"),
  });

  const updatePackageMutation = useMutation({
    mutationFn: async (data: { id: string; type: string; description: string; documents: string[] }) => {
      const res = await fetch(`/api/admin/packages/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: data.type, description: data.description, documents: data.documents }),
      });
      if (!res.ok) throw new Error("Failed to update package");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      setEditingPackageId(null);
      toast.success("Package updated");
    },
    onError: () => toast.error("Failed to update package"),
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete package");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      toast.success("Package deleted");
    },
    onError: () => toast.error("Failed to delete package"),
  });

  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgType.trim() || !newPkgDesc.trim()) return;
    createPackageMutation.mutate({
      type: newPkgType.trim(),
      description: newPkgDesc.trim(),
      documents: newPkgDocs,
    });
  };

  const handleEditPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackageId) return;
    updatePackageMutation.mutate({
      id: editingPackageId,
      type: editPkgType.trim(),
      description: editPkgDesc.trim(),
      documents: editPkgDocs,
    });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    createUserMutation.mutate({
      username: newUsername.trim(),
      password: newPassword,
      ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
      role: newRole,
    });
  };

  const { data: aiSettings } = useQuery<AiSettingsResponse>({
    queryKey: ["/api/admin/ai-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai-settings");
      if (!res.ok) throw new Error("Failed to load AI settings");
      return res.json();
    },
    staleTime: 0,
  });

  // Sync fetched settings into local form state once loaded
  useEffect(() => {
    if (aiSettings) {
      setProvider(aiSettings.provider);
      setSystemPrompt(aiSettings.systemPrompt);
      setCompanyName(aiSettings.companyName);
      setOrgId(aiSettings.orgId);
    }
  }, [aiSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { provider, orgId, systemPrompt, companyName };
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-settings"] });
      toast.success("AI settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const uploadTrainingDocMutation = useMutation({
    mutationFn: async (file: File) => {
      let content: string;
      if (file.name.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        content = await file.text();
      }
      const res = await fetch("/api/admin/ai-settings/training-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename: file.name, size: file.size }),
      });
      if (!res.ok) throw new Error("Upload failed");
      return { content, result: await res.json() };
    },
    onSuccess: ({ content }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-settings"] });
      setDocContentPreview(content);
      toast.success("Training document uploaded");
    },
    onError: () => toast.error("Failed to upload training document"),
  });

  const deleteTrainingDocMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ai-settings/training-doc", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-settings"] });
      setDocContentPreview(null);
      setShowDocContent(false);
      toast.success("Training document removed");
    },
    onError: () => toast.error("Failed to remove training document"),
  });

  const handleTrainingDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadTrainingDocMutation.mutate(file);
    e.target.value = "";
  };

  const formatDocDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatDocSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };


  return (
    <div className="min-h-dvh bg-background text-foreground font-sans selection:bg-primary/30">
      <header className="mx-auto max-w-[1100px] px-[18px] pb-4 pt-7 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Settings className="h-6 w-6 text-primary" />
              <h1 className="text-[26px] font-extrabold tracking-[0.2px] text-foreground m-0 leading-none">
                Admin Dashboard
              </h1>
            </div>
            <p className="text-muted-foreground m-0 text-sm">
              Manage governance document templates, project type packages, and users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" className="font-bold">
                Back to Form
              </Button>
            </Link>
            <Button variant="ghost" className="font-bold" onClick={() => logout.mutate()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-[18px] pb-[42px] pt-8">
        <Tabs defaultValue="packages" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-[800px] mb-8 bg-muted/40 p-1 rounded-[10px] h-auto border border-border/50">
            <TabsTrigger value="packages" className="font-semibold py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all rounded-md">
              <Package className="h-4 w-4 mr-2" />
              Packages
            </TabsTrigger>
            <TabsTrigger value="templates" className="font-semibold py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all rounded-md">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="users" className="font-semibold py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all rounded-md">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="settings" className="font-semibold py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all rounded-md">
              <Settings className="h-4 w-4 mr-2" />
              AI Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-6">
            <SectionCard
              title="Project Type Mappings"
              description="Define which templates are automatically selected for each project type."
              action={
                !showAddPackage && (
                  <Button size="sm" className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setShowAddPackage(true)}>
                    <Plus className="h-4 w-4 mr-1" /> New Package
                  </Button>
                )
              }
            >
              {showAddPackage && (
                <form onSubmit={handleCreatePackage} className="p-5 border-b border-border space-y-4 bg-muted/20">
                  <h3 className="text-sm font-semibold">New Package</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-pkg-type">Project Type <span className="text-destructive">*</span></Label>
                      <Input id="new-pkg-type" value={newPkgType} onChange={(e) => setNewPkgType(e.target.value)} placeholder="e.g. Web" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-pkg-desc">Description <span className="text-destructive">*</span></Label>
                      <Input id="new-pkg-desc" value={newPkgDesc} onChange={(e) => setNewPkgDesc(e.target.value)} placeholder="Brief description" required />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Required Documents</Label>
                      {templatesData && templatesData.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {templatesData.map((t) => {
                            const selected = newPkgDocs.includes(t.name);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setNewPkgDocs(selected ? newPkgDocs.filter((d) => d !== t.name) : [...newPkgDocs, t.name])}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                  selected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-foreground border-border hover:border-primary hover:text-primary"
                                )}
                              >
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pt-1">No templates available — add templates first.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="font-bold" disabled={createPackageMutation.isPending}>
                      {createPackageMutation.isPending ? "Creating…" : "Create Package"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddPackage(false)}>Cancel</Button>
                  </div>
                </form>
              )}
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">Project Type</TableHead>
                    <TableHead className="font-bold text-foreground">Description</TableHead>
                    <TableHead className="font-bold text-foreground">Required Documents</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packagesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                  ) : packagesData?.map((pkg) => {
                    if (editingPackageId === pkg.id) {
                      return (
                        <TableRow key={pkg.id} className="bg-muted/20">
                          <TableCell colSpan={4} className="p-4">
                            <form onSubmit={handleEditPackage} className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label htmlFor="edit-pkg-type">Project Type <span className="text-destructive">*</span></Label>
                                  <Input id="edit-pkg-type" value={editPkgType} onChange={(e) => setEditPkgType(e.target.value)} required />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="edit-pkg-desc">Description <span className="text-destructive">*</span></Label>
                                  <Input id="edit-pkg-desc" value={editPkgDesc} onChange={(e) => setEditPkgDesc(e.target.value)} required />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                  <Label>Required Documents</Label>
                                  {templatesData && templatesData.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {templatesData.map((t) => {
                                        const selected = editPkgDocs.includes(t.name);
                                        return (
                                          <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setEditPkgDocs(selected ? editPkgDocs.filter((d) => d !== t.name) : [...editPkgDocs, t.name])}
                                            className={cn(
                                              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                              selected
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background text-foreground border-border hover:border-primary hover:text-primary"
                                            )}
                                          >
                                            {t.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground pt-1">No templates available.</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button type="submit" size="sm" className="font-bold" disabled={updatePackageMutation.isPending}>
                                  {updatePackageMutation.isPending ? "Saving…" : "Save Changes"}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setEditingPackageId(null)}>Cancel</Button>
                              </div>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-bold">{pkg.type}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{pkg.description}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {pkg.documents.map((doc, i) => (
                              <Badge key={i} variant="secondary" className="bg-muted/80 text-xs font-medium border-border">{doc}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => { setEditingPackageId(pkg.id); setEditPkgType(pkg.type); setEditPkgDesc(pkg.description); setEditPkgDocs([...pkg.documents]); setShowAddPackage(false); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deletePackageMutation.mutate(pkg.id)} disabled={deletePackageMutation.isPending}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <SectionCard
              title="Template Files"
              description="Manage the governance document templates used for each project type."
              action={
                !showAddTemplate && (
                  <Button size="sm" className="font-bold bg-primary text-primary-foreground" onClick={() => setShowAddTemplate(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Template
                  </Button>
                )
              }
            >
              {showAddTemplate && (
                <form onSubmit={handleCreateTemplate} className="p-5 border-b border-border space-y-4 bg-muted/20">
                  <h3 className="text-sm font-semibold">New Template</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-tpl-name">Template Name <span className="text-destructive">*</span></Label>
                      <Input id="new-tpl-name" value={newTplName} onChange={(e) => setNewTplName(e.target.value)} placeholder="e.g. RACI Matrix Template" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-tpl-type">File Type <span className="text-destructive">*</span></Label>
                      <Input id="new-tpl-type" value={newTplType} onChange={(e) => setNewTplType(e.target.value)} placeholder="e.g. Excel (.xlsx)" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Generation Mode</Label>
                    <RadioGroup value={newTplMode} onValueChange={(v) => setNewTplMode(v as "ai" | "passthrough")} className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="ai" id="new-mode-ai" />
                        <Label htmlFor="new-mode-ai" className="font-normal cursor-pointer">AI Generate — AI fills in this template with project data</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="passthrough" id="new-mode-pass" />
                        <Label htmlFor="new-mode-pass" className="font-normal cursor-pointer">Pass-through — Include template file as-is (no AI)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="font-bold" disabled={createTemplateMutation.isPending}>
                      {createTemplateMutation.isPending ? "Creating…" : "Create Template"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddTemplate(false)}>Cancel</Button>
                  </div>
                </form>
              )}
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">Template Name</TableHead>
                    <TableHead className="font-bold text-foreground">File Type</TableHead>
                    <TableHead className="font-bold text-foreground">Last Updated</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templatesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                  ) : templatesData?.map((tpl) => {
                    if (editingTemplateId === tpl.id) {
                      return (
                        <TableRow key={tpl.id} className="bg-muted/20">
                          <TableCell colSpan={4} className="p-4">
                            <form onSubmit={handleEditTemplate} className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label htmlFor="edit-tpl-name">Template Name <span className="text-destructive">*</span></Label>
                                  <Input id="edit-tpl-name" value={editTplName} onChange={(e) => setEditTplName(e.target.value)} required />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="edit-tpl-type">File Type <span className="text-destructive">*</span></Label>
                                  <Input id="edit-tpl-type" value={editTplType} onChange={(e) => setEditTplType(e.target.value)} required />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Generation Mode</Label>
                                <RadioGroup value={editTplMode} onValueChange={(v) => setEditTplMode(v as "ai" | "passthrough")} className="flex gap-4">
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem value="ai" id="edit-mode-ai" />
                                    <Label htmlFor="edit-mode-ai" className="font-normal cursor-pointer">AI Generate</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem value="passthrough" id="edit-mode-pass" />
                                    <Label htmlFor="edit-mode-pass" className="font-normal cursor-pointer">Pass-through</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                              <div className="flex gap-2">
                                <Button type="submit" size="sm" className="font-bold" disabled={updateTemplateMutation.isPending}>
                                  {updateTemplateMutation.isPending ? "Saving…" : "Save Changes"}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setEditingTemplateId(null)}>Cancel</Button>
                              </div>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={tpl.id}>
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{tpl.name}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", tpl.generateMode === "passthrough" ? "border-amber-400 text-amber-600" : "border-blue-400 text-blue-600")}>
                              {tpl.generateMode === "passthrough" ? "Pass-through" : "AI Generate"}
                            </Badge>
                          </div>
                          {tpl.originalFilename && (
                            <p className="text-xs text-emerald-600 mt-0.5 ml-6">
                              ✓ {tpl.originalFilename} {tpl.fileSize ? `(${Math.round(tpl.fileSize / 1024)} KB)` : ""}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tpl.type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tpl.lastUpdated}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-primary"
                              onClick={() => { setUploadingForTemplateId(tpl.id); tplFileInputRef.current?.click(); }}
                              disabled={uploadTemplateFileMutation.isPending && uploadingForTemplateId === tpl.id}
                            >
                              <UploadCloud className="h-3.5 w-3.5 mr-1" />
                              {tpl.originalFilename ? "Replace" : "Upload"}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => { setEditingTemplateId(tpl.id); setEditTplName(tpl.name); setEditTplType(tpl.type); setEditTplMode(tpl.generateMode ?? "ai"); setShowAddTemplate(false); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTemplateMutation.mutate(tpl.id)} disabled={deleteTemplateMutation.isPending}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <input
                ref={tplFileInputRef}
                type="file"
                accept=".docx,.xlsx,.xls,.txt,.md"
                className="hidden"
                onChange={handleTplFileChange}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <SectionCard
              title="User Management"
              description="Manage access and roles for the admin dashboard and governance platform."
              action={
                !showAddUser && (
                  <Button size="sm" className="font-bold bg-primary text-primary-foreground" onClick={() => setShowAddUser(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Add User
                  </Button>
                )
              }
            >
              {showAddUser && (
                <form onSubmit={handleCreateUser} className="p-5 border-b border-border space-y-4 bg-muted/20">
                  <h3 className="text-sm font-semibold">New User</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-username">Username <span className="text-destructive">*</span></Label>
                      <Input
                        id="new-username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="username"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="user@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">Password <span className="text-destructive">*</span></Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Temporary password"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <RadioGroup
                        value={newRole}
                        onValueChange={(v) => setNewRole(v as "admin" | "manager" | "user")}
                        className="flex gap-4 pt-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="user" id="role-user" />
                          <Label htmlFor="role-user" className="font-normal cursor-pointer">User</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="manager" id="role-manager" />
                          <Label htmlFor="role-manager" className="font-normal cursor-pointer">Manager</Label>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="admin" id="role-admin" />
                            <Label htmlFor="role-admin" className="font-normal cursor-pointer">Admin</Label>
                          </div>
                        )}
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="font-bold" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? "Creating…" : "Create User"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddUser(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">Username</TableHead>
                    <TableHead className="font-bold text-foreground">Email</TableHead>
                    <TableHead className="font-bold text-foreground">Role</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell>
                    </TableRow>
                  ) : usersData?.map((u) => {
                    // Managers can only see edit/delete on manager users
                    const canEdit = isAdmin || u.role !== "admin";
                    const isSelf = u.username === currentUser?.username;
                    if (editingUserId === u.id) {
                      return (
                        <TableRow key={u.id} className="bg-muted/20">
                          <TableCell colSpan={4} className="p-4">
                            <form onSubmit={handleEditSubmit} className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label htmlFor="edit-username">Username <span className="text-destructive">*</span></Label>
                                  <Input id="edit-username" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="edit-email">Email</Label>
                                  <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="user@example.com" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="edit-password">New Password</Label>
                                  <Input id="edit-password" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave blank to keep current" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Role</Label>
                                  <RadioGroup
                                    value={editRole}
                                    onValueChange={(v) => setEditRole(v as "admin" | "manager" | "user")}
                                    className="flex gap-4 pt-1"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="user" id="edit-role-user" />
                                      <Label htmlFor="edit-role-user" className="font-normal cursor-pointer">User</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="manager" id="edit-role-manager" />
                                      <Label htmlFor="edit-role-manager" className="font-normal cursor-pointer">Manager</Label>
                                    </div>
                                    {isAdmin && (
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="admin" id="edit-role-admin" />
                                        <Label htmlFor="edit-role-admin" className="font-normal cursor-pointer">Admin</Label>
                                      </div>
                                    )}
                                  </RadioGroup>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button type="submit" size="sm" className="font-bold" disabled={updateUserMutation.isPending}>
                                  {updateUserMutation.isPending ? "Saving…" : "Save Changes"}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setEditingUserId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-semibold">{u.username}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("font-medium bg-background capitalize", u.role === "admin" && "border-primary text-primary")}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startEditing(u)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && !isSelf && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteUserMutation.mutate(u.id)}
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SectionCard
              title="AI Generation Configuration"
              description={isAdmin ? "Configure the AI provider used to automatically draft governance documents." : "View-only — contact an admin to change AI settings."}
              action={
                isAdmin ? (
                  <Button
                    size="sm"
                    className="font-bold bg-primary text-primary-foreground"
                    onClick={() => saveSettingsMutation.mutate()}
                    disabled={saveSettingsMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saveSettingsMutation.isPending ? "Saving…" : "Save Settings"}
                  </Button>
                ) : undefined
              }
            >
              <div className="p-5 space-y-8">
                {/* Provider */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    AI Provider Selection
                  </h3>
                  <RadioGroup
                    value={provider}
                    onValueChange={(v) => isAdmin && setProvider(v as "openai" | "anthropic")}
                    className="flex flex-col gap-3 sm:flex-row sm:gap-6"
                  >
                    <div className="flex items-center space-x-2 border border-border p-3 rounded-md bg-background w-full sm:w-auto">
                      <RadioGroupItem value="openai" id="r-openai" />
                      <Label htmlFor="r-openai" className="font-medium cursor-pointer">OpenAI (GPT-4o)</Label>
                    </div>
                    <div className="flex items-center space-x-2 border border-border p-3 rounded-md bg-background w-full sm:w-auto">
                      <RadioGroupItem value="anthropic" id="r-anthropic" />
                      <Label htmlFor="r-anthropic" className="font-medium cursor-pointer">Anthropic (Claude 3.5 Sonnet)</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* API Credentials */}
                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Key className="h-4 w-4 text-primary" />
                    API Credentials
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>OpenAI API Key</Label>
                      <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${aiSettings?.hasOpenAIKey ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${aiSettings?.hasOpenAIKey ? "bg-green-500" : "bg-amber-400"}`} />
                        {aiSettings?.hasOpenAIKey ? "Configured via AWS Parameter Store" : "Not set — add to AWS Parameter Store at /pm-governance/openai-api-key"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Anthropic API Key</Label>
                      <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${aiSettings?.hasAnthropicKey ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${aiSettings?.hasAnthropicKey ? "bg-green-500" : "bg-amber-400"}`} />
                        {aiSettings?.hasAnthropicKey ? "Configured via AWS Parameter Store" : "Not set — add to AWS Parameter Store at /pm-governance/anthropic-api-key"}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">API keys are stored in AWS Systems Manager Parameter Store and fetched securely at startup. They are never saved to disk or visible in the UI.</p>
                  <div className="space-y-2">
                    <Label htmlFor="org-id">OpenAI Organization ID <span className="font-normal text-muted-foreground">(Optional)</span></Label>
                    <Input
                      id="org-id"
                      placeholder="org-..."
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>

                {/* Generation Preferences */}
                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-primary" />
                    Generation Preferences
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="system-prompt">Default System Prompt</Label>
                      <Textarea
                        id="system-prompt"
                        className="h-24 resize-none"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        disabled={!isAdmin}
                      />
                      <p className="text-xs text-muted-foreground">
                        This instruction is prefixed to all document generation requests.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input
                        id="company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>
                </div>

                {/* Training Document */}
                <div className="space-y-4 border-t border-border pt-6">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Template Training Document
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Upload a document defining how your governance templates should be completed — examples, field definitions, and standards. Supports .txt, .md, and .docx. This is injected into every generation prompt.
                    </p>
                  </div>

                  {aiSettings?.trainingDocFilename ? (
                    // Document is uploaded — show status card
                    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {aiSettings.trainingDocFilename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDocSize(aiSettings.trainingDocSize)} · Uploaded {formatDocDate(aiSettings.trainingDocUploadedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => setShowDocContent((p) => !p)}
                          >
                            {showDocContent ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                            {showDocContent ? "Hide" : "Preview"}
                          </Button>
                          {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => trainingDocInputRef.current?.click()}
                            disabled={uploadTrainingDocMutation.isPending}
                          >
                            <UploadCloud className="h-3.5 w-3.5 mr-1" />
                            Replace
                          </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteTrainingDocMutation.mutate()}
                            disabled={deleteTrainingDocMutation.isPending || !isAdmin}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {showDocContent && docContentPreview && (
                        <Textarea
                          readOnly
                          value={docContentPreview}
                          className="h-56 text-xs font-mono resize-none bg-background border-border"
                        />
                      )}
                    </div>
                  ) : (
                    // No document — show upload zone
                    <div
                      className={cn("rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center transition-colors", isAdmin ? "cursor-pointer hover:bg-muted/40" : "opacity-60 cursor-not-allowed")}
                      onClick={() => isAdmin && trainingDocInputRef.current?.click()}
                    >
                      <UploadCloud className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        {uploadTrainingDocMutation.isPending ? "Uploading…" : "Upload training document"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        .txt, .md, .docx supported · Max recommended 50 KB
                      </p>
                    </div>
                  )}

                  <input
                    ref={trainingDocInputRef}
                    type="file"
                    accept=".txt,.md,.docx"
                    className="hidden"
                    onChange={handleTrainingDocFileChange}
                  />
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
