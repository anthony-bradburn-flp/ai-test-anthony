import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiSettings } from "./storage";
import type { GenerateRequest } from "@shared/schema";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter: any = require("pdfmake/js/Printer.js").default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { vfs: hlRawVfs, fonts: hlFonts } = require("pdfmake/build/standard-fonts/Helvetica.js") as {
  vfs: Record<string, { data: string; encoding: string }>;
  fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hlVfs: any = require("pdfmake/js/virtual-fs.js").default;

// Populate the VirtualFileSystem with Helvetica AFM metrics (idempotent — safe to call multiple times)
for (const [name, content] of Object.entries(hlRawVfs)) {
  if (!hlVfs.existsSync(name)) {
    hlVfs.writeFileSync(name, Buffer.from(content.data, (content.encoding as BufferEncoding) || "utf8"));
  }
}

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const ACCENT = "#C41E3A"; // Flipside red
const DARK   = "#111827"; // Near-black — headers, primary text
const MID    = "#6B7280"; // Secondary / muted text
const RULE   = "#E5E7EB"; // Cell border colour
const ALT    = "#F9FAFB"; // Alternating row background
const WHITE  = "#FFFFFF";

// A4 landscape content width: 841.89 − 36 − 36 ≈ 770 pt
const PAGE_W = 770;

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Milestone {
  name: string;
  date: string; // YYYY-MM-DD
}

interface Phase {
  name:           string;
  start_date:     string;
  end_date:       string;
  workshop:       string | null;
  key_activities: string[];
  deliverables:   string[];
  sign_off:       string | null;
  milestones:     Milestone[];
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
      "sign_off": "Sign-off description and date (e.g. 'Client approval w/c 18 May') or null",
      "milestones": [
        { "name": "Kick-off", "date": "YYYY-MM-DD" },
        { "name": "Deliverable sign-off", "date": "YYYY-MM-DD" }
      ]
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
- Keep activities and deliverables short (5–8 words each).
- Each phase must include 1–3 milestones. Milestone dates must fall within the phase's start_date–end_date. Milestones should represent key events: kick-off, workshop, review, sign-off, or major deliverable.`;

  return prompt;
}

// ─── Gantt helpers ────────────────────────────────────────────────────────────

function getWeekStarts(startDate: string, endDate: string): { weeks: Date[]; step: number } {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const dow = s.getDay();
  s.setDate(s.getDate() - (dow === 0 ? 6 : dow - 1));

  const all: Date[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    all.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
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

// Returns the index of the last week column whose start is on or before the milestone date.
function milestoneWeekIdx(dateStr: string, weeks: Date[]): number {
  const d = new Date(dateStr);
  let idx = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i] <= d) idx = i;
    else break;
  }
  return idx;
}

// ─── pdfmake helpers ──────────────────────────────────────────────────────────

const tblLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  paddingLeft:   () => 5,
  paddingRight:  () => 5,
  paddingTop:    () => 4,
  paddingBottom: () => 4,
};

function hCell(text: string, opts: { fontSize?: number; align?: string } = {}): any {
  return {
    text,
    bold: true,
    color: WHITE,
    fillColor: DARK,
    fontSize: opts.fontSize ?? 8,
    alignment: opts.align ?? "left",
  };
}

function sectionHead(text: string, pageBreak = false): any {
  return {
    text,
    bold: true,
    fontSize: 11,
    color: DARK,
    margin: [0, pageBreak ? 2 : 14, 0, 6],
    ...(pageBreak ? { pageBreak: "before" as const } : {}),
  };
}

// ─── Table builders ───────────────────────────────────────────────────────────

function buildGanttPdf(phases: Phase[], weeks: Date[], step: number): any {
  const headerRow = [
    hCell("Phase"),
    ...weeks.map((w) => hCell(fmtWeek(w), { fontSize: 6, align: "center" })),
  ];

  const dataRows: any[][] = [];
  phases.forEach((phase, idx) => {
    const rowFill = idx % 2 === 0 ? WHITE : ALT;
    // Phase bar row
    dataRows.push([
      { text: phase.name, fontSize: 7, bold: true, color: DARK, fillColor: rowFill },
      ...weeks.map((w) => ({
        text: " ",
        fillColor: phaseActive(phase, w, step) ? ACCENT : rowFill,
      })),
    ]);
    // Milestone sub-rows
    for (const ms of phase.milestones ?? []) {
      const mIdx = milestoneWeekIdx(ms.date, weeks);
      dataRows.push([
        { text: `  ↳ ${ms.name}`, fontSize: 6.5, color: MID, fillColor: WHITE },
        ...weeks.map((_, i) => ({
          text: i === mIdx ? "◆" : "",
          fontSize: 7,
          color: DARK,
          alignment: "center",
          fillColor: WHITE,
        })),
      ]);
    }
  });

  return {
    table: {
      widths: [200, ...weeks.map(() => "*")],
      body: [headerRow, ...dataRows],
    },
    layout: tblLayout,
    margin: [0, 0, 0, 6],
  };
}

