import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RoleCombobox } from "@/components/role-combobox";
import type { FullProject } from "@/components/project-form-view";

const stakeholderSchema = z.object({
  name: z.string().min(1, "Required"),
  role: z.string().min(1, "Required"),
  allocation: z.number().int().min(10).max(100).optional(),
});

const milestoneSchema = z.object({
  stage: z.string().min(1, "Required"),
  percentage: z.coerce.number().min(0).max(100),
  value: z.string().optional(),
  date: z.string().optional(),
});

const editSchema = z.object({
  projectName: z.string().min(1, "Required"),
  sheetRef: z.string().min(1, "Required").regex(/^[A-Za-z]{2,3}\d{3}$/, "Format: 2–3 letters + 3 digits (e.g. SM025)"),
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  value: z.string().min(1, "Required"),
  projectSize: z.string().min(1, "Required"),
  sponsorName: z.string().min(1, "Required"),
  sponsorRole: z.string().min(1, "Required"),
  flipsideStakeholders: z.array(stakeholderSchema).min(1, "At least one required"),
  clientStakeholders: z.array(stakeholderSchema).min(1, "At least one required"),
  billingMilestones: z.array(milestoneSchema).min(1, "At least one required"),
}).refine((d) => !d.startDate || !d.endDate || new Date(d.startDate) <= new Date(d.endDate), {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

type EditValues = z.infer<typeof editSchema>;

export function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: FullProject | null;
  onClose: () => void;
  onSaved?: (updated: FullProject) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      projectName: "", sheetRef: "", startDate: "", endDate: "",
      value: "", projectSize: "", sponsorName: "", sponsorRole: "",
      flipsideStakeholders: [{ name: "", role: "" }],
      clientStakeholders: [{ name: "", role: "" }],
      billingMilestones: [{ stage: "", percentage: 0, value: "", date: "" }],
    },
  });

  const flipside = useFieldArray({ control: form.control, name: "flipsideStakeholders" });
  const clientSH = useFieldArray({ control: form.control, name: "clientStakeholders" });
  const milestones = useFieldArray({ control: form.control, name: "billingMilestones" });

  // Populate form when project changes
  useEffect(() => {
    if (!project) return;
    form.reset({
      projectName: project.projectName ?? "",
      sheetRef: project.sheetRef ?? "",
      startDate: project.startDate ?? "",
      endDate: project.endDate ?? "",
      value: project.value ?? "",
      projectSize: project.projectSize ?? "",
      sponsorName: project.sponsorName ?? "",
      sponsorRole: project.sponsorRole ?? "",
      flipsideStakeholders: project.flipsideStakeholders?.length
        ? project.flipsideStakeholders.map((s) => ({ name: s.name, role: s.role, allocation: s.allocation }))
        : [{ name: "", role: "" }],
      clientStakeholders: project.clientStakeholders?.length
        ? project.clientStakeholders.map((s) => ({ name: s.name, role: s.role, allocation: s.allocation }))
        : [{ name: "", role: "" }],
      billingMilestones: project.billingMilestones?.length
        ? project.billingMilestones.map((m) => ({
            stage: m.stage,
            percentage: m.percentage,
            value: m.value ?? "",
            date: m.date ?? "",
          }))
        : [{ stage: "", percentage: 0, value: "", date: "" }],
    });
  }, [project]);

  const onSubmit = async (values: EditValues) => {
    if (!project) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: values.projectName,
          sheetRef: values.sheetRef,
          startDate: values.startDate,
          endDate: values.endDate,
          value: values.value,
          projectSize: values.projectSize,
          sponsorName: values.sponsorName,
          sponsorRole: values.sponsorRole,
          flipsideStakeholders: values.flipsideStakeholders,
          clientStakeholders: values.clientStakeholders,
          billingMilestones: values.billingMilestones.map((m) => ({
            stage: m.stage,
            percentage: Number(m.percentage),
            value: m.value || null,
            date: m.date || null,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Save failed");
      }
      const updated = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/projects/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast.success("Project details saved");
      onSaved?.(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    }
  };

  return (
    <Dialog open={!!project} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project Details</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Changes here update the project record only — existing documents are not affected.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-2">

            {/* Core fields */}
            <section>
              <h3 className="text-sm font-bold border-b pb-1 mb-3">Project Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="projectName" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Project Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sheetRef" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sheet Ref</FormLabel>
                    <FormControl><Input placeholder="e.g. SM025" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="projectSize" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Size</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {["Small", "Medium", "Large", "Enterprise"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Value</FormLabel>
                    <FormControl><Input placeholder="e.g. £50,000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div /> {/* spacer */}
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </section>

            {/* Sponsor */}
            <section>
              <h3 className="text-sm font-bold border-b pb-1 mb-3">Project Sponsor</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sponsorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sponsorRole" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </section>

            {/* Flipside stakeholders */}
            <section>
              <div className="flex items-center justify-between border-b pb-1 mb-3">
                <h3 className="text-sm font-bold">Flipside Team</h3>
                <Button type="button" size="sm" variant="ghost" onClick={() => flipside.append({ name: "", role: "", allocation: 100 })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {flipside.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_90px_auto] gap-2 items-start">
                    <FormField control={form.control} name={`flipsideStakeholders.${i}.name`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <FormLabel className="text-xs text-muted-foreground">Name</FormLabel>}
                        <FormControl><Input placeholder="Name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`flipsideStakeholders.${i}.role`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <FormLabel className="text-xs text-muted-foreground">Role</FormLabel>}
                        <FormControl>
                          <RoleCombobox value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`flipsideStakeholders.${i}.allocation`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <FormLabel className="text-xs text-muted-foreground">Alloc.</FormLabel>}
                        <Select onValueChange={(v) => field.onChange(parseInt(v, 10))} value={field.value?.toString() ?? ""}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="100%" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[10, 20, 25, 50, 75, 100].map((p) => (
                              <SelectItem key={p} value={p.toString()}>{p}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <div className={i === 0 ? "pt-6" : ""}>
                      <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => flipside.fields.length > 1 && flipside.remove(i)} disabled={flipside.fields.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Client stakeholders */}
            <section>
              <div className="flex items-center justify-between border-b pb-1 mb-3">
                <h3 className="text-sm font-bold">Client Team</h3>
                <Button type="button" size="sm" variant="ghost" onClick={() => clientSH.append({ name: "", role: "", allocation: 100 })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {clientSH.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_90px_auto] gap-2 items-start">
                    <FormField control={form.control} name={`clientStakeholders.${i}.name`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <FormLabel className="text-xs text-muted-foreground">Name</FormLabel>}
                        <FormControl><Input placeholder="Name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`clientStakeholders.${i}.role`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <FormLabel className="text-xs text-muted-foreground">Role</FormLabel>}
                        <FormControl>
                          <RoleCombobox value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`clientStakeholders.${i}.allocation`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <FormLabel className="text-xs text-muted-foreground">Alloc.</FormLabel>}
                        <Select onValueChange={(v) => field.onChange(parseInt(v, 10))} value={field.value?.toString() ?? ""}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="100%" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[10, 20, 25, 50, 75, 100].map((p) => (
                              <SelectItem key={p} value={p.toString()}>{p}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <div className={i === 0 ? "pt-6" : ""}>
                      <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => clientSH.fields.length > 1 && clientSH.remove(i)} disabled={clientSH.fields.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Billing milestones */}
            <section>
              <div className="flex items-center justify-between border-b pb-1 mb-3">
                <h3 className="text-sm font-bold">Billing Milestones</h3>
                <Button type="button" size="sm" variant="ghost" onClick={() => milestones.append({ stage: "", percentage: 0, value: "", date: "" })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {milestones.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-start">
                    <FormField control={form.control} name={`billingMilestones.${i}.stage`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <Label className="text-xs text-muted-foreground">Stage</Label>}
                        <FormControl><Input placeholder="Stage" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`billingMilestones.${i}.percentage`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <Label className="text-xs text-muted-foreground">%</Label>}
                        <FormControl><Input type="number" min={0} max={100} placeholder="%" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`billingMilestones.${i}.value`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <Label className="text-xs text-muted-foreground">Value</Label>}
                        <FormControl><Input placeholder="£" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`billingMilestones.${i}.date`} render={({ field }) => (
                      <FormItem>
                        {i === 0 && <Label className="text-xs text-muted-foreground">Date</Label>}
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className={i === 0 ? "pt-6" : ""}>
                      <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => milestones.fields.length > 1 && milestones.remove(i)} disabled={milestones.fields.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
