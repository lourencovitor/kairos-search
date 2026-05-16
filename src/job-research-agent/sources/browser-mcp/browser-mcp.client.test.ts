import { describe, expect, it, vi } from "vitest";

import {
  APPLY_BUTTON_SELECTOR_BLACKLIST,
  BrowserMcpClient,
} from "./browser-mcp.client.js";
import {
  ForbiddenSelectorError,
  GlobalPageBudgetExhaustedError,
  type BrowserMcpTransport,
} from "./browser-mcp.types.js";

function buildMockTransport(overrides: Partial<BrowserMcpTransport> = {}): BrowserMcpTransport {
  return {
    invoke: vi.fn(async () => ({
      url: "about:blank",
      title: "blank",
      domHtml: "",
    })) as unknown as BrowserMcpTransport["invoke"],
    close: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("BrowserMcpClient.connect", () => {
  it("rejeita quando o probe browser_snapshot não resolve dentro do timeout", async () => {
    // Transport com invoke que nunca resolve — força o AbortSignal.timeout a ganhar a corrida.
    const transport = buildMockTransport({
      invoke: vi.fn(() => new Promise(() => {})) as unknown as BrowserMcpTransport["invoke"],
    });

    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 50,
      globalPageBudget: 10,
    });

    const started = Date.now();
    await expect(client.connect()).rejects.toThrow(/connect timed out/i);
    const elapsed = Date.now() - started;
    // Sanity: o timeout foi respeitado (≥ ~40ms com alguma folga).
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it("é idempotente: duas chamadas seguidas invocam o probe apenas uma vez", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    await client.connect();
    await client.connect();

    expect(transport.invoke).toHaveBeenCalledTimes(1);
    expect(transport.invoke).toHaveBeenCalledWith("browser_snapshot", { url: "about:blank" });
  });
});

describe("BrowserMcpClient.disconnect", () => {
  it("é idempotente e fecha o transport no máximo uma vez", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    await expect(client.disconnect()).resolves.toBeUndefined();
    await expect(client.disconnect()).resolves.toBeUndefined();

    expect(transport.close).toHaveBeenCalledTimes(1);
  });

  it("não propaga erros de close (log-and-swallow)", async () => {
    const transport = buildMockTransport({
      close: vi.fn(async () => {
        throw new Error("transport closed unexpectedly");
      }),
    });
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    await expect(client.disconnect()).resolves.toBeUndefined();
  });
});

describe("BrowserMcpClient.navigate", () => {
  it("aguarda o delta restante do rateLimitMs entre navegações no mesmo site", async () => {
    let fakeNow = 1_000;
    const nowMock = vi.fn(() => fakeNow);
    const sleepMock = vi.fn(async () => {});

    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
      now: nowMock,
      sleep: sleepMock,
    });

    // Primeira navegação: sem last-nav → não deve haver sleep.
    await client.navigate("linkedin", "https://linkedin.com/jobs?x=1", 1_000);
    expect(sleepMock).not.toHaveBeenCalled();

    // Avança o relógio apenas 200ms — abaixo do rateLimitMs de 1000.
    fakeNow += 200;

    await client.navigate("linkedin", "https://linkedin.com/jobs?x=2", 1_000);

    expect(sleepMock).toHaveBeenCalledTimes(1);
    const firstCall = sleepMock.mock.calls[0] as unknown as [number];
    const [sleptMs] = firstCall;
    expect(sleptMs).toBeGreaterThanOrEqual(800);
    expect(sleptMs).toBeLessThanOrEqual(1_000);
  });

  it("não espera quando o delta já passou do rateLimitMs", async () => {
    let fakeNow = 0;
    const sleepMock = vi.fn(async () => {});
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
      now: () => fakeNow,
      sleep: sleepMock,
    });

    await client.navigate("linkedin", "https://linkedin.com/a", 500);
    fakeNow = 5_000; // muito além do rate limit
    await client.navigate("linkedin", "https://linkedin.com/b", 500);

    expect(sleepMock).not.toHaveBeenCalled();
  });
});

describe("BrowserMcpClient page budget", () => {
  it("remainingPageBudget começa com o valor configurado e decresce a cada navigate", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 5,
      now: () => 0,
      sleep: async () => {},
    });

    expect(client.remainingPageBudget()).toBe(5);

    await client.navigate("linkedin", "https://linkedin.com/a", 0);
    await client.navigate("linkedin", "https://linkedin.com/b", 0);
    await client.navigate("linkedin", "https://linkedin.com/c", 0);

    expect(client.remainingPageBudget()).toBe(2);
  });

  it("rejeita com GlobalPageBudgetExhaustedError quando o budget chega a zero", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 1,
      now: () => 0,
      sleep: async () => {},
    });

    await client.navigate("linkedin", "https://linkedin.com/a", 0);
    expect(client.remainingPageBudget()).toBe(0);

    await expect(
      client.navigate("linkedin", "https://linkedin.com/b", 0),
    ).rejects.toBeInstanceOf(GlobalPageBudgetExhaustedError);
  });
});

describe("BrowserMcpClient.click blacklist", () => {
  it("rejeita selectors exatos da APPLY_BUTTON_SELECTOR_BLACKLIST", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    for (const selector of APPLY_BUTTON_SELECTOR_BLACKLIST) {
      await expect(client.click(selector)).rejects.toBeInstanceOf(ForbiddenSelectorError);
    }
    expect(transport.invoke).not.toHaveBeenCalled();
  });

  it("rejeita selectors que contenham substrings sensíveis (apply/candidatar)", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    await expect(
      client.click('button:has-text("Apply")'),
    ).rejects.toBeInstanceOf(ForbiddenSelectorError);
    await expect(
      client.click('button[data-test="candidatar-agora"]'),
    ).rejects.toBeInstanceOf(ForbiddenSelectorError);
  });

  it("permite selectors neutros e repassa ao transport com argumentos corretos", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    await client.click("a.job-card-link");

    expect(transport.invoke).toHaveBeenCalledTimes(1);
    expect(transport.invoke).toHaveBeenCalledWith("browser_click", {
      selector: "a.job-card-link",
    });
  });
});

describe("BrowserMcpClient.type", () => {
  it("repassa selector e texto ao transport.invoke sem checagem de blacklist", async () => {
    const transport = buildMockTransport();
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    await client.type('input[name="q"]', "software engineer");

    expect(transport.invoke).toHaveBeenCalledWith("browser_type", {
      selector: 'input[name="q"]',
      text: "software engineer",
    });
  });
});

describe("BrowserMcpClient.snapshot", () => {
  it("chama browser_snapshot sem argumentos e retorna o payload do transport", async () => {
    const payload = {
      url: "https://linkedin.com/jobs",
      title: "Jobs",
      domHtml: "<html/>",
    };
    const transport = buildMockTransport({
      invoke: vi.fn(async () => payload) as unknown as BrowserMcpTransport["invoke"],
    });
    const client = new BrowserMcpClient({
      transport,
      connectTimeoutMs: 1_000,
      globalPageBudget: 10,
    });

    const snap = await client.snapshot();
    expect(snap).toEqual(payload);
    expect(transport.invoke).toHaveBeenCalledWith("browser_snapshot", {});
  });
});
