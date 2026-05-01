import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel,
} from "docx";
import type { AiSettings } from "@shared/schema";
import type { GenerateRequest } from "@shared/schema";

// ─── Brand tokens ────────────────────────────────────────────────────────────
const ACCENT    = "C41E3A"; // Flipside red
const DARK      = "1F2937"; // near-black headings/table headers
const MID       = "6B7280"; // secondary / muted text
const RULE_COL  = "E5E7EB"; // thin border colour
const ALT_ROW   = "F9FAFB"; // alternating table row background
const WHITE     = "FFFFFF";

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Phase {
  name:           string;
  start_date:     string; // YYYY-MM-DD
  end_date:       string; // YYYY-MM-DD
  workshop:       string | null;
  key_activities: string[];
  deliverables:   string[];
  sign_off:       string | null;
}

interface CadenceRow {
  cadence: string;
  who:     string;
  format:  string;
  purpose: string;
}

interface Risk {
  risk:        string;
  mitigation:  string;
}

interface SummaryData {
  intro:               string;
  phases:              Phase[];
  assumptions:         string[];
  governance_cadence:  CadenceRow[];
  risks:               Risk[];
  next_step:           string;
}

// ─── AI Prompt ───────────────────────────────────────────────────────────────
function buildSummaryPrompt(
  projectData: GenerateRequest,
  supportingDocs: Array<{ name: string; content: string }>,
): string {
  const sponsor    = projectData.clientStakeholders[projectData.sponsorIndex];
  const flipTeam   = (projectData.flipsideStakeholders as { name: string; role: string; allocation?: number }[])
    .map((s) => `${s.name} — ${s.role}${s.allocation != null && s.allocation < 100 ? ` (${s.allocation}%)` : ""}`)
    .join(", ");
  const clientTeam = (projectData.clientStakeholders as { name: string; role: string }[])
    .map((s, i) => `${s.name} — ${s.role}${i === projectData.sponsorIndex ? " [Sponsor]" : ""}`)
    .join(", ");
  const milestones = (projectData.billingMilestones as { stage: string; percentage: number; date: string }[])
    .map((m) => `  - ${m.stage}: ${m.percentage}% by ${m.date}`)
    .join("\n");

  let prompt = `You are a senior project manager writing a concise, client-facing project summary document.

Generate a structured JSON object for a 2–3 page project summary pack. Return ONLY valid JSON — no markdown, no code fences.

PROJECT DETAILS
Client: ${projectData.client}
Project Name: ${projectData.projectName}
Project Type: ${projectData.projectType}
Project Size: ${projectData.projectSize}
Value: ${projectData.value}
Start Date: ${projectData.startDate}
End Date: ${projectData.endDate}
Flipside Team: ${flipTeam}
Client Team: ${clientTeam}
Sponsor: ${sponsor ? `${sponsor.name} (${sponsor.role})` : "TBC"}

BILLING MILESTONES
${milestones}

PROJECT SUMMARY
${projectData.summary}`;

  if (supportingDocs.length > 0) {
    prompt += `\n\nSUPPORTING DOCUMENTS\n`;
    for (const doc of supportingDocs) {
      prompt += `\n--- ${doc.name} ---\n${doc.content.slice(0, 1500)}\n`;
    }
  }

  prompt += `

Return exactly this JSON structure — all fields required:
{
  "intro": "2–3 sentence paragraph: project purpose, scope, and key outcome. Written confidently for a client audience.",
  "phases": [
    {
      "name": "Phase label, e.g. '1. Discovery & Alignment'",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "workshop": "Workshop title/description or null if none",
      "key_activities": ["concise activity", "concise activity"],
      "deliverables": ["deliverable name", "deliverable name"],
      "sign_off": "Sign-off description and date (e.g. 'Client approval w/c 18 May') or null"
    }
  ],
  "assumptions": ["assumption statement"],
  "governance_cadence": [
    {
      "cadence": "Meeting name and duration (e.g. 'Weekly checkpoint (30 min)')",
      "who": "Attendees (e.g. 'Core team + client leads')",
      "format": "Virtual / In-person / Hybrid",
      "purpose": "Purpose of this meeting"
    }
  ],
  "risks": [
    {
      "risk": "Risk description",
      "mitigation": "How this risk is mitigated"
    }
  ],
  "next_step": "Single immediate next action (e.g. 'Confirm dates and book kick-off call')"
}

RULES
- Derive 3–5 phases from the project summary, type, and billing milestones. Phases must have realistic start/end dates within the project's start/end dates.
- Write 5–8 concise, realistic assumptions appropriate for this project type and size.
- Include 3–4 governance cadence rows (lightweight: weekly check-in, bi-weekly status, phase reviews, workshops).
- Identify 3–4 key risks with concrete mitigations.
- Dates must be valid YYYY-MM-DD within the project's date range.
- Keep activities and deliverables short (5–8 words each).`;

  return prompt;
}

