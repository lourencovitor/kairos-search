# Job Research Agent MVP

This repository contains a practical MVP for a `Job Research Agent` focused on finding strong software engineering opportunities across multiple seniority levels for candidates based in Brazil/LATAM.

## What it does

- Pulls jobs from safe public sources instead of aggressive scraping.
- Prioritizes Brazil-first sources before global fallback sources.
- Supports direct company boards via `Greenhouse` and `Lever`.
- Supports Brazil/LATAM public APIs via `Himalayas` and `Get on Board`.
- Supports remote aggregators via `Remotive` and `RemoteOK`.
- Normalizes job data into a shared model.
- Filters for relevant engineering roles from Junior through Architect.
- Scores and ranks opportunities with Brazil-first heuristics.
- Deduplicates overlapping listings across sources.
- Generates Markdown and CSV reports with grouped seniority and role-category views.
- Supports manual intake files for high-priority platforms like `LinkedIn`, `Indeed`, and `Wellfound` without scraping them directly.

## Current prioritization strategy

The current strategy is Brazil-first:

- The final report tries to allocate `80%` of slots to `Brazil`, `Brazil-friendly`, or `LATAM` jobs.
- The remaining `20%` can be filled with international jobs.
- If there are not enough strong Brazil-priority jobs in the current source mix, the report fills the shortfall with the best international jobs and states that in the summary.
- The default report size is now `Top 100` selected opportunities.

Each ranked job is classified into one of these markets:

- `brazil`
- `brazil_friendly`
- `latam`
- `international`
- `unclear`

## Sources used in the MVP

- Manual JSON intake under `data/manual-inputs/`
- `Himalayas` public jobs API with Brazil-targeted searches
- `Get on Board` public jobs API with Brazil-targeted searches
- `Greenhouse` public job board API
- `Lever` public postings API
- `Remotive` public jobs API
- `RemoteOK` public API
- Manual curated intake for `LinkedIn`, `Indeed`, and `Wellfound`

The source mix is intentionally split into tiers:

- `manual_curated` for first-class human-curated jobs
- `brazil_public_api` for Brazil/LATAM-friendly APIs
- `direct_company_board` for public ATS boards
- `global_aggregator` as fallback inventory

## Quick start

```bash
pnpm install
pnpm job-research
```

Generated outputs are written to:

- `data/job-research/runs/<timestamp>/`
- `data/job-research/latest/`

The generated report artifacts include:

- `report.md` for team sharing, grouped by seniority and role category
- `report.csv` for Google Sheets import
- `summary.json` with source counts and selection-mix metadata

## Manual curated intake

Scraping for `LinkedIn`, `Indeed`, and `Wellfound` is intentionally not implemented.

If you want to include curated jobs from `LinkedIn`, `Indeed`, `Wellfound`, email alerts, recruiter messages, or manually reviewed company pages, copy one of these example files and add structured entries:

- `data/manual-inputs/brazil-jobs.example.json`
- `data/manual-inputs/linkedin-jobs.example.json`
- `data/manual-inputs/indeed-jobs.example.json`
- `data/manual-inputs/wellfound-jobs.example.json`

The agent will read any `.json` file in `data/manual-inputs/` except files ending in `.example.json`.

The manual format supports file-level `defaults` plus per-job overrides for:

- `source`, `sourceFocus`, `sourceTier`, `sourceQualityRank`
- `marketHint`, `remotePolicyHint`
- `regionHints`, `restrictionHints`
- `notes`, `tags`, and arbitrary `metadata`

This makes manual Brazil curation first-class instead of a generic fallback.

The default ranking now also gives explicit preference to these platforms:

- `LinkedIn`
- `Indeed`
- `Wellfound`
- `RemoteOK`

## Brazil-first sourcing configuration

The default configuration now includes Brazil-targeted search queries for:

- `Himalayas` via `config.himalayas`
- `Get on Board` via `config.getOnBoard`

Those sections let you tune:

- `enabled`
- `searchQueries`
- `maxPagesPerQuery`
- `country` or `countryCode`
- `lang` and `perPage` for `Get on Board`

## Default targets

The default configuration prioritizes these role families:

- Junior Software Engineer
- Mid-level Software Engineer
- Software Engineer
- Senior Software Engineer
- Staff Software Engineer
- Principal Software Engineer
- Tech Lead
- Software Architect
- Solutions Architect
- Cloud Architect

