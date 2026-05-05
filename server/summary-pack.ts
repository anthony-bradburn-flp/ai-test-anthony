import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, PageOrientation, ShadingType,
  type IBorderOptions,
} from "docx";
import { execFile } from "child_process";
import { promises as fsp } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import type { AiSettings } from "./storage";
import type { GenerateRequest } from "@shared/schema";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const ACCENT   = "C41E3A"; // Flipside red — active phase bars, sign-off text, accent rule
const DARK     = "111827"; // Near-black — table headers
const MID      = "6B7280"; // Secondary / muted text
const RULE_COL = "E5E7EB"; // Thin cell border colour
const ALT_ROW  = "F9FAFB"; // Alternating table row background
const WHITE    = "FFFFFF";

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
  risk:       string;
  mitigation: string;
}

interface SummaryData {
  intro:              string;
  phases:             Phase[];
  assumptions:        string[];
  governance_cadence: CadenceRow[];
  risks:              Risk[];
  next_step:          string;
}

// ─── AI Prompt ────────────────────────────────────────────────────────────────
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

// ─── Border / shading helpers ─────────────────────────────────────────────────

function thinBorder(): IBorderOptions {
  return { style: BorderStyle.SINGLE, size: 1, color: RULE_COL };
}

function noBorder(): IBorderOptions {
  return { style: BorderStyle.NONE, size: 0, color: WHITE };
}

function allBorders(fn: () => IBorderOptions): { top: IBorderOptions; bottom: IBorderOptions; left: IBorderOptions; right: IBorderOptions } {
  const b = fn();
  return { top: b, bottom: b, left: b, right: b };
}

// ShadingType.CLEAR is the correct OOXML value for "use fill as the background colour".
// The legacy "solid" val fills with the foreground *color* attribute (defaults to black)
// which is why tables previously appeared entirely black.
function cellShading(fill: string) {
  return { fill, type: ShadingType.CLEAR };
}

// ─── Table builders ───────────────────────────────────────────────────────────

