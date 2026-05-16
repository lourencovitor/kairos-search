import {
  ForbiddenSelectorError,
  GlobalPageBudgetExhaustedError,
  type BrowserMcpClientLike,
  type BrowserMcpSiteId,
  type BrowserMcpSnapshot,
  type BrowserMcpTransport,
} from "./browser-mcp.types.js";

/**
 * Lista negra de seletores que clicam em botões de "Apply"/"Candidatar-se".
 * O client se recusa a disparar `browser_click` para qualquer selector listado aqui
 * (ou que contenha as substrings de texto típicas), garantindo que nunca submetemos
 * candidaturas no nome do usuário.
 */
export const APPLY_BUTTON_SELECTOR_BLACKLIST: readonly string[] = [
  'button:has-text("Apply")',
  'button:has-text("Apply now")',
  'button:has-text("Candidatar-se")',
  'button:has-text("Candidatar")',
  'a[data-control-name="jobdetails_topcard_inapply"]',
  'a[data-control-name*="apply"]',
  'button[aria-label*="Apply"]',
  'button[aria-label*="Candidatar"]',
];

const FORBIDDEN_SUBSTRINGS: readonly string[] = [
  "Apply",
  "apply",
  "Candidatar",
  "candidatar",
];

export interface BrowserMcpClientOptions {
  transport: BrowserMcpTransport;
  connectTimeoutMs: number;
  globalPageBudget: number;
  /**
   * Injectable clock source for tests (defaults to performance.now in production).
   * Returns a monotonically increasing number in milliseconds.
   */
  now?: () => number;
  /**
   * Injectable sleep function for tests (defaults to real setTimeout).
   */
  sleep?: (ms: number) => Promise<void>;
}

function defaultNow(): number {
  return performance.now();
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlacklistedSelector(selector: string): boolean {
  if (APPLY_BUTTON_SELECTOR_BLACKLIST.includes(selector)) {
    return true;
  }
  for (const needle of FORBIDDEN_SUBSTRINGS) {
    if (selector.includes(needle)) {
      return true;
    }
  }
  return false;
}

export class BrowserMcpClient implements BrowserMcpClientLike {
  private readonly transport: BrowserMcpTransport;
  private readonly connectTimeoutMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly lastNavigationAt: Map<BrowserMcpSiteId, number> = new Map();

  private globalPageBudget: number;
  private connected = false;
  private disconnected = false;

  constructor(options: BrowserMcpClientOptions) {
    this.transport = options.transport;
    this.connectTimeoutMs = options.connectTimeoutMs;
    this.globalPageBudget = options.globalPageBudget;
    this.now = options.now ?? defaultNow;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const signal = AbortSignal.timeout(this.connectTimeoutMs);
    const timeoutPromise = new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => {
        reject(new Error(`browser_mcp connect timed out after ${this.connectTimeoutMs}ms`));
      });
    });

    const probePromise = this.transport.invoke<BrowserMcpSnapshot>("browser_snapshot", {
      url: "about:blank",
    });

    await Promise.race([probePromise, timeoutPromise]);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.disconnected) {
      return;
    }
    this.disconnected = true;
    try {
      await this.transport.close();
    } catch (error) {
      // Idempotente e silencioso: disconnect é chamado em `finally`,
      // e não queremos que erros de fechamento cascateiem por cima de falhas reais.
      console.warn(
        `[browser-mcp] transport.close() falhou (ignorado): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async navigate(siteId: BrowserMcpSiteId, url: string, rateLimitMs: number): Promise<void> {
    if (this.globalPageBudget <= 0) {
      throw new GlobalPageBudgetExhaustedError();
    }

    // Decrementa ANTES da chamada ao transport para que checks concorrentes
    // enxerguem o valor atualizado e não ultrapassem o budget global.
    this.globalPageBudget -= 1;

    const lastAt = this.lastNavigationAt.get(siteId);
    if (lastAt !== undefined) {
      const elapsed = this.now() - lastAt;
      if (elapsed < rateLimitMs) {
        await this.sleep(rateLimitMs - elapsed);
      }
    }

    await this.transport.invoke("browser_navigate", { url });
    this.lastNavigationAt.set(siteId, this.now());
  }

  async snapshot(): Promise<BrowserMcpSnapshot> {
    return this.transport.invoke<BrowserMcpSnapshot>("browser_snapshot", {});
  }

  async click(selector: string): Promise<void> {
    if (isBlacklistedSelector(selector)) {
      throw new ForbiddenSelectorError(selector);
    }
    await this.transport.invoke("browser_click", { selector });
  }

  async type(selector: string, text: string): Promise<void> {
    await this.transport.invoke("browser_type", { selector, text });
  }

  remainingPageBudget(): number {
    return this.globalPageBudget;
  }
}
