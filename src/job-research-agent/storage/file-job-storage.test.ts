import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type {
  JobOpportunity,
  JobSelectionSummary,
} from "../domain/job.types.js";
import { FileJobStorage, type PersistedRunArtifacts } from "./file-job-storage.js";

// Helpers de fixture — mantemos inputs mínimos; o foco dos testes é o
// comportamento de escrita em disco (filenames + browser-mcp-trace).

function buildSelectionSummary(): JobSelectionSummary {
  return {
    limit: 10,
    minScore: 0,
    desiredPrimaryJobs: 0,
    desiredInternationalJobs: 0,
    usedThresholdFallback: false,
    selectedPrimaryJobs: 0,
    selectedSecondaryJobs: 0,
    selectedWorldwideCompatiblePrimaryJobs: 0,
    filledFromSecondaryBecausePrimaryShortfall: 0,
    marketCounts: {
      brazil: 0,
      brazil_friendly: 0,
      latam: 0,
      international: 0,
      unclear: 0,
    },
  };
}

function buildArtifacts(
  overrides: Partial<PersistedRunArtifacts> = {},
): PersistedRunArtifacts {
  const empty: JobOpportunity[] = [];

  return {
    runId: "2026-05-05T15-00-00-000Z",
    generatedAt: "2026-05-05T15:00:00.000Z",
    totalRawJobs: 0,
    selectionSummary: buildSelectionSummary(),
    rawJobs: [],
    rankedJobs: empty,
    selectedJobs: empty,
    rejectedJobs: empty,
    sourceSummaries: [],
    markdownReport: "# report",
    csvReport: "rank,company,title\n",
    csvReportsBySeniority: {
      junior: null,
      pleno: null,
      senior: null,
      staff: null,
      arq: null,
      qa: null,
      devops: null,
      management: null,
    },
    ...overrides,
  };
}

function makeStorage(): { storage: FileJobStorage; outputRootDir: string } {
  const outputRootDir = mkdtempSync(path.join(tmpdir(), "file-job-storage-test-"));
  return { storage: new FileJobStorage(outputRootDir), outputRootDir };
}

const OLD_FILENAMES = [
  "report-mid-level.csv",
  "report-senior-plus.csv",
  "report-tech-lead.csv",
  "report-architect.csv",
] as const;

const NEW_FILENAMES = [
  "report-junior.csv",
  "report-pleno.csv",
  "report-senior.csv",
  "report-staff.csv",
  "report-arq.csv",
  "report-qa.csv",
  "report-devops.csv",
  "report-management.csv",
] as const;

