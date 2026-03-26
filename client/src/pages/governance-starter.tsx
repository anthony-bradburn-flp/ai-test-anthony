import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";

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
  const [uploads, setUploads] = useState<File[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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
    };

    setIsGenerating(true);
    setGeneratedDocs(null);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation request failed");
      }
      const result = await res.json();
      setGeneratedDocs(result.documents ?? []);
      toast.success("Documents generated", {
        description: result.trainingDocAttached
          ? "Training document standards applied."
          : "No training document — configure one in Admin > AI Settings.",
      });
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
          <Link href="/admin">
            <Button variant="outline" className="font-bold">
              Admin Login
            </Button>
          </Link>
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
                    <span>Document Upload <span className="text-xs font-normal opacity-70">(optional)</span></span>
                  </Label>
                  <Input
                    id="docsUpload"
                    type="file"
                    multiple
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []);
                      setUploads((prev) => [...prev, ...newFiles]);
                      e.target.value = ""; // Reset input
                    }}
                    className="cursor-pointer file:text-foreground file:font-semibold"
                  />
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    You can select and upload multiple documents (e.g. PPT, PDF, DOC, XLS).
                  </div>
                  
                  {uploads.length > 0 && (
                    <ul className="mt-2.5 pl-4 text-xs text-muted-foreground list-disc">
                      {uploads.map((f, i) => (
                        <li key={i} className="mb-1 flex items-center gap-2">
                          <span>{f.name} ({Math.round(f.size / 1024)} KB)</span>
                          <button 
                            type="button" 
                            onClick={() => setUploads(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-destructive hover:underline"
                          >
                            Remove
                          </button>
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

        {isGenerating && (
          <div className="mt-8 rounded-[14px] border border-border bg-muted/30 p-8 text-center text-muted-foreground text-sm">
            Generating documents — this may take up to a minute…
          </div>
        )}

        {generatedDocs && generatedDocs.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Generated Documents</h2>
              <Button onClick={handleDownload} disabled={isDownloading} className="font-bold">
                {isDownloading ? "Preparing…" : "Download All (.zip)"}
              </Button>
            </div>
            {generatedDocs.map((doc, i) => (
              <div key={i} className="rounded-[14px] border border-border bg-card overflow-hidden">
                <div className="border-b border-border bg-muted px-4 py-3 flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{doc.name}</span>
                  <span className="text-xs text-muted-foreground">{doc.filename}</span>
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
