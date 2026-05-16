import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { BrowserMcpToolName, BrowserMcpTransport } from "./browser-mcp.types.js";

export interface RealBrowserMcpTransportOptions {
  /** Run headless. Defaults to true. */
  headless?: boolean;
}

// Shared browser instance across all transports (avoids launching multiple browsers)
let sharedBrowser: Browser | null = null;
let sharedContext: BrowserContext | null = null;
let activeTransports = 0;

async function getSharedContext(headless: boolean): Promise<BrowserContext> {
  if (!sharedContext || !sharedBrowser?.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
    sharedContext = await sharedBrowser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    await sharedContext.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
  }
  return sharedContext;
}

/**
 * Playwright-based transport. Each instance gets its own page (tab) within
 * a shared browser, enabling true parallelism across adapters.
 */
export function createRealBrowserMcpTransport(
  options?: RealBrowserMcpTransportOptions,
): BrowserMcpTransport {
  const headless = options?.headless ?? true;
  let page: Page | null = null;

  activeTransports++;

  return {
    async invoke<T = unknown>(tool: BrowserMcpToolName, args: Record<string, unknown>): Promise<T> {
      if (!page || page.isClosed()) {
        const ctx = await getSharedContext(headless);
        page = await ctx.newPage();
      }

      switch (tool) {
        case "browser_navigate": {
          const url = args.url as string;
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
          await page.waitForTimeout(1500);
          return undefined as unknown as T;
        }

        case "browser_snapshot": {
          const html = await page.content();
          return {
            url: page.url(),
            title: await page.title(),
            domHtml: html,
          } as unknown as T;
        }

        case "browser_click": {
          const selector = args.selector as string;
          await page.locator(selector).first().click({ timeout: 10_000 });
          return undefined as unknown as T;
        }

        case "browser_type": {
          const selector = args.selector as string;
          const text = args.text as string;
          await page.locator(selector).first().fill(text, { timeout: 10_000 });
          return undefined as unknown as T;
        }

        case "browser_screenshot": {
          const buf = await page.screenshot({ type: "png" });
          return { data: buf.toString("base64") } as unknown as T;
        }

        case "browser_get_console_logs": {
          return [] as unknown as T;
        }

        default:
          throw new Error(`Unknown tool: ${tool}`);
      }
    },

    async close(): Promise<void> {
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
        page = null;
      }
      activeTransports--;
      // Close shared browser when last transport closes
      if (activeTransports <= 0 && sharedBrowser) {
        await sharedBrowser.close().catch(() => {});
        sharedBrowser = null;
        sharedContext = null;
        activeTransports = 0;
      }
    },
  };
}