// ─── Gantt helpers ────────────────────────────────────────────────────────────

function getWeekStarts(startDate: string, endDate: string): { weeks: Date[]; step: number } {
  const s = new Date(startDate);
  const e = new Date(endDate);
  // Rewind to the Monday on or before start
  const dow = s.getDay();
  s.setDate(s.getDate() - (dow === 0 ? 6 : dow - 1));

  const all: Date[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    all.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  // Cap at 16 display columns; widen step for long projects
  const step = all.length <= 16 ? 1 : all.length <= 32 ? 2 : 4;
  return { weeks: all.filter((_, i) => i % step === 0), step };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtWeek(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function phaseActive(phase: Phase, weekStart: Date, step: number): boolean {
  const ps = new Date(phase.start_date);
  const pe = new Date(phase.end_date);
  const we = new Date(weekStart);
  we.setDate(weekStart.getDate() + step * 7 - 1);
  return weekStart <= pe && we >= ps;
}

// ─── Cell/border helpers ──────────────────────────────────────────────────────

function thinBorder() {
  return { style: BorderStyle.SINGLE, size: 1, color: RULE_COL };
}

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: WHITE };
}

function allBorders(fn: () => object) {
  const b = fn();
  return { top: b, bottom: b, left: b, right: b };
}

function shading(fill: string) {
  // Use 'solid' as a string — docx v9 ShadingType enum evaluates to these strings
  return { fill, type: "solid" as const };
}

// ─── Table builders ───────────────────────────────────────────────────────────

function buildGanttTable(phases: Phase[], weeks: Date[], step: number): Table {
  const N = weeks.length;
  // Phase name column 28%, week columns split remaining 72%
  const weekPct = Math.max(1, Math.floor(72 / N));

  const headerCells = [
    new TableCell({
      shading: shading(DARK),
      borders: allBorders(thinBorder),
      width: { size: 28, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        children: [new TextRun({ text: "Phase", bold: true, color: WHITE, size: 14 })],
      })],
    }),
    ...weeks.map((w) =>
      new TableCell({
        shading: shading(DARK),
        borders: allBorders(thinBorder),
        width: { size: weekPct, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: fmtWeek(w), bold: true, color: WHITE, size: 12 })],
        })],
      })
    ),
  ];

  const phaseRows = phases.map((phase) =>
    new TableRow({
      children: [
        new TableCell({
          shading: shading(ALT_ROW),
          borders: allBorders(thinBorder),
          width: { size: 28, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text: phase.name, size: 16 })],
          })],
        }),
        ...weeks.map((w) => {
          const active = phaseActive(phase, w, step);
          return new TableCell({
            shading: shading(active ? ACCENT : WHITE),
            borders: allBorders(thinBorder),
            width: { size: weekPct, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [] })],
          });
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...phaseRows],
  });
}

