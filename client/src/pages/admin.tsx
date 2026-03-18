import { useState } from "react";
import { Link } from "wouter";
import { Plus, Settings, FileText, Package, Trash2, Edit2, UploadCloud, Users, UserPlus, Key, BrainCircuit, Save } from "lucide-react";

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

export default function AdminPage() {
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [packages, setPackages] = useState(INITIAL_PACKAGES);
  const [users, setUsers] = useState(INITIAL_USERS);

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
                <Button size="sm" className="font-bold bg-primary text-primary-foreground">
                  <Save className="h-4 w-4 mr-1" /> Save Settings
                </Button>
              }
            >
              <div className="p-5 space-y-8">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <BrainCircuit className="h-4 w-4 text-primary" />
                      AI Provider Selection
                    </h3>
                    <RadioGroup defaultValue="openai" className="flex flex-col gap-3 sm:flex-row sm:gap-6">
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
                </div>

                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Key className="h-4 w-4 text-primary" />
                    API Credentials
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <Input id="api-key" type="password" placeholder="sk-..." defaultValue="sk-dummy-key-for-mockup" />
                      <p className="text-xs text-muted-foreground">Keys are encrypted before storage.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-id">Organization ID (Optional)</Label>
                      <Input id="org-id" placeholder="org-..." />
                    </div>
                  </div>
                </div>

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
                        defaultValue="You are an expert project manager at Flipside Group. Draft comprehensive project governance documents based on the provided intake form details. Maintain a professional, consulting-grade tone."
                      />
                      <p className="text-xs text-muted-foreground">
                        This instruction is prefixed to all document generation requests.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name context</Label>
                      <Input id="company-name" defaultValue="Flipside Group" />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
