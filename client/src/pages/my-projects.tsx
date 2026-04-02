import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { SiteLogo } from "@/components/page-header";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Project = {
  id: string; clientId: string; clientName: string; sheetRef: string; projectName: string;
  projectType: string; createdAt: string; lastGeneratedAt?: string;
  smartsheetId?: string | null; smartsheetUrl?: string | null; timelineGeneratedAt?: string | null;
};
type StoredDocument = {
  id: string; projectId: string; name: string; filename: string; format: string;
  fileSize: number; generatedAt: string; version: number; versionLabel: string; isLatest: boolean;
};

export default function MyProjectsPage() {
  const { user } = useAuth();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("__all__");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [timelinePending, setTimelinePending] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<Record<string, string>>({});

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const { data: smartsheetEnabled } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/smartsheet/enabled"],
    queryFn: async () => {
      const res = await fetch("/api/smartsheet/enabled");
      return res.ok ? res.json() : { enabled: false };
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects/mine"],
    queryFn: async () => {
      const res = await fetch("/api/projects/mine");
      return res.ok ? res.json() : [];
    },
  });

  const { data: docs = [] } = useQuery<StoredDocument[]>({
    queryKey: ["/api/projects", expandedProject, "documents"],
    queryFn: async () => {
      if (!expandedProject) return [];
      const res = await fetch(`/api/projects/${expandedProject}/documents`);
      return res.ok ? res.json() : [];
    },
    enabled: !!expandedProject,
  });

  const clients = Array.from(new Map(projects.map((p) => [p.clientId, p.clientName])).entries());

  const filtered = projects.filter((p) => {
    if (clientFilter !== "__all__" && p.clientId !== clientFilter) return false;
    if (search && !p.projectName.toLowerCase().includes(search.toLowerCase()) && !p.sheetRef.toLowerCase().includes(search.toLowerCase()) && !p.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const downloadDoc = async (doc: StoredDocument) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download document");
    }
  };

  const downloadAll = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/download-all`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "documents.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download documents");
    }
  };

  const generateTimeline = async (project: Project, mode: "update" | "new" = project.smartsheetId ? "update" : "new") => {
    setTimelinePending(project.id);
    setTimelineError((prev) => { const next = { ...prev }; delete next[project.id]; return next; });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch(`/api/projects/${project.id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/projects/mine"] });
      toast.success(mode === "update" ? "Timeline updated" : "Timeline created", {
        description: (
          <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Open in Smartsheet →
          </a>
        ) as any,
      });
    } catch (err: any) {
      const msg = err?.name === "AbortError" ? "Timed out — generation took too long" : (err?.message ?? "Failed");
      setTimelineError((prev) => ({ ...prev, [project.id]: msg }));
    } finally {
      clearTimeout(timeout);
      setTimelinePending(null);
    }
  };

  // Group docs by name, columns = versions
  const docsByName = docs.reduce<Record<string, StoredDocument[]>>((acc, d) => {
    if (!acc[d.name]) acc[d.name] = [];
    acc[d.name].push(d);
    return acc;
  }, {});
  const versions = Array.from(new Set(docs.map((d) => d.version))).sort((a, b) => a - b);

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <header className="mx-auto max-w-[1100px] px-[18px] pb-2 pt-7">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <SiteLogo />
            <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[0.2px] text-foreground">My Projects</h1>
            <p className="text-muted-foreground m-0">View and download documents from your generated projects.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/"><Button variant="outline" className="font-bold">Back to Form</Button></Link>
            {isAdmin && <Link href="/admin"><Button variant="outline" className="font-bold">Admin</Button></Link>}
            <Link href="/account"><Button variant="outline" className="font-bold">My Account</Button></Link>
            <Button variant="outline" className="font-bold" onClick={() => logout.mutate()}>Log out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-[18px] pb-12 pt-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm mt-1">Generate documents from the form to see them here.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="font-bold">Sheet Ref</TableHead>
                  <TableHead className="font-bold">Project Name</TableHead>
                  <TableHead className="font-bold">Client</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Last Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((project) => {
                  const isExpanded = expandedProject === project.id;
                  return (
                    <>
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{project.sheetRef}</TableCell>
                        <TableCell className="font-medium">{project.projectName}</TableCell>
                        <TableCell className="text-muted-foreground">{project.clientName}</TableCell>
                        <TableCell className="text-muted-foreground">{project.projectType}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {project.lastGeneratedAt ? new Date(project.lastGeneratedAt).toLocaleDateString("en-GB") : "—"}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${project.id}-docs`}>
                          <TableCell colSpan={6} className="p-0 bg-muted/30">
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold">Documents</p>
                                <div className="flex gap-2 flex-wrap justify-end">
                                  {docs.length > 0 && (
                                    <Button size="sm" variant="outline" className="font-bold" onClick={() => downloadAll(project.id)}>
                                      <Download className="h-3.5 w-3.5 mr-1" /> Download All
                                    </Button>
                                  )}
                                  {smartsheetEnabled?.enabled && (
                                    project.smartsheetId ? (
                                      <Button size="sm" variant="outline" className="font-bold" disabled={timelinePending === project.id} onClick={() => generateTimeline(project, "update")}>
                                        <FileText className="h-3.5 w-3.5 mr-1" />{timelinePending === project.id ? "Updating…" : "Update Timeline"}
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="outline" className="font-bold" disabled={timelinePending === project.id} onClick={() => generateTimeline(project, "new")}>
                                        <FileText className="h-3.5 w-3.5 mr-1" />{timelinePending === project.id ? "Creating…" : "Create Timeline"}
                                      </Button>
                                    )
                                  )}
                                  {project.smartsheetUrl && (
                                    <a href={project.smartsheetUrl} target="_blank" rel="noopener noreferrer">
                                      <Button size="sm" variant="ghost" className="font-bold">
                                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Sheet
                                      </Button>
                                    </a>
                                  )}
                                  {timelineError[project.id] && (
                                    <p className="text-xs text-destructive mt-1 w-full">
                                      Timeline failed: {timelineError[project.id]}
                                    </p>
                                  )}
                                  <Link href={`/?projectId=${project.id}`}>
                                    <Button size="sm" className="font-bold">Generate Again</Button>
                                  </Link>
                                </div>
                              </div>
                              {docs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No documents stored yet.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="text-sm w-full">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <th className="text-left py-2 pr-4 font-semibold">Document</th>
                                        {versions.map((v) => (
                                          <th key={v} className="text-center py-2 px-2 font-semibold">v{v}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(docsByName).map(([name, docVersions]) => (
                                        <tr key={name} className="border-b border-border/50 last:border-0">
                                          <td className="py-2 pr-4 font-medium">{name}</td>
                                          {versions.map((v) => {
                                            const doc = docVersions.find((d) => d.version === v);
                                            return (
                                              <td key={v} className="text-center py-2 px-2">
                                                {doc ? (
                                                  <Button
                                                    size="sm" variant={doc.isLatest ? "default" : "outline"}
                                                    className="h-7 text-xs font-semibold"
                                                    onClick={() => downloadDoc(doc)}
                                                  >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    {doc.isLatest ? "Latest" : "Download"}
                                                  </Button>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