It also prefers:

- Remote-compatible roles
- Brazil/LATAM or worldwide eligibility
- Jobs discovered on `LinkedIn`, `Indeed`, `Wellfound`, and `RemoteOK`
- Brazil-first public APIs and manual curated entries
- Direct company board sources
- Recent postings
- Strong matches for `AWS`, `Terraform`, `JavaScript`, `TypeScript`, `NestJS`, `React`, `Postgres`, `Redis`, `Microservices`, and `Micro frontends`
- A Top 100 shortlist with the international fallback still capped by the Brazil-first ratio

## Project structure

```txt
src/
  job-research-agent/
    index.ts
    domain/
    sources/
    skills/
    report/
    config/
    storage/
    cli/
```

## Notes

- This MVP is intentionally file-based and does not use a database.
- Seed Greenhouse and Lever boards are configurable in `src/job-research-agent/config/job-research.config.ts`.
- The Brazil-first shortlist ratio is configurable via `brazilPrioritySelectionRatio` in `src/job-research-agent/config/job-research.config.ts`.
- Brazil-targeted API source settings live in `himalayas` and `getOnBoard` in `src/job-research-agent/config/job-research.config.ts`.
- The CLI supports `--top=`, `--min-score=`, `--output-dir=`, and `--manual-input-dir=`.
- Reports are designed to be readable first and easy to ingest later, with grouping by seniority and role category.

## Browser MCP Engine

