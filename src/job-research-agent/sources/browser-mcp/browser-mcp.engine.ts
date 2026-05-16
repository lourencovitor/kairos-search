import type { JobResearchConfig } from "../../config/job-research.config.js";
import type {
  JobSourceSummary,
  RawJobPosting,
} from "../../domain/job.types.js";
import type {
  JobSource,
  JobSourceFetchResult,
} from "../job-source.interface.js";
import { BrowserMcpClient } from "./browser-mcp.client.js";
import {
  BrowserMcpTraceWriter,
  type BrowserMcpTrace,
} from "./browser-mcp-trace.writer.js";
import {
  BROWSER_MCP_SITE_IDS,
  type BrowserMcpConfig,
  type BrowserMcpSiteId,
  type BrowserMcpTransport,
  type SiteAdapter,
  type SiteAdapterContext,
  type SiteAdapterResult,
  type SiteAdapterTraceEntry,
} from "./browser-mcp.types.js";

/**
 * Opções de construção da engine. Todas as dependências externas
 * (`transport`, `traceWriter`, `adapters`, `clock`) são injetáveis
 * para facilitar os testes unitários e evitar amarração a singletons.
 */
export interface BrowserMcpEngineOptions {
  transportFactory: () => BrowserMcpTransport;
  traceWriter: BrowserMcpTraceWriter;
  adaptersFactory: (config: BrowserMcpConfig) => SiteAdapter[];
  /**
   * Resolver opcional que devolve o diretório onde o trace deve ser persistido
   * (tipicamente `path.join(outputRootDir, "runs", runId)`). Se for omitido —
   * ou se retornar `null` — a engine não tenta escrever o trace no disco.
   */
  runDirectoryResolver?: (config: JobResearchConfig) => string | null;
  /** Clock injetável (default: `performance.now`). */
  now?: () => number;
}