function buildPhaseDetailPdf(phases: Phase[]): any {
  // [18%, 14%, 36%, 32%] of 770pt
  const WIDTHS = [139, 108, 277, 246];
  const HEADS  = ["Phase", "Dates", "Key Activities", "Deliverables & Review"];

  const headerRow = HEADS.map((h) => hCell(h));

  const dataRows = phases.map((phase, idx) => {
    const s = new Date(phase.start_date);
    const e = new Date(phase.end_date);
    const dateStr = `${s.getDate()} ${MONTHS[s.getMonth()]} → ${e.getDate()} ${MONTHS[e.getMonth()]}`;
    const fill = idx % 2 === 0 ? WHITE : ALT;

    return [
      { text: phase.name, bold: true, fontSize: 7.5, color: DARK, fillColor: fill },
      { text: dateStr, fontSize: 7, color: MID, fillColor: fill },
      {
        stack: phase.key_activities.map((a) => ({
          text: `• ${a}`,
          fontSize: 7,
          color: DARK,
          margin: [0, 1, 0, 1],
        })),
        fillColor: fill,
      },
      {
        stack: [
          ...phase.deliverables.map((d) => ({
            text: `• ${d}`,
            fontSize: 7,
            color: DARK,
            margin: [0, 1, 0, 1],
          })),
          ...(phase.sign_off ? [{
            text: `Sign-off: ${phase.sign_off}`,
            fontSize: 7,
            bold: true,
            color: ACCENT,
            margin: [0, 5, 0, 1],
          }] : []),
        ],
        fillColor: fill,
      },
    ];
  });

  return {
    table: {
      widths: WIDTHS,
      headerRows: 1,
      body: [headerRow, ...dataRows],
    },
    layout: tblLayout,
    margin: [0, 0, 0, 8],
  };
}

function buildGovernancePdf(rows: CadenceRow[]): any {
  // [25%, 25%, 15%, 35%] of 770pt
  const WIDTHS = [193, 193, 116, 268];
  const HEADS  = ["Cadence", "Who", "Format", "Purpose"];

  const headerRow = HEADS.map((h) => hCell(h));

  const dataRows = rows.map((row, idx) => {
    const fill = idx % 2 === 0 ? WHITE : ALT;
    return [row.cadence, row.who, row.format, row.purpose].map((t) => ({
      text: t,
      fontSize: 7.5,
      color: DARK,
      fillColor: fill,
    }));
  });

  return {
    table: {
      widths: WIDTHS,
      headerRows: 1,
      body: [headerRow, ...dataRows],
    },
    layout: tblLayout,
    margin: [0, 0, 0, 8],
  };
}

function buildRisksPdf(risks: Risk[]): any {
  const headerRow = [hCell("Risk"), hCell("Mitigation")];

  const dataRows = risks.map((r, idx) => {
    const fill = idx % 2 === 0 ? WHITE : ALT;
    return [
      { text: r.risk,       fontSize: 7.5, color: DARK, fillColor: fill },
      { text: r.mitigation, fontSize: 7.5, color: MID,  fillColor: fill },
    ];
  });

  return {
    table: {
      widths: [385, 385],
      headerRows: 1,
      body: [headerRow, ...dataRows],
    },
    layout: tblLayout,
    margin: [0, 0, 0, 8],
  };
}

function buildContactsTable(projectData: GenerateRequest): any {
  const flipTeam   = projectData.flipsideStakeholders as { name: string; role: string; allocation?: number }[];
  const clientTeam = projectData.clientStakeholders   as { name: string; role: string }[];
  const sponsorIdx = projectData.sponsorIndex;

  const maxRows = Math.max(flipTeam.length, clientTeam.length);
  const dataRows = Array.from({ length: maxRows }, (_, i) => {
    const fill      = i % 2 === 0 ? WHITE : ALT;
    const fm        = flipTeam[i];
    const cm        = clientTeam[i];
    const isSponsor = cm != null && i === sponsorIdx;

    const fmText = fm
      ? `${fm.name}  —  ${fm.role}${fm.allocation != null && fm.allocation < 100 ? ` (${fm.allocation}%)` : ""}`
      : "";
    const cmText = cm
      ? `${cm.name}  —  ${cm.role}${isSponsor ? "  ★ Sponsor" : ""}`
      : "";

    return [
      { text: fmText, fontSize: 7.5, color: DARK,                     fillColor: fill },
      { text: cmText, fontSize: 7.5, color: isSponsor ? ACCENT : DARK, fillColor: fill },
    ];
  });

  return {
    table: {
      widths: ["*", "*"],
      headerRows: 1,
      body: [
        [hCell("Flipside Team"), hCell("Client Team")],
        ...dataRows,
      ],
    },
    layout: tblLayout,
    margin: [0, 8, 0, 0],
  };
}

