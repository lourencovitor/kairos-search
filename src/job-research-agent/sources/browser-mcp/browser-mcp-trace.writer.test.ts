import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BrowserMcpTraceWriter,
  redactTraceForPersistence,
  type BrowserMcpTrace,
} from "./browser-mcp-trace.writer.js";
import type { SiteAdapterTraceEntry } from "./browser-mcp.types.js";

function baseSite(
  overrides: Partial<SiteAdapterTraceEntry> = {},
): SiteAdapterTraceEntry {
  return {
    siteId: "linkedin",
    queriesExecuted: 0,
    pagesVisited: 0,
    jobsExtracted: 0,
    droppedJobs: 0,
    durationMs: 0,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

function baseTrace(overrides: Partial<BrowserMcpTrace> = {}): BrowserMcpTrace {
  return {
    runId: "2026-05-05T15-10-29-455Z",
    generatedAt: "2026-05-05T15:10:29.455Z",
    config: {
      enabled: true,
      parallelSites: false,
      globalMaxPages: 60,
    },
    sites: [baseSite()],
    ...overrides,
  };
}

describe("BrowserMcpTraceWriter", () => {
  let runDirectory: string;
  const writer = new BrowserMcpTraceWriter();

  beforeEach(() => {
    runDirectory = mkdtempSync(path.join(tmpdir(), "browser-mcp-trace-"));
  });

  afterEach(() => {
    rmSync(runDirectory, { recursive: true, force: true });
  });

  it("redige tokens em URLs dentro de sites[*].errors preservando parâmetros não sensíveis", async () => {
    const trace = baseTrace({
      sites: [
        baseSite({
          errors: [
            "failed at https://linkedin.com/jobs?jwt=abc123&access_token=xyz&keep=ok",
          ],
        }),
      ],
    });

    const returnedPath = await writer.write(runDirectory, trace);
    const content = readFileSync(returnedPath, "utf8");

    expect(content).toContain("jwt=REDACTED");
    expect(content).toContain("access_token=REDACTED");
    expect(content).toContain("keep=ok");
    expect(content).not.toContain("abc123");
    expect(content).not.toContain("xyz");
  });

  it("mantém strings inalteradas quando não há parâmetros sensíveis", async () => {
    const trace = baseTrace({
      sites: [
        baseSite({
          errors: ["plain error without tokens"],
          warnings: ["https://programathor.com.br/jobs?page=2"],
        }),
      ],
    });

    const returnedPath = await writer.write(runDirectory, trace);
    const parsed = JSON.parse(readFileSync(returnedPath, "utf8")) as BrowserMcpTrace;

    expect(parsed.sites[0]?.errors).toStrictEqual(["plain error without tokens"]);
    expect(parsed.sites[0]?.warnings).toStrictEqual([
      "https://programathor.com.br/jobs?page=2",
    ]);
  });

  it("produz JSON válido no arquivo escrito", async () => {
    const trace = baseTrace();
    const returnedPath = await writer.write(runDirectory, trace);

    expect(() => JSON.parse(readFileSync(returnedPath, "utf8"))).not.toThrow();
  });

  it("omite campos cookies e headers em qualquer profundidade do objeto", async () => {
    const trace = baseTrace({
      sites: [
        baseSite({
          // Nota: `metadata` não está no tipo SiteAdapterTraceEntry, mas queremos
          // garantir que mesmo que um adapter injete essas chaves por engano,
          // elas nunca vão parar no disco. Cast para `unknown` antes para evitar
          // erro de tipo sem desabilitar o strict-mode global.
          ...({
            metadata: {
              headers: { Authorization: "Bearer secret-value" },
            },
          } as unknown as Partial<SiteAdapterTraceEntry>),
        }),
      ],
      metadata: {
        warnings: ["ok"],
        // Mesmo caso: forçamos um campo proibido para validar a redação.
        ...({ cookies: ["abc"] } as unknown as Record<string, unknown>),
      },
    });

    const returnedPath = await writer.write(runDirectory, trace);
    const content = readFileSync(returnedPath, "utf8");

    expect(content).not.toContain("cookies");
    expect(content).not.toContain("headers");
    expect(content).not.toContain("Authorization");
    expect(content).not.toContain("Bearer");
    expect(content).not.toContain("secret-value");
    expect(content).not.toContain("abc");

    const parsed = JSON.parse(content) as BrowserMcpTrace;
    expect(parsed.sites[0]?.siteId).toBe("linkedin");
    expect(parsed.metadata?.warnings).toStrictEqual(["ok"]);
  });

  it("redige warnings do mesmo jeito que errors", async () => {
    const trace = baseTrace({
      sites: [
        baseSite({
          warnings: [
            "slow nav https://linkedin.com/jobs?session_key=secret&keep=ok",
          ],
        }),
      ],
    });

    const returnedPath = await writer.write(runDirectory, trace);
    const parsed = JSON.parse(readFileSync(returnedPath, "utf8")) as BrowserMcpTrace;

    const warning = parsed.sites[0]?.warnings[0];
    expect(warning).toContain("session_key=REDACTED");
    expect(warning).toContain("keep=ok");
    expect(warning).not.toContain("secret");
  });

  it("retorna o path absoluto <runDirectory>/browser-mcp-trace.json", async () => {
    const trace = baseTrace();
    const returnedPath = await writer.write(runDirectory, trace);

    expect(returnedPath).toBe(path.join(runDirectory, "browser-mcp-trace.json"));
  });
});

describe("redactTraceForPersistence", () => {
  it("redige authorization e csrf-token em strings aninhadas", () => {
    const input = {
      sites: [
        {
          errors: [
            "see https://example.com/x?authorization=tok1&csrf-token=tok2&keep=1",
          ],
        },
      ],
    };

    const output = redactTraceForPersistence(input) as typeof input;
    const redacted = output.sites[0]?.errors[0] ?? "";

    expect(redacted).toContain("authorization=REDACTED");
    expect(redacted).toContain("csrf-token=REDACTED");
    expect(redacted).toContain("keep=1");
    expect(redacted).not.toContain("tok1");
    expect(redacted).not.toContain("tok2");
  });

  it("remove chaves proibidas em qualquer profundidade", () => {
    const input = {
      sites: [
        {
          siteId: "linkedin",
          headers: { Authorization: "Bearer xxx" },
          nested: { cookies: ["a", "b"], ok: true },
        },
      ],
      Cookie: "session=xxx",
    };

    const output = redactTraceForPersistence(input) as Record<string, unknown>;
    const serialized = JSON.stringify(output);

    expect(serialized).not.toContain("headers");
    expect(serialized).not.toContain("cookies");
    expect(serialized).not.toContain("Cookie");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).toContain("\"ok\":true");
  });
});