function buildPhaseDetailTable(phases: Phase[]): Table {
  const COLS = [20, 15, 35, 30];
  const HEADS = ["Phase", "Dates", "Key Activities", "Deliverables & Review"];

  const headerRow = new TableRow({
    children: HEADS.map((h, i) =>
      new TableCell({
        shading: shading(DARK),
        borders: allBorders(thinBorder),
        width: { size: COLS[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: WHITE, size: 16 })],
        })],
      })
    ),
  });

  const dataRows = phases.map((phase, idx) => {
    const s = new Date(phase.start_date);
    const e = new Date(phase.end_date);
    const dateStr = `w/c ${s.getDate()} ${MONTHS[s.getMonth()]} → w/c ${e.getDate()} ${MONTHS[e.getMonth()]}`;
    const fill = idx % 2 === 0 ? WHITE : ALT_ROW;

    const activityParagraphs = phase.key_activities.map((a) =>
      new Paragraph({ children: [new TextRun({ text: `• ${a}`, size: 16 })], spacing: { after: 40 } })
    );

    const deliverableParagraphs = [
      ...phase.deliverables.map((d) =>
        new Paragraph({ children: [new TextRun({ text: `• ${d}`, size: 16 })], spacing: { after: 40 } })
      ),
      ...(phase.sign_off ? [new Paragraph({
        children: [new TextRun({ text: `Sign-off: ${phase.sign_off}`, bold: true, color: ACCENT, size: 16 })],
        spacing: { before: 60 },
      })] : []),
    ];

    return new TableRow({
      children: [
        new TableCell({
          shading: shading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[0], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: phase.name, bold: true, size: 16 })] })],
        }),
        new TableCell({
          shading: shading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[1], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: dateStr, size: 16, color: MID })] })],
        }),
        new TableCell({
          shading: shading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[2], type: WidthType.PERCENTAGE },
          children: activityParagraphs.length ? activityParagraphs : [new Paragraph({ children: [] })],
        }),
        new TableCell({
          shading: shading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[3], type: WidthType.PERCENTAGE },
          children: deliverableParagraphs.length ? deliverableParagraphs : [new Paragraph({ children: [] })],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function buildGovernanceTable(rows: CadenceRow[]): Table {
  const COLS = [25, 25, 15, 35];
  const HEADS = ["Cadence", "Who", "Format", "Purpose"];

  const headerRow = new TableRow({
    children: HEADS.map((h, i) =>
      new TableCell({
        shading: shading(DARK),
        borders: allBorders(thinBorder),
        width: { size: COLS[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: WHITE, size: 16 })],
        })],
      })
    ),
  });

  const dataRows = rows.map((row, idx) => {
    const fill = idx % 2 === 0 ? WHITE : ALT_ROW;
    return new TableRow({
      children: [row.cadence, row.who, row.format, row.purpose].map((text, i) =>
        new TableCell({
          shading: shading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text, size: 16 })] })],
        })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ─── DOCX assembler ───────────────────────────────────────────────────────────