// ─── PDF assembler ────────────────────────────────────────────────────────────

async function buildSummaryPackPdf(data: SummaryData, projectData: GenerateRequest): Promise<Buffer> {
  let { weeks, step } = getWeekStarts(projectData.startDate, projectData.endDate);
  if (weeks.length === 0) weeks = [new Date(projectData.startDate)];

  const firstYear  = new Date(projectData.startDate).getFullYear();
  const lastYear   = new Date(projectData.endDate).getFullYear();
  const yearSuffix = firstYear === lastYear ? `${firstYear}` : `${firstYear}–${lastYear}`;
  const dateRange  = `${fmtWeek(weeks[0])} – ${fmtWeek(weeks[weeks.length - 1])} ${yearSuffix}`;

  const docDef: any = {
    pageSize: "A4",
    pageOrientation: "landscape",
    // Extra top margin (44pt) leaves room below the 5pt accent bar
    pageMargins: [36, 44, 36, 36],

    // Red accent bar rendered behind content on every page
    background: (_page: number, pageSize: { width: number; height: number }) => ({
      canvas: [{
        type: "rect",
        x: 0, y: 0,
        w: pageSize.width,
        h: 5,
        color: ACCENT,
        r: 0,
      }],
    }),

    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${projectData.projectName}  ·  ${projectData.client}`, fontSize: 7, color: MID, margin: [36, 8, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, fontSize: 7, color: MID, alignment: "right", margin: [0, 8, 36, 0] },
      ],
    }),

    defaultStyle: {
      font: "Helvetica",
      fontSize: 8,
      color: DARK,
    },

    content: [
      // ── Page 1: Title + intro + Gantt ──────────────────────────────────────
      {
        text: projectData.projectName,
        bold: true,
        fontSize: 22,
        color: DARK,
        margin: [0, 0, 0, 3],
      },
      {
        text: "Project Summary Pack",
        fontSize: 13,
        bold: true,
        color: ACCENT,
        margin: [0, 0, 0, 4],
      },
      {
        text: `${projectData.client}  ×  Flipside   |   ${projectData.projectType}   |   ${projectData.projectSize}`,
        fontSize: 8,
        color: MID,
        margin: [0, 0, 0, 10],
      },
      {
        text: data.intro,
        fontSize: 8.5,
        color: DARK,
        margin: [0, 0, 0, 12],
      },
      sectionHead(`Phase Overview  —  ${dateRange}`),
      buildGanttPdf(data.phases, weeks, step),
      buildContactsTable(projectData),

      // ── Page 2: Phase detail ────────────────────────────────────────────────
      sectionHead("Phase detail  —  what each phase produces", true),
      buildPhaseDetailPdf(data.phases),

      // ── Page 3: Assumptions + Governance + Risks ────────────────────────────
      sectionHead("Assumptions", true),
      {
        table: {
          widths: ["*"],
          body: [
            [hCell("Key assumptions")],
            ...data.assumptions.map((a, idx) => [{
              text: `• ${a}`,
              fontSize: 7.5,
              color: DARK,
              fillColor: idx % 2 === 0 ? WHITE : ALT,
            }]),
          ],
        },
        layout: tblLayout,
        margin: [0, 0, 0, 12],
      },

      sectionHead("Governance & review cadence"),
      buildGovernancePdf(data.governance_cadence),

      sectionHead("Key risks & mitigations"),
      buildRisksPdf(data.risks),

      {
        text: [
          { text: "Next step:  ", bold: true, fontSize: 9 },
          { text: data.next_step, fontSize: 9, color: MID },
        ],
        margin: [0, 10, 0, 0],
      },
    ],
  };

  // Standard PDF fonts need no URL fetching; this no-op resolver satisfies the API
  const urlResolver = {
    resolve: (_url: string) => undefined,
    resolved: () => Promise.resolve(),
  };

  const printer = new PdfPrinter(hlFonts, hlVfs, urlResolver);
  const pdfDoc  = await printer.createPdfKitDocument(docDef);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("readable", () => {
      let chunk: Buffer | null;
      while ((chunk = pdfDoc.read(1 << 20)) !== null) {
        chunks.push(chunk);
      }
    });
    pdfDoc.on("end",   () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
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

  const buffer     = await buildSummaryPackPdf(data, projectData);
  const clientSlug = projectData.client.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const filename   = `${projectData.sheetRef}_${clientSlug}_Summary_Pack.pdf`;
  const preview    = `${data.phases.length} phases · ${data.assumptions.length} assumptions · ${data.risks.length} risks`;

  return { buffer, filename, preview };
}
