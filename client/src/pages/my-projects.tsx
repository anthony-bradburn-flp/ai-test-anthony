import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { SiteLogo } from "@/components/page-header";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, FileText, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PaginationBar, PAGE_SIZE, paginateItems } from "@/components/ui/pagination-bar";

type Project = {
  id: string; clientId: string; clientName: string; sheetRef: string; projectName: string;
  projectType: string; createdAt: string; lastGeneratedAt?: string; createdBy: string;
  smartsheetId?: string | null; smartsheetUrl?: string | null; timelineGeneratedAt?: string | null;
};
type StoredDocument = {
  id: string; projectId: string; name: string; filename: string; format: string;
  fileSize: number; generatedAt: string; version: number; versionLabel: string; isLatest: boolean;
};
type Draft = {
  id: string; userId: string; clientName: string; projectName: string;
  formData: Record<string, unknown>; createdAt: string; updatedAt: string;
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
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [deletingDraft, setDeletingDraft] = useState<string | null>(null);

  // Pagination state
  const [draftsPage, setDraftsPage] = useState(1);
  const [myPage, setMyPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);

  // Reset to page 1 when filters change
  useEffect(() => { setMyPage(1); setTeamPage(1); }, [search, clientFilter]);

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

  const { data: drafts = [], refetch: refetchDrafts } = useQuery<Draft[]>({
    queryKey: ["/api/drafts/mine"],
    queryFn: async () => {
      const res = await fetch("/api/drafts/mine");
      return res.ok ? res.json() : [];
    },
  });

  const deleteDraft = async (draft: Draft) => {
    if (!confirm(`Delete draft "${draft.projectName}"?`)) return;
    setDeletingDraft(draft.id);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      refetchDrafts();
      toast.success(`Draft deleted`);
    } catch {
      toast.error("Failed to delete draft");
    } finally {
      setDeletingDraft(null);
    }
  };

  const clients = Array.from(new Map(projects.map((p) => [p.clientId, p.clientName])).entries());

  const applyFilters = (list: Project[]) => list.filter((p) => {
    if (clientFilter !== "__all__" && p.clientId !== clientFilter) return false;
    if (search && !p.projectName.toLowerCase().includes(search.toLowerCase()) && !p.sheetRef.toLowerCase().includes(search.toLowerCase()) && !p.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // For admin/manager: split into own vs others. For regular users: just own.
  const myProjects = applyFilters(projects.filter((p) => p.createdBy === user?.id));
  const otherProjects = isAdmin ? applyFilters(projects.filter((p) => p.createdBy !== user?.id)) : [];
  const allFiltered = isAdmin ? [...myProjects, ...otherProjects] : myProjects;

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

  const deleteDoc = async (doc: StoredDocument) => {
    if (!confirm(`Delete "${doc.name}" (${doc.versionLabel})?`)) return;
    setDeletingDoc(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", expandedProject, "documents"] });
      toast.success(`Deleted ${doc.name} (${doc.versionLabel})`);
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeletingDoc(null);
    }
  };

  const generateTimeline = async (project: Project, mode: "update" | "new" = project.smartsheetId ? "update" : "new") => {
    setTimelinePending(project.id);
    setTimelineError((prev) => { const next = { ...prev }; delete next[project.id]; return next; });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240_000);
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
      const msg = err?.name === "AbortError" ? "Timed out — the sheet may still have been created in Smartsheet. Refresh and check before retrying." : (err?.message ?? "Failed");
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

  const renderProjectRows = (list: Project[]) => list.map((project) => {
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
                      <Button size="sm" className="font-bold">
                        {docs.length === 0 ? "Generate Documents" : "Generate Again"}
                      </Button>
                    </Link>
                  </div>
                </div>
                {docs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents stored yet. Use <strong>Generate Documents</strong> to create them.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-sm w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 pr-4 font-semibold sticky left-0 bg-card z-10">Document</th>
                          {versions.map((v) => (
                            <th key={v} className="text-center py-2 px-2 font-semibold">v{v}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(docsByName).map(([name, docVersions]) => (
                          <tr key={name} className="border-b border-border/50 last:border-0">
                            <td className="py-2 pr-4 font-medium sticky left-0 bg-card z-10">{name}</td>
                            {versions.map((v) => {
                              const doc = docVersions.find((d) => d.version === v);
                              return (
                                <td key={v} className="text-center py-2 px-2">
                                  {doc ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        size="sm" variant={doc.isLatest ? "default" : "outline"}
                                        className="h-7 text-xs font-semibold"
                                        onClick={() => downloadDoc(doc)}
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        {doc.isLatest ? "Latest" : "Download"}
                                      </Button>
                                      {isAdmin && (
                                        <Button
                                          size="sm" variant="ghost"
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                          disabled={deletingDoc === doc.id}
                                          onClick={() => deleteDoc(doc)}
                                          title={`Delete ${doc.name} (${doc.versionLabel})`}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
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
  });

  const tableHeader = (
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
  );

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
        <div className="flex gap-3 mb-6 flex-wrap">
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

        {/* Drafts section — always shown if any drafts exist */}
        {drafts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-bold mb-2 flex items-center gap-2">
              Drafts
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2 py-0.5">{drafts.length}</span>
            </h2>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
              <table className="text-sm w-full">
                <thead className="bg-amber-50 dark:bg-amber-950/30">
                  <tr className="border-b border-amber-200 dark:border-amber-800">
                    <th className="text-left py-2.5 px-4 font-semibold text-amber-800 dark:text-amber-300">Project Name</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-amber-800 dark:text-amber-300">Client</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-amber-800 dark:text-amber-300">Last Saved</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {paginateItems(drafts, draftsPage).map((draft) => (
                    <tr key={draft.id} className="border-b border-amber-100 dark:border-amber-900/40 last:border-0 hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                      <td className="py-2.5 px-4 font-medium">
                        <span className="inline-flex items-center gap-2">
                          {draft.projectName}
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[11px] font-semibold px-1.5 py-0.5">Draft</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{draft.clientName}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{new Date(draft.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/?draftId=${draft.id}`}>
                            <Button size="sm" className="font-bold h-7 text-xs">Continue</Button>
                          </Link>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            disabled={deletingDraft === draft.id}
                            onClick={() => deleteDraft(draft)}
                            title="Delete draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar page={draftsPage} total={drafts.length} onPage={setDraftsPage} />
            </div>
          </div>
        )}

        {allFiltered.length === 0 && drafts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm mt-1">Generate documents from the form to see them here.</p>
          </div>
        ) : allFiltered.length === 0 ? null : isAdmin ? (
          <div className="space-y-8">
            {/* My projects section */}
            <div>
              <h2 className="text-base font-bold mb-2">My Projects</h2>
              {myProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No projects created by you yet.</p>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    {tableHeader}
                    <TableBody>{renderProjectRows(paginateItems(myProjects, myPage))}</TableBody>
                  </Table>
                  <PaginationBar page={myPage} total={myProjects.length} onPage={setMyPage} />
                </div>
              )}
            </div>

            {/* Other team members' projects */}
            {otherProjects.length > 0 && (
              <div>
                <h2 className="text-base font-bold mb-2 text-muted-foreground">Team Projects</h2>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    {tableHeader}
                    <TableBody>{renderProjectRows(paginateItems(otherProjects, teamPage))}</TableBody>
                  </Table>
                  <PaginationBar page={teamPage} total={otherProjects.length} onPage={setTeamPage} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              {tableHeader}
              <TableBody>{renderProjectRows(paginateItems(myProjects, myPage))}</TableBody>
            </Table>
            <PaginationBar page={myPage} total={myProjects.length} onPage={setMyPage} />
          </div>
        )}
      </main>
    </div>
  );
}