function defaultNow(): number {
  return performance.now();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function syntheticTraceEntry(
  siteId: BrowserMcpSiteId,
  errorMsg: string,
  durationMs = 0,
): SiteAdapterTraceEntry {
  return {
    siteId,
    queriesExecuted: 0,
    pagesVisited: 0,
    jobsExtracted: 0,
    droppedJobs: 0,
    durationMs,
    errors: [errorMsg],
    warnings: [],
  };
}

function syntheticSummary(
  siteId: BrowserMcpSiteId,
  errorMsg: string,
): JobSourceSummary {
  return {
    source: "browser_mcp",
    label: `browser_mcp:${siteId}`,
    focus: "mixed",
    tier: "global_aggregator",
    fetchedJobs: 0,
    error: errorMsg,
  };
}

/**
 * Retorna os `BrowserMcpSiteId` habilitados via config, respeitando
 * a ordem canônica definida em `BROWSER_MCP_SITE_IDS`. Útil para emitir
 * summaries sintéticos quando o connect falha antes dos adapters rodarem.
 */
function enabledSiteIds(config: BrowserMcpConfig): BrowserMcpSiteId[] {
  return BROWSER_MCP_SITE_IDS.filter((id) => config.sites[id]?.enabled === true);
}

export class BrowserMcpEngine implements JobSource {
  readonly name = "browser_mcp" as const;

  private readonly transportFactory: () => BrowserMcpTransport;
  private readonly traceWriter: BrowserMcpTraceWriter;
  private readonly adaptersFactory: (config: BrowserMcpConfig) => SiteAdapter[];
  private readonly runDirectoryResolver?: (
    config: JobResearchConfig,
  ) => string | null;
  private readonly now: () => number;

  constructor(options: BrowserMcpEngineOptions) {
    this.transportFactory = options.transportFactory;
    this.traceWriter = options.traceWriter;
    this.adaptersFactory = options.adaptersFactory;
    this.runDirectoryResolver = options.runDirectoryResolver;
    this.now = options.now ?? defaultNow;
  }

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    const browserMcp = config.browserMcp;

    // Fast-path: engine desabilitada via config. Nenhum transport é
    // instanciado (Requirement 1.6, 13.3) e nenhum trace é persistido.
    if (!browserMcp.enabled) {
      return { jobs: [], summaries: [] };
    }

    const runId = this.buildRunId();
    const transport = this.transportFactory();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: browserMcp.connectTimeoutMs,
      globalPageBudget: browserMcp.globalMaxPages,
    });

    // AbortController compartilhado pelos adapters. SIGINT dispara abort
    // para qualquer adapter em execução; adapters ainda não iniciados
    // (em modo serial) são pulados explicitamente.
    const abortController = new AbortController();
    let abortedBySigint = false;
    const handleSigint = (): void => {
      abortedBySigint = true;
      console.log("[browser-mcp] SIGINT detected, aborting adapters");
      abortController.abort();
    };
    process.once("SIGINT", handleSigint);

    const jobs: RawJobPosting[] = [];
    const summaries: JobSourceSummary[] = [];
    const traceEntries: SiteAdapterTraceEntry[] = [];

    try {
      try {
        await client.connect();
        console.log("[browser-mcp] connected");
      } catch (error) {
        const message = `browser_mcp connect failed: ${errorMessage(error)}`;
        console.log(`[browser-mcp] ${message}`);
        const sites = enabledSiteIds(browserMcp);
        for (const siteId of sites) {
          summaries.push(syntheticSummary(siteId, message));
          traceEntries.push(syntheticTraceEntry(siteId, message));
        }
        await this.persistTrace(config, runId, browserMcp, traceEntries);
        return { jobs, summaries };
      }

      const adapters = this.adaptersFactory(browserMcp);
      const ctxBase = {
        client,
        signal: abortController.signal,
        now: () => new Date(),
      };

      if (browserMcp.parallelSites) {
        await this.runParallel(adapters, browserMcp, ctxBase, {
          jobs,
          summaries,
          traceEntries,
        });
      } else {
        await this.runSerial(adapters, browserMcp, ctxBase, {
          jobs,
          summaries,
          traceEntries,
          isAbortedBySigint: () => abortedBySigint,
        });
      }

      await this.persistTrace(config, runId, browserMcp, traceEntries);
      return { jobs, summaries };
    } finally {
      process.removeListener("SIGINT", handleSigint);
      await client.disconnect();
    }
  }

  /**
   * Gera o runId interno da engine como um timestamp ISO com `:` e `.`
   * substituídos por `-`, compatível com nomes de diretório. Pode diferir
   * do runId do pipeline — aceitável para V1 (task 3.9 faz a amarração).
   */
  private buildRunId(): string {
    return new Date().toISOString().replaceAll(/[:.]/g, "-");
  }

  private async runParallel(
    adapters: SiteAdapter[],
    browserMcp: BrowserMcpConfig,
    ctxBase: Omit<SiteAdapterContext, "siteConfig">,
    output: {
      jobs: RawJobPosting[];
      summaries: JobSourceSummary[];
      traceEntries: SiteAdapterTraceEntry[];
    },
  ): Promise<void> {
    const tasks = adapters.map(async (adapter) => {
      const started = this.now();
      // Each adapter gets its own transport+client for true parallelism
      const adapterTransport = this.transportFactory();
      const adapterClient = new BrowserMcpClient({
        transport: adapterTransport,
        connectTimeoutMs: browserMcp.connectTimeoutMs,
        globalPageBudget: browserMcp.globalMaxPages,
      });
      try {
        await adapterClient.connect();
      } catch (error) {
        const message = `browser_mcp connect failed: ${errorMessage(error)}`;
        console.log(`[browser-mcp] adapter connect failed siteId=${adapter.id}: ${message}`);
        await adapterClient.disconnect();
        return { adapter, error: new Error(message), durationMs: this.now() - started };
      }
      const ctx: SiteAdapterContext = {
        client: adapterClient,
        signal: ctxBase.signal,
        now: ctxBase.now,
        siteConfig: browserMcp.sites[adapter.id],
      };
      console.log(`[browser-mcp] adapter start siteId=${adapter.id}`);
      try {
        const result = await adapter.collect(ctx);
        const durationMs = Math.max(0, this.now() - started);
        console.log(
          `[browser-mcp] adapter finish siteId=${adapter.id} durationMs=${durationMs.toFixed(
            0,
          )} jobsExtracted=${result.trace.jobsExtracted}`,
        );
        return { adapter, result, durationMs };
      } catch (error) {
        const durationMs = Math.max(0, this.now() - started);
        const message = errorMessage(error);
        console.log(
          `[browser-mcp] adapter threw siteId=${adapter.id} durationMs=${durationMs.toFixed(
            0,
          )} error=${message}`,
        );
        return { adapter, error, durationMs };
      } finally {
        await adapterClient.disconnect();
      }
    });

    const settled = await Promise.allSettled(tasks);
    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        // Não deveria acontecer — o try/catch acima normaliza as rejections.
        // Defensivo: emite um summary mínimo para não perder observabilidade.
        const message = errorMessage(outcome.reason);
        console.log(`[browser-mcp] unexpected rejection: ${message}`);
        continue;
      }
      const value = outcome.value;
      if ("error" in value) {
        output.summaries.push(
          syntheticSummary(value.adapter.id, errorMessage(value.error)),
        );
        output.traceEntries.push(
          syntheticTraceEntry(
            value.adapter.id,
            errorMessage(value.error),
            value.durationMs,
          ),
        );
        continue;
      }
      this.mergeAdapterResult(value.result, value.durationMs, output);
    }
  }

  private async runSerial(
    adapters: SiteAdapter[],
    browserMcp: BrowserMcpConfig,
    ctxBase: Omit<SiteAdapterContext, "siteConfig">,
    output: {
      jobs: RawJobPosting[];
      summaries: JobSourceSummary[];
      traceEntries: SiteAdapterTraceEntry[];
      isAbortedBySigint: () => boolean;
    },
  ): Promise<void> {
    for (const adapter of adapters) {
      if (output.isAbortedBySigint()) {
        output.summaries.push(syntheticSummary(adapter.id, "aborted_sigint"));
        output.traceEntries.push(
          syntheticTraceEntry(adapter.id, "aborted_sigint"),
        );
        continue;
      }

      const started = this.now();
      const ctx: SiteAdapterContext = {
        ...ctxBase,
        siteConfig: browserMcp.sites[adapter.id],
      };
      console.log(`[browser-mcp] adapter start siteId=${adapter.id}`);
      try {
        const result = await adapter.collect(ctx);
        const durationMs = Math.max(0, this.now() - started);
        console.log(
          `[browser-mcp] adapter finish siteId=${adapter.id} durationMs=${durationMs.toFixed(
            0,
          )} jobsExtracted=${result.trace.jobsExtracted}`,
        );
        this.mergeAdapterResult(result, durationMs, output);
      } catch (error) {
        const durationMs = Math.max(0, this.now() - started);
        const message = errorMessage(error);
        console.log(
          `[browser-mcp] adapter threw siteId=${adapter.id} durationMs=${durationMs.toFixed(
            0,
          )} error=${message}`,
        );
        output.summaries.push(syntheticSummary(adapter.id, message));
        output.traceEntries.push(
          syntheticTraceEntry(adapter.id, message, durationMs),
        );
      }
    }
  }

  /**
   * Mescla o resultado de um adapter nas coleções agregadas. Se o trace
   * do adapter não veio preenchido por algum motivo (defesa em profundidade),
   * a engine sintetiza um a partir do duration medido.
   */
  private mergeAdapterResult(
    result: SiteAdapterResult,
    durationMs: number,
    output: {
      jobs: RawJobPosting[];
      summaries: JobSourceSummary[];
      traceEntries: SiteAdapterTraceEntry[];
    },
  ): void {
    for (const job of result.jobs) {
      output.jobs.push(job);
    }
    output.summaries.push(result.summary);

    if (result.trace) {
      output.traceEntries.push(result.trace);
    } else {
      // Caso teoricamente impossível, mas mantemos a granularidade por site.
      const fallbackSiteId = (result.summary.label.startsWith("browser_mcp:")
        ? result.summary.label.slice("browser_mcp:".length)
        : "") as BrowserMcpSiteId;
      output.traceEntries.push({
        siteId: fallbackSiteId,
        queriesExecuted: 0,
        pagesVisited: 0,
        jobsExtracted: result.jobs.length,
        droppedJobs: 0,
        durationMs,
        errors: [],
        warnings: ["missing_trace_from_adapter"],
      });
    }
  }

  private async persistTrace(
    config: JobResearchConfig,
    runId: string,
    browserMcp: BrowserMcpConfig,
    sites: SiteAdapterTraceEntry[],
  ): Promise<void> {
    if (!this.runDirectoryResolver) {
      return;
    }
    const runDirectory = this.runDirectoryResolver(config);
    if (!runDirectory) {
      return;
    }

    const trace: BrowserMcpTrace = {
      runId,
      generatedAt: new Date().toISOString(),
      config: {
        enabled: browserMcp.enabled,
        parallelSites: browserMcp.parallelSites,
        globalMaxPages: browserMcp.globalMaxPages,
      },
      sites,
    };

    try {
      await this.traceWriter.write(runDirectory, trace);
    } catch (error) {
      console.warn(
        `[browser-mcp] failed to persist trace: ${errorMessage(error)}`,
      );
    }
  }
}
