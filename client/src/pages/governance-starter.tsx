import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useAuth, useLogout } from "@/hooks/use-auth";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "sonner";

const stakeholderSchema = z.object({
  name: z.string().min(1, "Please enter a name"),
  role: z.string().min(1, "Please enter a role"),
});

const billingMilestoneSchema = z.object({
  stage: z.string().min(1, "Please enter a stage"),
  percentage: z.coerce.number().min(0, "Min 0").max(100, "Max 100"),
  date: z.string().min(1, "Please select an estimated date"),
});

const formSchema = z.object({
  client: z.string().min(1, "Please enter a Client."),
  sheetRef: z.string().min(1, "Please enter a Sheet Ref.")
    .regex(/^[A-Za-z]{2,3}\d{3}$/, "Format: Initials + 3 digits (e.g. SM025)"),
  projectName: z.string().min(1, "Please enter a Project Name."),
  projectType: z.string().min(1, "Please select a Project Type."),
  projectSize: z.string().min(1, "Please select a Project Size."),
  value: z.string().min(1, "Please enter the Value."),
  startDate: z.string().min(1, "Please select an SOW Start Date."),
  endDate: z.string().min(1, "Please select an SOW End Date."),
  billingMilestones: z.array(billingMilestoneSchema).min(1, "At least one billing milestone is required"),
  summary: z.string().min(1, "Please provide a Project Summary."),
  flipsideStakeholders: z.array(stakeholderSchema).min(2, "At least Account Lead and Project Manager are required"),
  clientStakeholders: z.array(stakeholderSchema).min(1, "Please add at least one stakeholder"),
  sponsorIndex: z.number().min(0, "Please select exactly one Sponsor."),
  docsRequired: z.array(z.string()).min(1, "Please select at least one required document."),
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate) {
    if (new Date(data.startDate) > new Date(data.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after the start date.",
        path: ["endDate"],
      });
    }
  }

  // Validate billing milestones total to 100%
  if (data.billingMilestones && data.billingMilestones.length > 0) {
    const total = data.billingMilestones.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
    if (Math.abs(total - 100) > 0.01) { // Allowing tiny floating point diffs just in case
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total percentage must equal 100% (currently ${total}%)`,
        path: ["billingMilestones"],
      });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

type GeneratedDocument = { name: string; filename: string; format: string; content: string; preview: string };

function SectionCard({ id, title, badge, children }: { id: string; title: string; badge: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_6px_18px_rgba(17,24,39,0.08)]">
      <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-[14px] dark:bg-muted/80">
        <h2 id={id} className="text-base font-bold text-foreground m-0">{title}</h2>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">{badge}</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function GovernanceStarterPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const logout = useLogout();
  const [uploads, setUploads] = useState<Array<{ name: string; content: string; size: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [generatingStage, setGeneratingStage] = useState("");
  const [generatingStart, setGeneratingStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, isLoading, navigate]);

  // Elapsed timer while generating
  useEffect(() => {
    if (!isGenerating) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - generatingStart) / 1000)), 500);
    return () => clearInterval(id);
  }, [isGenerating, generatingStart]);

  // Auto-advance stage after 2 s
  useEffect(() => {
    if (!isGenerating) return;
    const id = setTimeout(() => setGeneratingStage("AI is generating your documents…"), 2000);
    return () => clearTimeout(id);
  }, [isGenerating]);

  const ACCEPTED_TYPES = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.txt,.md";
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addFiles = async (files: File[]) => {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} exceeds 10 MB limit and was skipped.`);
        continue;
      }
      const content = await readFileAsBase64(file);
      setUploads((prev) => {
        if (prev.some((u) => u.name === file.name)) return prev; // dedupe
        return [...prev, { name: file.name, content, size: file.size }];
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client: "",
      sheetRef: "",
      projectName: "",
      projectType: "",
      projectSize: "",
      value: "",
      startDate: "",
      endDate: "",
      billingMilestones: [
        { stage: "Deposit / Kickoff", percentage: 50, date: "" },
        { stage: "Completion", percentage: 50, date: "" }
      ],
      summary: "",
      flipsideStakeholders: [
        { name: "", role: "Account Lead" },
        { name: "", role: "Project Manager" },
      ],
      clientStakeholders: [{ name: "", role: "" }],
      sponsorIndex: 0,
      docsRequired: [],
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const flipsideArray = useFieldArray({
    control: form.control,
    name: "flipsideStakeholders",
  });

  const clientArray = useFieldArray({
    control: form.control,
    name: "clientStakeholders",
  });

  const billingArray = useFieldArray({
    control: form.control,
    name: "billingMilestones",
  });

  const onInvalid = () => {
    toast.error("Some required fields are incomplete.", {
      description: "Please scroll through the form — fields highlighted in red need attention before you can generate documents.",
    });
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      client: values.client,
      sheetRef: values.sheetRef,
      projectName: values.projectName,
      projectType: values.projectType,
      projectSize: values.projectSize,
      value: values.value,
      startDate: values.startDate,
      endDate: values.endDate,
      billingMilestones: values.billingMilestones,
      summary: values.summary,
      flipsideStakeholders: values.flipsideStakeholders,
      clientStakeholders: values.clientStakeholders,
      sponsorIndex: values.sponsorIndex,
      docsRequired: values.docsRequired,
      supportingDocs: uploads.map((u) => ({ name: u.name, content: u.content })),
    };

    setIsGenerating(true);
    setGeneratedDocs(null);
    setGenerateError(null);
    setGeneratingStage("Preparing your request…");
    setGeneratingStart(Date.now());
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { navigate("/login"); return; }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation request failed");
      }

      // Read the NDJSON stream — each line is a JSON event
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalExpected = 0;
      let docsReceived = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!; // keep any incomplete trailing line

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "start") {
            totalExpected = event.count;
            setGeneratingStage(`Building ${totalExpected} document${totalExpected !== 1 ? "s" : ""}…`);
            setGeneratedDocs([]); // open the results section immediately
            if (event.truncatedDocs?.length) {
              for (const name of event.truncatedDocs) {
                toast.warning(`${name} exceeds 15,000 character limit — only the first 15,000 characters were passed to the AI.`);
              }
            }
          } else if (event.type === "document") {
            docsReceived++;
            setGeneratingStage(`Built document ${docsReceived} of ${totalExpected} — ready to download`);
            setGeneratedDocs((prev) => [...(prev ?? []), event.document]);
          } else if (event.type === "done") {
            toast.success(`${docsReceived} document${docsReceived !== 1 ? "s" : ""} generated`, {
              description: event.trainingDocAttached
                ? "Training document standards applied."
                : "No training document — configure one in Admin > AI Settings.",
            });
          } else if (event.type === "error") {
            throw new Error(event.error ?? "Generation failed");
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Generation failed — check server logs.";
      setGenerateError(msg);
      toast.error("Failed to generate", { description: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedDocs?.length) return;
    setIsDownloading(true);
    try {
      const res = await fetch("/api/generate/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: generatedDocs }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "governance-documents.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadSingleDoc = (doc: GeneratedDocument) => {
    const byteChars = atob(doc.content);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    form.reset();
    setUploads([]);
    toast("Reset", { description: "Cleared form data." });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans selection:bg-primary/30">
      <header className="mx-auto max-w-[1100px] px-[18px] pb-2 pt-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[0.2px] text-foreground">
              Project Intake Form
            </h1>
            <p className="text-muted-foreground m-0">
              Capture project information, stakeholders, and documentation needs.
            </p>
          </div>
          <div className="flex gap-2">
            {user && (user.role === "admin" || user.role === "manager") ? (
              <Link href="/admin">
                <Button variant="outline" className="font-bold">Admin</Button>
              </Link>
            ) : (
              <Button variant="outline" className="font-bold" onClick={() => toast.error("Only admin and manager users can access the admin section.")}>
                Admin
              </Button>
            )}
            <Button variant="ghost" className="font-bold" onClick={() => logout.mutate()} disabled={logout.isPending}>
              {logout.isPending ? "Signing out…" : "Sign Out"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-[18px] pb-[42px] pt-4">
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit, onInvalid)} noValidate>
            
            {/* Section 1 */}
            <SectionCard id="s1" title="Section 1 – Project Information" badge="All fields mandatory">
              <div className="grid grid-cols-12 gap-3">
                <FormField
                  control={form.control}
                  name="client"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Client <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Pharma" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sheetRef"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Sheet Ref <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SM025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Project Name <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Global Website Refresh" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectType"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Project Type <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["Web", "App", "Strategy", "Design", "Content", "XR/AR"].map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectSize"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Project Size <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["Small", "Medium", "Large", "Enterprise"].map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Value (GBP) <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" placeholder="e.g. 25000" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">Currency field (stored as a number).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>SOW Start Date <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-3">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>SOW End Date <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Billing Milestones */}
                <div className="col-span-12 mt-3 mb-2 rounded-xl border border-border bg-muted p-4 dark:bg-muted">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Billing Milestones <span className="text-destructive font-extrabold ml-0.5">*</span></h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Define the stages and percentages for invoicing. Total must equal 100%.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {billingArray.fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_100px_1fr_auto] md:items-end">
                        <FormField
                          control={form.control}
                          name={`billingMilestones.${index}.stage`}
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-xs font-semibold text-muted-foreground">
                                Stage
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Deposit" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`billingMilestones.${index}.percentage`}
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-xs font-semibold text-muted-foreground">
                                Percentage (%)
                              </FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="100" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`billingMilestones.${index}.date`}
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-xs font-semibold text-muted-foreground">
                                Estimated Date
                              </FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-1.5">
                          <Label className="hidden text-xs font-semibold text-muted-foreground md:block opacity-0">
                            Remove
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (billingArray.fields.length > 1) {
                                billingArray.remove(index);
                              } else {
                                toast.error("You must have at least one billing milestone");
                              }
                            }}
                            className={cn(
                              "h-10 w-full md:w-auto font-bold",
                              billingArray.fields.length === 1 
                                ? "opacity-50 cursor-not-allowed" 
                                : "text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                            )}
                          >
                            <span className="md:hidden">Remove Milestone</span>
                            <span className="hidden md:inline">Remove</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {form.formState.errors.billingMilestones?.root && (
                    <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 p-2.5 text-xs font-semibold text-destructive">
                      {form.formState.errors.billingMilestones.root.message}
                    </div>
                  )}

                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-bold text-xs"
                      onClick={() => billingArray.append({ stage: "", percentage: 0, date: "" })}
                    >
                      + Add milestone
                    </Button>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem className="col-span-12">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Project Summary <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide a short summary of the project..." 
                          className="min-h-[110px] resize-y"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCard>

            {/* Section 2 */}
            <SectionCard id="s2" title="Section 2 – Flipside Stakeholders" badge="Mandatory">
              <p className="mb-4 mt-0 text-xs text-muted-foreground">
                Add any known internal stakeholders. Account Lead and Project Manager are required as a minimum.
              </p>

              <div className="flex flex-col gap-2.5">
                {flipsideArray.fields.map((field, index) => {
                  // Protect the first two rows (Account Lead and Project Manager) from being completely removed/renamed out of their roles
                  const isRequiredRole = index === 0 || index === 1;

                  return (
                    <div key={field.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        
                        <FormField
                          control={form.control}
                          name={`flipsideStakeholders.${index}.name`}
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-xs font-semibold text-muted-foreground">
                                Stakeholder Name <span className="text-destructive font-extrabold ml-1">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="Stakeholder name" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`flipsideStakeholders.${index}.role`}
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-xs font-semibold text-muted-foreground">
                                Role <span className="text-destructive font-extrabold ml-1">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Role" 
                                  {...field} 
                                  disabled={isRequiredRole}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-1.5">
                          <Label className="hidden text-xs font-semibold text-muted-foreground md:block opacity-0">
                            Remove
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isRequiredRole}
                            onClick={() => {
                              if (!isRequiredRole) {
                                flipsideArray.remove(index);
                              }
                            }}
                            className={cn(
                              "h-10 w-full md:w-auto font-bold",
                              isRequiredRole 
                                ? "opacity-50 cursor-not-allowed" 
                                : "text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                            )}
                          >
                            <span className="md:hidden">Remove Stakeholder</span>
                            <span className="hidden md:inline">Remove</span>
                          </Button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

              {form.formState.errors.flipsideStakeholders?.root && (
                <div className="mt-2 rounded-xl border border-destructive/25 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {form.formState.errors.flipsideStakeholders.root.message}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="font-bold"
                  onClick={() => flipsideArray.append({ name: "", role: "" })}
                >
                  + Add internal stakeholder
                </Button>
              </div>
            </SectionCard>

            {/* Section 3 */}
            <SectionCard id="s3" title="Section 3 – Client Stakeholders" badge="Mandatory">
              <p className="mb-4 mt-0 text-xs text-muted-foreground">
                Add one or more stakeholders. Name and Role display side-by-side on wider screens. Select exactly one Sponsor.
              </p>

              <div className="flex flex-col gap-2.5">
                {clientArray.fields.map((field, index) => (
                  <div key={field.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[5fr_5fr_2fr_auto] md:items-end">
                      
                      <FormField
                        control={form.control}
                        name={`clientStakeholders.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-muted-foreground">
                              Stakeholder Name <span className="text-destructive font-extrabold ml-1">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Stakeholder name" {...field} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`clientStakeholders.${index}.role`}
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-muted-foreground">
                              Role <span className="text-destructive font-extrabold ml-1">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Role" {...field} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sponsorIndex"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-muted-foreground">
                              Sponsor?
                            </FormLabel>
                            <FormControl>
                              <div className="flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-3">
                                <RadioGroup
                                  onValueChange={(val) => field.onChange(parseInt(val, 10))}
                                  value={field.value.toString()}
                                  className="flex items-center"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value={index.toString()} id={`sponsor-${index}`} />
                                    <Label htmlFor={`sponsor-${index}`} className="text-xs font-normal">Sponsor</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="space-y-1.5">
                        <Label className="hidden text-xs font-semibold text-muted-foreground md:block opacity-0">
                          Remove
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (clientArray.fields.length > 1) {
                              clientArray.remove(index);
                              if (form.getValues().sponsorIndex === index) {
                                form.setValue("sponsorIndex", 0);
                              } else if (form.getValues().sponsorIndex > index) {
                                form.setValue("sponsorIndex", form.getValues().sponsorIndex - 1);
                              }
                            } else {
                              toast.error("You must have at least one stakeholder");
                            }
                          }}
                          className={cn(
                            "h-10 w-full md:w-auto font-bold text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50",
                            clientArray.fields.length === 1 && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span className="md:hidden">Remove Stakeholder</span>
                          <span className="hidden md:inline">Remove</span>
                        </Button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>

              {form.formState.errors.clientStakeholders?.root && (
                <div className="mt-2 rounded-xl border border-destructive/25 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {form.formState.errors.clientStakeholders.root.message}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="font-bold"
                  onClick={() => clientArray.append({ name: "", role: "" })}
                >
                  + Add stakeholder
                </Button>
                <span className="text-xs text-muted-foreground">
                  Tip: use the Sponsor option to identify the primary client sponsor.
                </span>
              </div>
            </SectionCard>

            {/* Section 4 */}
            <SectionCard id="s4" title="Section 4 – Project Documentation" badge="Mixed">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12">
                  <Label className="flex justify-between font-semibold mb-1.5 text-sm text-muted-foreground">
                    <span>Supporting Documents <span className="text-xs font-normal opacity-70">(optional — used to enrich generated documents)</span></span>
                  </Label>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />

                  {/* Drag-and-drop zone */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer select-none",
                      isDragging
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <svg className="h-8 w-8 opacity-60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <div>
                      <span className="font-semibold text-sm">Drop files here or click to browse</span>
                      <p className="text-xs mt-0.5">PDF, DOCX, XLSX, PPT, CSV, TXT — up to 10 MB each</p>
                      <p className="text-xs mt-0.5 opacity-75">Note: only the first 15,000 characters of each document are passed to the AI.</p>
                    </div>
                  </div>

                  {/* File list */}
                  {uploads.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {uploads.map((f, i) => (
                        <li key={i} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs">
                          <span className="truncate max-w-[70%] font-medium">{f.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-muted-foreground">{Math.round(f.size / 1024)} KB</span>
                            <button
                              type="button"
                              onClick={() => setUploads((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-destructive hover:text-destructive/80"
                              aria-label={`Remove ${f.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="docsRequired"
                  render={() => (
                    <FormItem className="col-span-12">
                      <FormLabel className="flex justify-between font-semibold">
                        <span>Documents Required <span className="text-destructive font-extrabold ml-1">*</span></span>
                      </FormLabel>
                      
                      <div className="mt-1.5 grid gap-2.5 md:grid-cols-2">
                        {["RACI", "RAID Log", "Risk Register", "Communications Plan"].map((item) => (
                          <FormField
                            key={item}
                            control={form.control}
                            name="docsRequired"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item}
                                  className="flex flex-row items-center space-x-2.5 space-y-0 rounded-xl border border-border bg-background p-2.5 px-3"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, item])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== item
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer w-full h-full pt-0.5">
                                    {item}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      
                      <FormDescription className="text-xs mt-1.5">
                        Select one or more documents to generate.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-3.5 text-xs text-muted-foreground">
                Use <strong>Generate documents</strong> to submit the form and trigger document generation downstream.
              </div>
            </SectionCard>

            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-muted p-4 rounded-[14px] dark:bg-muted/80 mt-2">
              <div className="text-xs text-muted-foreground">
                Required fields validated on submit.
              </div>
              <div className="flex flex-wrap gap-2.5 justify-end">
                <Button type="button" variant="outline" onClick={handleReset} className="font-bold">
                  Reset
                </Button>
                <Button type="submit" className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isGenerating}>
                  {isGenerating ? "Generating…" : "Generate documents"}
                </Button>
              </div>
            </div>

          </form>
        </Form>

        {generateError && (
          <div className="mt-6 rounded-[14px] border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <strong>Generation failed:</strong> {generateError}
          </div>
        )}

        {isGenerating && (() => {
          const progress = elapsed < 2
            ? (elapsed / 2) * 15
            : Math.min(90, 15 + ((elapsed - 2) / 58) * 75);
          const hint = elapsed > 60
            ? "Almost there…"
            : elapsed > 30
            ? "Taking a little longer than usual…"
            : "Typically takes 20–40 seconds";
          return (
            <div className="mt-8 rounded-[14px] border border-border bg-card p-8 space-y-5">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 shrink-0 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="font-semibold text-foreground text-sm">{generatingStage}</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Stage steps */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {["Preparing", "AI generating", "Building files"].map((label, i) => {
                  const active =
                    (i === 0 && elapsed < 2) ||
                    (i === 1 && elapsed >= 2 && generatingStage !== "Building document files…") ||
                    (i === 2 && generatingStage === "Building document files…");
                  const done =
                    (i === 0 && elapsed >= 2) ||
                    (i === 1 && generatingStage === "Building document files…");
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      {i > 0 && <div className="h-px w-6 bg-border" />}
                      <span className={cn(
                        "px-2 py-0.5 rounded-full border text-[11px] font-medium",
                        done ? "border-primary/40 bg-primary/10 text-primary" :
                        active ? "border-primary bg-primary text-primary-foreground" :
                        "border-border bg-muted text-muted-foreground"
                      )}>
                        {done ? "✓ " : ""}{label}
                      </span>
                    </div>
                  );
                })}
                <div className="ml-auto tabular-nums">{elapsed}s elapsed · {hint}</div>
              </div>
            </div>
          );
        })()}

        {generatedDocs !== null && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                Generated Documents
                {isGenerating && generatedDocs.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({generatedDocs.length} ready)</span>
                )}
              </h2>
              {!isGenerating && generatedDocs.length > 1 && (
                <Button onClick={handleDownload} disabled={isDownloading} className="font-bold">
                  {isDownloading ? "Preparing…" : "Download All (.zip)"}
                </Button>
              )}
            </div>
            {generatedDocs.length === 0 && (
              <div className="rounded-[14px] border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Documents will appear here as they are ready…
              </div>
            )}
            {generatedDocs.map((doc, i) => (
              <div key={i} className="rounded-[14px] border border-border bg-card overflow-hidden">
                <div className="border-b border-border bg-muted px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-foreground">{doc.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{doc.filename}</span>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 font-semibold" onClick={() => downloadSingleDoc(doc)}>
                    Download
                  </Button>
                </div>
                <pre className="p-4 text-xs text-foreground whitespace-pre-wrap font-mono max-h-80 overflow-y-auto bg-background">
                  {doc.preview}
                </pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