The **Browser MCP Engine** is an opt-in complementary job source that uses the [browsermcp.io](https://browsermcp.io/) MCP server to drive your local browser (with already-authenticated sessions) and collect job postings from sites where direct HTTP scraping is fragile, blocked, or against Terms of Service.

It does **not** replace the existing HTTP/API pipeline — it is an additional source that feeds into the same normalize → filter → rank → dedup → select → report pipeline.

### Enabling

The engine is **disabled by default**. To enable it:

1. Set `browserMcp.enabled = true` in `src/job-research-agent/config/job-research.config.ts`.
2. Enable individual sites via `browserMcp.sites.<id>.enabled = true`.

Both conditions must be true for a site to be scraped. This double opt-in ensures the pipeline continues working exactly as before without any new external dependencies.

### CLI Flags

| Flag | Effect |
| --- | --- |
| `--browser-mcp` | Forces `browserMcp.enabled = true` for this run |
| `--no-browser-mcp` | Forces `browserMcp.enabled = false` for this run |
| `--browser-mcp-only` | Disables all HTTP sources, runs only the Browser MCP Engine |
| `--browser-mcp-site=<id>` | Enables only the specified site adapter(s); repeatable |

Passing `--browser-mcp` and `--no-browser-mcp` together is an error (exit code 1).

### Supported Sites (9)

| Site ID | Focus | Description |
| --- | --- | --- |
| `linkedin` | Global | LinkedIn Jobs (authenticated session) |
| `programathor` | Brazil | ProgramaThor job board |
| `glassdoor` | Global | Glassdoor job listings |
| `vagas_com` | Brazil | Vagas.com.br |
| `catho` | Brazil | Catho |
| `infojobs_br` | Brazil | InfoJobs Brasil |
| `gupy_public` | Brazil | Gupy public job pages |
| `trampos_co` | Brazil | Trampos.co |
| `revelo` | Brazil | Revelo |

Each site adapter can be configured independently with `searchQueries`, `maxPagesPerQuery`, `rateLimitMs`, `maxJobs`, and `location`.

### Security Guarantees

- **No auto-apply**: The engine never clicks "Apply", "Candidatar-se", or any write-action button on any site. A selector blacklist enforces this at the client level.
- **No credential storage**: The engine does not read, store, or request login credentials. It relies entirely on the user's already-authenticated browser session via the Browser MCP bridge.
- **No data leak**: No repository code, history, or local files outside `data/job-research/` are sent to external endpoints. Communication is limited to the Browser MCP Server and the navigated sites.
- **Rate limiting**: Each site respects a configurable `rateLimitMs` (default 4000ms) between navigations, plus a global page budget (`globalMaxPages`, default 60).
- **Trace redaction**: Sensitive tokens (`jwt`, `access_token`, `csrf-token`) are redacted from URLs before being persisted in the trace file.

## Seniority Report Groups V2

The report pipeline groups jobs into **7 seniority/category groups** for CSV output and the Markdown report. Each job is assigned to exactly one group.

### Groups

| Group | Label | CSV File |
| --- | --- | --- |
| `junior` | Junior | `report-junior.csv` |
| `pleno` | Pleno | `report-pleno.csv` |
| `senior` | Senior | `report-senior.csv` |
| `staff` | Staff | `report-staff.csv` |
| `arq` | Arq | `report-arq.csv` |
| `qa` | QA | `report-qa.csv` |
| `devops` | DevOps | `report-devops.csv` |

### Precedence Order

The classification function `toSeniorityReportGroupV2` applies rules in this precedence:

```text
devops → arq → qa → junior → pleno → senior → staff
```

This means:

- A "Junior DevOps Engineer" goes into `devops` (not `junior`), because `devops` has higher precedence.
- A "Senior Solutions Architect" goes into `arq` (not `senior`).
- A "QA Engineer" goes into `qa` regardless of seniority level.
- Jobs with `seniority = "unknown"` and no matching role category fall into an internal `other` bucket (not exported as CSV).

### Mapping Rules

| Condition | Group |
| --- | --- |
| `roleCategory === "devops"` | `devops` |
| `roleCategory ∈ {software_architecture, solutions_architecture, cloud_architecture}` OR `seniority === "architect"` | `arq` |
| `roleCategory === "qa"` | `qa` |
| `seniority === "junior"` | `junior` |
| `seniority === "mid_level"` | `pleno` |
| `seniority === "senior"` OR `seniority === "lead"` | `senior` |
| `seniority ∈ {staff, principal, staff_or_principal}` | `staff` |
| None of the above | `other` |

Each group targets up to 50 jobs (configurable via `seniorityReportTargetJobs` or per-group via `seniorityReportTargetJobsByGroup`).

## Browser MCP Trace Format

When the Browser MCP Engine runs (`browserMcp.enabled = true`), it writes a trace file at:

```text
data/job-research/runs/<timestamp>/browser-mcp-trace.json
```

This file provides observability into what the engine did during the run. All sensitive tokens in URLs are redacted before writing.

### Example (redacted)

```json
{
  "generatedAt": "2026-05-10T18:42:11.003Z",
  "config": {
    "enabled": true,
    "parallelSites": false,
    "globalMaxPages": 60
  },
  "sites": [
    {
      "siteId": "linkedin",
      "queriesExecuted": 13,
      "pagesVisited": 3,
      "jobsExtracted": 42,
      "droppedJobs": 2,
      "durationMs": 118000,
      "errors": [],
      "warnings": []
    },
    {
      "siteId": "programathor",
      "queriesExecuted": 2,
      "pagesVisited": 5,
      "jobsExtracted": 28,
      "droppedJobs": 0,
      "durationMs": 45000,
      "errors": [],
      "warnings": []
    },
    {
      "siteId": "glassdoor",
      "queriesExecuted": 0,
      "pagesVisited": 1,
      "jobsExtracted": 0,
      "droppedJobs": 0,
      "durationMs": 3200,
      "errors": ["requires_manual_login"],
      "warnings": []
    }
  ]
}
```

### Fields

| Field | Description |
| --- | --- |
| `generatedAt` | ISO 8601 timestamp of when the trace was written |
| `config.enabled` | Whether the engine was enabled |
| `config.parallelSites` | Whether parallel site execution was active |
| `config.globalMaxPages` | Global page budget for the run |
| `sites[].siteId` | Identifier of the site adapter |
| `sites[].queriesExecuted` | Number of search queries run on this site |
| `sites[].pagesVisited` | Number of pages navigated |
| `sites[].jobsExtracted` | Number of valid jobs extracted |
| `sites[].droppedJobs` | Jobs discarded (missing required fields) |
| `sites[].durationMs` | Total time spent on this site in milliseconds |
| `sites[].errors` | Error codes (e.g. `requires_manual_login`, `rate_limited_or_captcha`, `skipped_global_limit`) |
| `sites[].warnings` | Warnings (e.g. `extraction_zero_results` when layout may have changed) |

The trace file is **not written** when `browserMcp.enabled = false` (the `browserMcpTracePath` output is `null`).
