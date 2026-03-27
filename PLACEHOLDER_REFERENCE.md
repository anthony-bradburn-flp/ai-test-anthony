# Template Placeholder Reference

This document lists all placeholders to be added to each template file.
Syntax follows **docxtemplater** conventions — works for both `.docx` (Word) and `.xlsx` (Excel).

---

## Shared placeholders (used in all documents)

| Placeholder | Value |
|---|---|
| `{sheet_ref}` | Sheet reference (e.g. SM025) |
| `{client}` | Client name |
| `{project_name}` | Project name |
| `{project_type}` | Project type (Web / App / Strategy etc.) |
| `{project_size}` | Project size |
| `{value}` | Project value / budget |
| `{start_date}` | SOW start date |
| `{end_date}` | SOW end date |
| `{summary}` | Project summary |
| `{sponsor_name}` | Client sponsor name |
| `{sponsor_role}` | Client sponsor role |
| `{generated_date}` | Date the document was generated |

---

## RAID Log — `RAID Log.xlsx` (4 sheets)

Place the loop tags on the **first data row** of each sheet (the row directly below the header row).
The tagged row repeats once per item, then is removed from the template.

### Sheet: Actions
| Column | Placeholder |
|---|---|
| ID | `{#actions}{id}` |
| Description | `{description}` |
| Owner | `{owner}` |
| Due Date | `{due_date}` |
| Priority | `{priority}` |
| Status | `{status}{/actions}` |

Header cell example (A1): `{sheet_ref} — {project_name} — Actions`

### Sheet: Risks
| Column | Placeholder |
|---|---|
| ID | `{#risks}{id}` |
| Description | `{description}` |
| Likelihood | `{likelihood}` |
| Impact | `{impact}` |
| RAG | `{rag}` |
| Owner | `{owner}` |
| Mitigation | `{mitigation}` |
| Status | `{status}{/risks}` |

### Sheet: Assumptions
| Column | Placeholder |
|---|---|
| ID | `{#assumptions}{id}` |
| Description | `{description}` |
| Owner | `{owner}` |
| Date Logged | `{date_logged}` |
| Status | `{status}{/assumptions}` |

### Sheet: Issues / Dependencies
| Column | Placeholder |
|---|---|
| ID | `{#issues}{id}` |
| Description | `{description}` |
| Owner | `{owner}` |
| Date Raised | `{date_raised}` |
| Impact | `{impact}` |
| Status | `{status}{/issues}` |

---

## Risk Register — `Risk Register.xlsx`

Place the loop on the first data row below the header.

| Column | Placeholder |
|---|---|
| ID | `{#risks}{id}` |
| Category | `{category}` |
| Description | `{description}` |
| Likelihood | `{likelihood}` |
| Impact | `{impact}` |
| RAG Status | `{rag}` |
| Owner | `{owner}` |
| Mitigation | `{mitigation}` |
| Review Date | `{review_date}` |
| Status | `{status}{/risks}` |

Header cells (row 1):
- Project: `{project_name}`
- Client: `{client}`
- Date: `{generated_date}`

---

## Communications Plan — `Communications Plan.docx`

### Title / Cover section
```
{project_name}
Communications Plan
Client: {client}          Sheet Ref: {sheet_ref}
Start: {start_date}       End: {end_date}
Generated: {generated_date}
```

### Project Overview section
```
{summary}
```

### Sponsor
```
Sponsor: {sponsor_name} ({sponsor_role})
```

### Flipside Team table
Place `{#flipside_team}` on the first data row, `{/flipside_team}` at the end of the same row.

| Name | Role |
|---|---|
| `{#flipside_team}{name}` | `{role}{/flipside_team}` |

### Client Stakeholders table
| Name | Role |
|---|---|
| `{#client_team}{name}` | `{role}{/client_team}` |

### Billing / Project Milestones table
| Stage | % | Target Date |
|---|---|---|
| `{#milestones}{stage}` | `{percentage}%` | `{date}{/milestones}` |

### Communications Matrix table
| Audience | Key Message | Channel | Frequency | Owner | Notes |
|---|---|---|---|---|---|
| `{#comms}{audience}` | `{message}` | `{channel}` | `{frequency}` | `{owner}` | `{notes}{/comms}` |

---

## RACI — `RACI.xlsx`

> **Held — AI generation for now.**
> RACI columns are dynamic (one per team member) which makes placeholder loops awkward.
> Will be revisited once other templates are implemented.

---

## Kick Off Checklist (Website & App) — passthrough

> No placeholders needed. These files are included in the zip as-is.
> If you want to pre-fill the project header in future, add:
> `{project_name}` / `{client}` / `{start_date}` to the header row.

---

## Go Live Checklist (Website & App) — passthrough

> Same as Kick Off Checklist — no placeholders needed currently.

---

## Notes for template editors

1. **Placeholders are case-sensitive** — use exactly the names shown above (lowercase, underscores)
2. **Loop start and end must be on the same row** in Excel — `{#array}` in the first cell of the row, `{/array}` in the last cell of the same row
3. **Do not merge cells** on rows that contain loop tags — docxtemplater cannot repeat merged rows
4. **All other formatting** (colours, fonts, borders, column widths) is fully preserved — only the tagged cells are touched
5. **Shared header placeholders** (`{project_name}`, `{client}`, etc.) can go anywhere in the sheet — they are simple find-and-replace, not loops