function buildGanttTable(phases: Phase[], weeks: Date[], step: number): Table {
  const N = weeks.length;
  // Phase name column 26%, week columns split remaining 74%
  const weekPct = Math.max(1, Math.floor(74 / N));

  const headerCells = [
    new TableCell({
      shading: cellShading(DARK),
      borders: allBorders(thinBorder),
      width: { size: 26, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        children: [new TextRun({ text: "Phase", bold: true, color: WHITE, size: 16 })],
        spacing: { before: 40, after: 40 },
      })],
    }),
    ...weeks.map((w) =>
      new TableCell({
        shading: cellShading(DARK),
        borders: allBorders(thinBorder),
        width: { size: weekPct, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: fmtWeek(w), bold: true, color: WHITE, size: 12 })],
          spacing: { before: 40, after: 40 },
        })],
      })
    ),
  ];

  const phaseRows = phases.map((phase) =>
    new TableRow({
      children: [
        new TableCell({
          shading: cellShading(ALT_ROW),
          borders: allBorders(thinBorder),
          width: { size: 26, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text: phase.name, size: 16, color: DARK })],
            spacing: { before: 60, after: 60 },
          })],
        }),
        ...weeks.map((w) => {
          const active = phaseActive(phase, w, step);
          return new TableCell({
            shading: cellShading(active ? ACCENT : WHITE),
            borders: allBorders(thinBorder),
            width: { size: weekPct, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [], spacing: { before: 60, after: 60 } })],
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
  const COLS = [18, 14, 36, 32];
  const HEADS = ["Phase", "Dates", "Key Activities", "Deliverables & Review"];

  const headerRow = new TableRow({
    children: HEADS.map((h, i) =>
      new TableCell({
        shading: cellShading(DARK),
        borders: allBorders(thinBorder),
        width: { size: COLS[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: WHITE, size: 16 })],
          spacing: { before: 60, after: 60 },
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
      new Paragraph({ children: [new TextRun({ text: `• ${a}`, size: 16, color: DARK })], spacing: { after: 40 } })
    );

    const deliverableParagraphs = [
      ...phase.deliverables.map((d) =>
        new Paragraph({ children: [new TextRun({ text: `• ${d}`, size: 16, color: DARK })], spacing: { after: 40 } })
      ),
      ...(phase.sign_off ? [new Paragraph({
        children: [new TextRun({ text: `Sign-off: ${phase.sign_off}`, bold: true, color: ACCENT, size: 16 })],
        spacing: { before: 60 },
      })] : []),
    ];

    return new TableRow({
      children: [
        new TableCell({
          shading: cellShading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[0], type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text: phase.name, bold: true, size: 16, color: DARK })],
            spacing: { before: 60, after: 60 },
          })],
        }),
        new TableCell({
          shading: cellShading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[1], type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text: dateStr, size: 15, color: MID })],
            spacing: { before: 60, after: 60 },
          })],
        }),
        new TableCell({
          shading: cellShading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[2], type: WidthType.PERCENTAGE },
          children: activityParagraphs.length ? activityParagraphs : [new Paragraph({ children: [] })],
        }),
        new TableCell({
          shading: cellShading(fill),
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
        shading: cellShading(DARK),
        borders: allBorders(thinBorder),
        width: { size: COLS[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: WHITE, size: 16 })],
          spacing: { before: 60, after: 60 },
        })],
      })
    ),
  });

  const dataRows = rows.map((row, idx) => {
    const fill = idx % 2 === 0 ? WHITE : ALT_ROW;
    return new TableRow({
      children: [row.cadence, row.who, row.format, row.purpose].map((text, i) =>
        new TableCell({
          shading: cellShading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text, size: 16, color: DARK })],
            spacing: { before: 60, after: 60 },
          })],
        })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function buildRisksTable(risks: Risk[]): Table {
  const COLS = [50, 50];
  const HEADS = ["Risk", "Mitigation"];

  const headerRow = new TableRow({
    children: HEADS.map((h, i) =>
      new TableCell({
        shading: cellShading(DARK),
        borders: allBorders(thinBorder),
        width: { size: COLS[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: WHITE, size: 16 })],
          spacing: { before: 60, after: 60 },
        })],
      })
    ),
  });

  const dataRows = risks.map((r, idx) => {
    const fill = idx % 2 === 0 ? WHITE : ALT_ROW;
    return new TableRow({
      children: [r.risk, r.mitigation].map((text, i) =>
        new TableCell({
          shading: cellShading(fill),
          borders: allBorders(thinBorder),
          width: { size: COLS[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text, size: 16, color: i === 0 ? DARK : MID })],
            spacing: { before: 60, after: 60 },
          })],
        })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ─── LibreOffice PDF conversion ───────────────────────────────────────────────

/** Try to convert DOCX → PDF via LibreOffice headless.
 *  Returns { buffer, ext } — ext is "pdf" on success, "docx" if LibreOffice
 *  is not installed on this server (ENOENT) so the caller can adjust the filename. */
async function tryConvertToPdf(docxBuf: Buffer): Promise<{ buffer: Buffer; ext: "pdf" | "docx" }> {
  const id = randomBytes(8).toString("hex");
  const tmpDocx = join(tmpdir(), `spack_${id}.docx`);
  const tmpPdf  = join(tmpdir(), `spack_${id}.pdf`);
  try {
    await fsp.writeFile(tmpDocx, docxBuf);
    await new Promise<void>((resolve, reject) =>
      execFile(
        "libreoffice",
        ["--headless", "--convert-to", "pdf", "--outdir", tmpdir(), tmpDocx],
        { timeout: 60_000 },
        (err) => (err ? reject(err) : resolve()),
      ),
    );
    const pdf = await fsp.readFile(tmpPdf);
    return { buffer: pdf, ext: "pdf" };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      // LibreOffice is not installed on this server — return the DOCX buffer.
      // Install with: sudo apt-get install -y libreoffice
      console.warn("[summary-pack] LibreOffice not found — serving DOCX instead of PDF. Install libreoffice to enable PDF output.");
      return { buffer: docxBuf, ext: "docx" };
    }
    throw err;
  } finally {
    await Promise.allSettled([fsp.unlink(tmpDocx), fsp.unlink(tmpPdf)]);
  }
}

// ─── DOCX assembler ───────────────────────────────────────────────────────────

