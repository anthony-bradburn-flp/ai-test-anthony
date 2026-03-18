import { useState, useRef } from "react";
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

const INITIAL_USERS = [
  { id: "u1", name: "Alice Morgan", email: "alice@flipsidegroup.com", role: "Admin", status: "Active" },
  { id: "u2", name: "Bob Chen", email: "bob@flipsidegroup.com", role: "Editor", status: "Active" },
  { id: "u3", name: "Charlie Davis", email: "charlie@flipsidegroup.com", role: "Viewer", status: "Inactive" },
];

type AiSettingsResponse = {
  provider: "openai" | "anthropic";
  orgId: string;
  systemPrompt: string;
  companyName: string;
  hasApiKey: boolean;
  trainingDocFilename: string | null;
  trainingDocUploadedAt: string | null;
  trainingDocSize: number | null;
};

export default function AdminPage() {
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [packages, setPackages] = useState(INITIAL_PACKAGES);
  const [users, setUsers] = useState(INITIAL_USERS);

  // AI Settings state
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [orgId, setOrgId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showDocContent, setShowDocContent] = useState(false);
  const [docContentPreview, setDocContentPreview] = useState<string | null>(null);
  const trainingDocInputRef = useRef<HTMLInputElement>(null);

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
  useState(() => {
    if (aiSettings) {
      setProvider(aiSettings.provider);
      setSystemPrompt(aiSettings.systemPrompt);
      setCompanyName(aiSettings.companyName);
      setOrgId(aiSettings.orgId);
    }
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { provider, orgId, systemPrompt, companyName };
      if (apiKey) body.apiKey = apiKey;
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
      const content = await file.text();
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

  const SectionCard = ({
    title,
    description,
    children,
    action,
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
    action?: React.ReactNode;
  }) => (
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
          <Link href="/">
            <Button variant="outline" className="font-bold">
              Back to Form
            </Button>
          </Link>
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
                <Button size="sm" className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-1" /> New Package
                </Button>
              }
            >
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
                  {packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-bold">{pkg.type}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{pkg.description}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.documents.map((doc, i) => (
                            <Badge key={i} variant="secondary" className="bg-muted/80 text-xs font-medium border-border">
                              {doc}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <SectionCard
              title="Template Files"
              description="Upload and manage the master source files used for governance generation."
              action={
                <Button size="sm" className="font-bold bg-primary text-primary-foreground">
                  <UploadCloud className="h-4 w-4 mr-1" /> Upload Template
                </Button>
              }
            >
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">Template Name</TableHead>
                    <TableHead className="font-bold text-foreground">File Type</TableHead>
                    <TableHead className="font-bold text-foreground">Size</TableHead>
                    <TableHead className="font-bold text-foreground">Last Updated</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {tpl.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.size}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.lastUpdated}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <SectionCard
              title="User Management"
              description="Manage access and roles for the admin dashboard and governance platform."
              action={
                <Button size="sm" className="font-bold bg-primary text-primary-foreground">
                  <UserPlus className="h-4 w-4 mr-1" /> Add User
                </Button>
              }
            >
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">Name</TableHead>
                    <TableHead className="font-bold text-foreground">Email</TableHead>
                    <TableHead className="font-bold text-foreground">Role</TableHead>
                    <TableHead className="font-bold text-foreground">Status</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-semibold">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium bg-background">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs font-medium border-border",
                            user.status === "Active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SectionCard
              title="AI Generation Configuration"
              description="Configure the AI provider used to automatically draft governance documents."
              action={
                <Button
                  size="sm"
                  className="font-bold bg-primary text-primary-foreground"
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveSettingsMutation.isPending ? "Saving…" : "Save Settings"}
                </Button>
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
                    value={aiSettings?.provider ?? provider}
                    onValueChange={(v) => setProvider(v as "openai" | "anthropic")}
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
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder={aiSettings?.hasApiKey ? "••••••••••••  (stored)" : "sk-..."}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Leave blank to keep existing key.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-id">Organization ID (Optional)</Label>
                      <Input
                        id="org-id"
                        placeholder="org-..."
                        value={orgId}
                        onChange={(e) => setOrgId(e.target.value)}
                      />
                    </div>
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
                        value={systemPrompt || aiSettings?.systemPrompt || ""}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        This instruction is prefixed to all document generation requests.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input
                        id="company-name"
                        value={companyName || aiSettings?.companyName || ""}
                        onChange={(e) => setCompanyName(e.target.value)}
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
                      Upload a plain-text document defining how your governance templates should be completed — examples, field definitions, and standards. This is injected into every generation prompt.
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteTrainingDocMutation.mutate()}
                            disabled={deleteTrainingDocMutation.isPending}
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
                      className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => trainingDocInputRef.current?.click()}
                    >
                      <UploadCloud className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        {uploadTrainingDocMutation.isPending ? "Uploading…" : "Upload training document"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Plain text (.txt, .md) files supported · Max recommended 50 KB
                      </p>
                    </div>
                  )}

                  <input
                    ref={trainingDocInputRef}
                    type="file"
                    accept=".txt,.md"
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