async function buildSummaryPackDocx(data: SummaryData, projectData: GenerateRequest): Promise<Buffer> {
  let { weeks, step } = getWeekStarts(projectData.startDate, projectData.endDate);
  // Fallback: if dates are equal or reversed, show a single-week column rather than crashing
  if (weeks.length === 0) weeks = [new Date(projectData.startDate)];

  const dateRange = `${fmtWeek(weeks[0])} – ${fmtWeek(weeks[weeks.length - 1])} ${new Date(projectData.endDate).getFullYear()}`;

  // ── Page 1: Title + intro + Gantt ─────────────────────────────────────────
  const p1: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: `${projectData.projectName} — Project Summary`, bold: true, color: ACCENT, size: 52 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `${projectData.client} × Flipside  |  ${projectData.projectType}  |  ${new Date(projectData.startDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`,
        color: MID, size: 18,
      })],
      spacing: { after: 200 },
    }),
    // Divider: a table with a single bold top border acts as a clean horizontal rule
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top:     { style: BorderStyle.THICK, size: 4, color: ACCENT },
        bottom:  noBorder(),
        left:    noBorder(),
        right:   noBorder(),
        insideH: noBorder(),
        insideV: noBorder(),
      },
      rows: [new TableRow({ children: [new TableCell({ borders: allBorders(noBorder), children: [new Paragraph({ children: [] })] })] })],
    }),
    new Paragraph({
      children: [new TextRun({ text: data.intro, size: 20, color: DARK })],
      spacing: { before: 200, after: 360 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Phase Overview  —  ${dateRange}`, bold: true, size: 22, color: DARK })],
      spacing: { before: 80, after: 160 },
    }),
    buildGanttTable(data.phases, weeks, step),
    // Legend
    new Paragraph({
      children: [new TextRun({ text: "Active phase     Workshop     Sign-off milestone", size: 14, color: MID })],
      spacing: { before: 100 },
    }),
  ];

  // ── Page 2: Phase detail ───────────────────────────────────────────────────
  const p2: (Paragraph | Table)[] = [
    new Paragraph({
      pageBreakBefore: true,
      children: [new TextRun({ text: "Phase detail — what each phase produces", bold: true, size: 26, color: DARK })],
      spacing: { after: 200 },
    }),
    buildPhaseDetailTable(data.phases),
  ];

  // ── Page 3: Assumptions + Governance + Risks ──────────────────────────────
  const p3: (Paragraph | Table)[] = [
    new Paragraph({
      pageBreakBefore: true,
      children: [new TextRun({ text: "Assumptions", bold: true, size: 26, color: DARK })],
      spacing: { after: 160 },
    }),
    ...data.assumptions.map((a) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: a, size: 18 })],
        spacing: { after: 60 },
      })
    ),
    new Paragraph({ spacing: { after: 280 }, children: [] }),

    new Paragraph({
      children: [new TextRun({ text: "Governance & review cadence", bold: true, size: 26, color: DARK })],
      spacing: { after: 160 },
    }),
    buildGovernanceTable(data.governance_cadence),
    new Paragraph({ spacing: { after: 280 }, children: [] }),

    new Paragraph({
      children: [new TextRun({ text: "Key risks & mitigations", bold: true, size: 26, color: DARK })],
      spacing: { after: 160 },
    }),
    ...data.risks.map((r) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({ text: r.risk, size: 18 }),
          new TextRun({ text: ` — ${r.mitigation}`, size: 18, color: MID }),
        ],
        spacing: { after: 80 },
      })
    ),
    new Paragraph({ spacing: { after: 280 }, children: [] }),

    new Paragraph({
      children: [
        new TextRun({ text: "Next step: ", italic: true, size: 18, color: MID }),
        new TextRun({ text: data.next_step, italic: true, bold: true, size: 18, color: MID }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
      },
      children: [...p1, ...p2, ...p3],
    }],
  });

  return Packer.toBuffer(doc);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateSummaryPack(
  projectData: GenerateRequest,
  settings: AiSettings,
  supportingDocs: Array<{ name: string; content: string }>,
  apiKey: string,
): Promise<{ buffer: Buffer; filename: string; preview: string }> {
  const prompt = buildSummaryPrompt(projectData, supportingDocs);
  let rawJson: string;

  if (settings.provider === "anthropic") {
    const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    rawJson = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } else {
    const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 1 });
    const response = await client.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    rawJson = response.choices[0]?.message?.content ?? "";
  }

  // Strip any accidental markdown fences the AI might add despite instructions
  const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let data: SummaryData;
  try {
    data = JSON.parse(cleaned);
  } catch {
    // Include the first 200 chars of the raw response so the error log is actionable
    throw new Error(`AI returned non-JSON for summary pack: ${cleaned.slice(0, 200)}`);
  }

  // Guard: AI may return valid JSON with missing or null array fields
  if (!Array.isArray(data.phases) || !Array.isArray(data.assumptions) ||
      !Array.isArray(data.risks) || !Array.isArray(data.governance_cadence)) {
    throw new Error("AI summary pack response is missing required array fields (phases/assumptions/risks/governance_cadence)");
  }

  const buffer = await buildSummaryPackDocx(data, projectData);

  const clientSlug = projectData.client.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const filename = `${projectData.sheetRef}_${clientSlug}_Summary_Pack.docx`;
  const preview  = `${data.phases.length} phases · ${data.assumptions.length} assumptions · ${data.risks.length} risks`;

  return { buffer, filename, preview };
}
