import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type FullProject = {
  id: string;
  sheetRef?: string | null;
  clientName?: string | null;
  projectName: string;
  projectType?: string | null;
  projectSize?: string | null;
  value?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  summary?: string | null;
  sponsorName?: string | null;
  sponsorRole?: string | null;
  billingMilestones?: Array<{ stage: string; percentage: number; value?: string | null; date?: string | null }> | null;
  flipsideStakeholders?: Array<{ name: string; role: string }> | null;
  clientStakeholders?: Array<{ name: string; role: string }> | null;
  createdAt?: string;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function ProjectFormView({ project, onClose }: { project: FullProject | null; onClose: () => void }) {
  if (!project) return null;

  const milestones = project.billingMilestones ?? [];
  const flipsideTeam = project.flipsideStakeholders ?? [];
  const clientTeam = project.clientStakeholders ?? [];

  return (
    <Dialog open={!!project} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{project.projectName}</DialogTitle>
          {project.sheetRef && (
            <p className="text-xs font-mono text-muted-foreground">{project.sheetRef}</p>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Project Details */}
          <section>
            <h3 className="text-sm font-bold border-b pb-1 mb-3">Project Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Client" value={project.clientName} />
              <Field label="Project Type" value={project.projectType} />
              <Field label="Project Size" value={project.projectSize} />
              <Field label="Project Value" value={project.value} />
              <Field label="Start Date" value={project.startDate} />
              <Field label="End Date" value={project.endDate} />
            </div>
            {project.summary && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Executive Summary</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.summary}</p>
              </div>
            )}
          </section>

          {/* Sponsor */}
          {(project.sponsorName || project.sponsorRole) && (
            <section>
              <h3 className="text-sm font-bold border-b pb-1 mb-3">Project Sponsor</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name" value={project.sponsorName} />
                <Field label="Role" value={project.sponsorRole} />
              </div>
            </section>
          )}

          {/* Stakeholders */}
          {(flipsideTeam.length > 0 || clientTeam.length > 0) && (
            <section>
              <h3 className="text-sm font-bold border-b pb-1 mb-3">Stakeholders</h3>
              <div className="grid grid-cols-2 gap-6">
                {flipsideTeam.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Flipside Team</p>
                    <div className="space-y-2">
                      {flipsideTeam.map((s, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{s.name}</span>
                          {s.role && <span className="text-muted-foreground"> · {s.role}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {clientTeam.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Client Team</p>
                    <div className="space-y-2">
                      {clientTeam.map((s, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{s.name}</span>
                          {s.role && <span className="text-muted-foreground"> · {s.role}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Billing Milestones */}
          {milestones.length > 0 && (
            <section>
              <h3 className="text-sm font-bold border-b pb-1 mb-3">Billing Milestones</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 pr-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Stage</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">%</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Value</th>
                    <th className="text-right py-1.5 pl-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-4">{m.stage}</td>
                      <td className="py-1.5 px-2 text-right">{m.percentage != null ? `${m.percentage}%` : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{m.value || "—"}</td>
                      <td className="py-1.5 pl-2 text-right">{m.date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