async function buildSummaryPackDocx(data: SummaryData, projectData: GenerateRequest): Promise<Buffer> {
  let { weeks, step } = getWeekStarts(projectData.startDate, projectData.endDate);
  if (weeks.length === 0) weeks = [new Date(projectData.startDate)];

  const firstYear  = new Date(projectData.startDate).getFullYear();
  const lastYear   = new Date(projectData.endDate).getFullYear();
  const yearSuffix = firstYear === lastYear ? `${firstYear}` : `${firstYear}–${lastYear}`;
  const dateRange  = `${fmtWeek(weeks[0])} – ${fmtWeek(weeks[weeks.length - 1])} ${yearSuffix}`;

  const sponsor    = projectData.clientStakeholders[projectData.sponsorIndex];
  const flipTeam   = (projectData.flipsideStakeholders as { name: string; role: string; allocation?: number }[])
    .map((s) => `${s.name} (${s.role})`)
    .join("  ·  ");

  // ── Page 1: Title + intro + Gantt ──────────────────────────────────────────
  const p1: (Paragraph | Table)[] = [
    // Red accent bar at top (thin table with only a top border)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top:              { style: BorderStyle.THICK, size: 6, color: ACCENT },
        bottom:           noBorder(),
        left:             noBorder(),
        right:            noBorder(),
        insideHorizontal: noBorder(),
        insideVertical:   noBorder(),
      },
      rows: [new TableRow({ children: [new TableCell({ borders: allBorders(noBorder), children: [new Paragraph({ children: [] })] })] })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `${projectData.projectName}`, bold: true, color: DARK, size: 48 })],
      spacing: { before: 160, after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Project Summary Pack", color: ACCENT, size: 28, bold: true })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${projectData.client}  ×  Flipside`, color: MID, size: 18 }),
        new TextRun({ text: `   |   ${projectData.projectType}   |   ${projectData.projectSize}`, color: MID, size: 18 }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.intro, size: 18, color: DARK })],
      spacing: { before: 80, after: 280 },
    }),

    // Gantt heading
    new Paragraph({
      children: [new TextRun({ text: `Phase Overview  —  ${dateRange}`, bold: true, size: 22, color: DARK })],
      spacing: { before: 80, after: 140 },
    }),
    buildGanttTable(data.phases, weeks, step),
    // Legend
    new Paragraph({
      children: [new TextRun({ text: "  Active phase  ", size: 14, color: MID })],
      spacing: { before: 80 },
    }),

    // Team / sponsor line at bottom of page 1
    new Paragraph({
      children: [
        new TextRun({ text: "Flipside team: ", bold: true, size: 16, color: DARK }),
        new TextRun({ text: flipTeam, size: 16, color: MID }),
      ],
      spacing: { before: 200 },
    }),
    ...(sponsor ? [new Paragraph({
      children: [
        new TextRun({ text: "Client sponsor: ", bold: true, size: 16, color: DARK }),
        new TextRun({ text: `${sponsor.name} (${sponsor.role})`, size: 16, color: MID }),
      ],
      spacing: { after: 80 },
    })] : []),
  ];

  // ── Page 2: Phase detail ────────────────────────────────────────────────────
  const p2: (Paragraph | Table)[] = [
    new Paragraph({
      pageBreakBefore: true,
      children: [new TextRun({ text: "Phase detail — what each phase produces", bold: true, size: 26, color: DARK })],
      spacing: { after: 180 },
    }),
    buildPhaseDetailTable(data.phases),
  ];

  // ── Page 3: Assumptions + Governance + Risks ────────────────────────────────
  const assumptionsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: cellShading(DARK),
            borders: allBorders(thinBorder),
            children: [new Paragraph({
              children: [new TextRun({ text: "Assumptions", bold: true, color: WHITE, size: 16 })],
              spacing: { before: 60, after: 60 },
            })],
          }),
        ],
      }),
      ...data.assumptions.map((a, idx) =>
        new TableRow({
          children: [
            new TableCell({
              shading: cellShading(idx % 2 === 0 ? WHITE : ALT_ROW),
              borders: allBorders(thinBorder),
              children: [new Paragraph({
                children: [new TextRun({ text: `• ${a}`, size: 16, color: DARK })],
                spacing: { before: 50, after: 50 },
              })],
            }),
          ],
        })
      ),
    ],
  });

  const p3: (Paragraph | Table)[] = [
    new Paragraph({
      pageBreakBefore: true,
      children: [new TextRun({ text: "Assumptions", bold: true, size: 26, color: DARK })],
      spacing: { after: 160 },
    }),
    assumptionsTable,
    new Paragraph({ spacing: { after: 240 }, children: [] }),

    new Paragraph({
      children: [new TextRun({ text: "Governance & review cadence", bold: true, size: 26, color: DARK })],
      spacing: { after: 160 },
    }),
    buildGovernanceTable(data.governance_cadence),
    new Paragraph({ spacing: { after: 240 }, children: [] }),

    new Paragraph({
      children: [new TextRun({ text: "Key risks & mitigations", bold: true, size: 26, color: DARK })],
      spacing: { after: 160 },
    }),
    buildRisksTable(data.risks),
    new Paragraph({ spacing: { after: 240 }, children: [] }),

    new Paragraph({
      children: [
        new TextRun({ text: "Next step:  ", bold: true, size: 18, color: DARK }),
        new TextRun({ text: data.next_step, size: 18, color: MID }),
      ],
      spacing: { after: 80 },
    }),
  ];

  // A4 landscape: width=297mm=16838 twips, height=210mm=11906 twips
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
            width: 16838,
            height: 11906,
          },
          margin: { top: 720, right: 900, bottom: 720, left: 900 }, // ~0.5" top/bottom, ~0.625" sides
        },
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

  const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let data: SummaryData;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned non-JSON for summary pack: ${cleaned.slice(0, 200)}`);
  }

  if (!Array.isArray(data.phases) || !Array.isArray(data.assumptions) ||
      !Array.isArray(data.risks) || !Array.isArray(data.governance_cadence)) {
    throw new Error("AI summary pack response is missing required array fields (phases/assumptions/risks/governance_cadence)");
  }

  const docxBuffer     = await buildSummaryPackDocx(data, projectData);
  const { buffer, ext } = await tryConvertToPdf(docxBuffer);

  const clientSlug = projectData.client.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const filename   = `${projectData.sheetRef}_${clientSlug}_Summary_Pack.${ext}`;
  const preview    = `${data.phases.length} phases · ${data.assumptions.length} assumptions · ${data.risks.length} risks`;

  return { buffer, filename, preview };
}