describe("FileJobStorage.saveRun — CSV per-group V2 wiring", () => {
  it("grava exatamente 8 CSVs por grupo em runDirectory e latestDirectory quando todos os grupos têm conteúdo", async () => {
    const { storage } = makeStorage();

    const artifacts = buildArtifacts({
      csvReportsBySeniority: {
        junior: "rank,company\n1,J\n",
        pleno: "rank,company\n1,P\n",
        senior: "rank,company\n1,S\n",
        staff: "rank,company\n1,St\n",
        arq: "rank,company\n1,A\n",
        qa: "rank,company\n1,Q\n",
        devops: "rank,company\n1,D\n",
        management: "rank,company\n1,M\n",
      },
    });

    const output = await storage.saveRun(artifacts);

    for (const filename of NEW_FILENAMES) {
      expect(readdirSync(output.runDirectory)).toContain(filename);
      expect(readdirSync(output.latestDirectory)).toContain(filename);
    }

    // Todos os 8 paths retornados apontam para o runDirectory
    expect(output.csvReportBySeniorityPaths).toStrictEqual({
      junior: path.join(output.runDirectory, "report-junior.csv"),
      pleno: path.join(output.runDirectory, "report-pleno.csv"),
      senior: path.join(output.runDirectory, "report-senior.csv"),
      staff: path.join(output.runDirectory, "report-staff.csv"),
      arq: path.join(output.runDirectory, "report-arq.csv"),
      qa: path.join(output.runDirectory, "report-qa.csv"),
      devops: path.join(output.runDirectory, "report-devops.csv"),
      management: path.join(output.runDirectory, "report-management.csv"),
    });
  });

  it("não grava arquivo para grupo cujo conteúdo é null", async () => {
    const { storage } = makeStorage();

    const artifacts = buildArtifacts({
      csvReportsBySeniority: {
        junior: "rank,company\n1,J\n",
        pleno: null,
        senior: "rank,company\n1,S\n",
        staff: null,
        arq: null,
        qa: "rank,company\n1,Q\n",
        devops: null,
        management: null,
      },
    });

    const output = await storage.saveRun(artifacts);

    const runEntries = readdirSync(output.runDirectory);
    const latestEntries = readdirSync(output.latestDirectory);

    expect(runEntries).toContain("report-junior.csv");
    expect(runEntries).toContain("report-senior.csv");
    expect(runEntries).toContain("report-qa.csv");

    expect(runEntries).not.toContain("report-pleno.csv");
    expect(runEntries).not.toContain("report-staff.csv");
    expect(runEntries).not.toContain("report-arq.csv");
    expect(runEntries).not.toContain("report-devops.csv");

    expect(latestEntries).toContain("report-junior.csv");
    expect(latestEntries).toContain("report-senior.csv");
    expect(latestEntries).toContain("report-qa.csv");
    expect(latestEntries).not.toContain("report-pleno.csv");

    expect(output.csvReportBySeniorityPaths.pleno).toBeNull();
    expect(output.csvReportBySeniorityPaths.staff).toBeNull();
    expect(output.csvReportBySeniorityPaths.arq).toBeNull();
    expect(output.csvReportBySeniorityPaths.devops).toBeNull();
    expect(output.csvReportBySeniorityPaths.junior).toBe(
      path.join(output.runDirectory, "report-junior.csv"),
    );
  });

  it("nunca escreve nenhum dos 4 filenames V1 antigos em runDirectory nem em latestDirectory", async () => {
    const { storage } = makeStorage();

    const artifacts = buildArtifacts({
      csvReportsBySeniority: {
        junior: "rank\n1\n",
        pleno: "rank\n1\n",
        senior: "rank\n1\n",
        staff: "rank\n1\n",
        arq: "rank\n1\n",
        qa: "rank\n1\n",
        devops: "rank\n1\n",
        management: "rank\n1\n",
      },
    });

    const output = await storage.saveRun(artifacts);

    const runEntries = readdirSync(output.runDirectory);
    const latestEntries = readdirSync(output.latestDirectory);

    for (const legacy of OLD_FILENAMES) {
      expect(runEntries).not.toContain(legacy);
      expect(latestEntries).not.toContain(legacy);
    }
  });
});

describe("FileJobStorage.saveRun — browserMcpTracePath", () => {
  it("escreve browser-mcp-trace.json e retorna o path quando browserMcpTrace é fornecido", async () => {
    const { storage } = makeStorage();

    const trace = {
      runId: "2026-05-05T15-00-00-000Z",
      generatedAt: "2026-05-05T15:00:00.000Z",
      config: { enabled: true, parallelSites: false, globalMaxPages: 60 },
      sites: [],
    };

    const output = await storage.saveRun(buildArtifacts(), { browserMcpTrace: trace });

    const expectedPath = path.join(output.runDirectory, "browser-mcp-trace.json");
    expect(output.browserMcpTracePath).toBe(expectedPath);

    const written = readFileSync(expectedPath, "utf8");
    expect(JSON.parse(written)).toStrictEqual(trace);
  });

  it("retorna browserMcpTracePath null quando nenhum trace é fornecido", async () => {
    const { storage } = makeStorage();

    const output = await storage.saveRun(buildArtifacts());

    expect(output.browserMcpTracePath).toBeNull();
    expect(readdirSync(output.runDirectory)).not.toContain("browser-mcp-trace.json");
  });
});
