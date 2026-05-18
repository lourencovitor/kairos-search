import { describe, expect, it } from 'vitest';

import {
  BROWSER_MCP_SITE_IDS,
  type BrowserMcpSiteId,
  ForbiddenSelectorError,
  GlobalPageBudgetExhaustedError,
} from './browser-mcp.types.js';

describe('BROWSER_MCP_SITE_IDS', () => {
  it('contém exatamente 10 entradas', () => {
    expect(BROWSER_MCP_SITE_IDS).toHaveLength(10);
  });

  it('cobre todos os 10 literais de BrowserMcpSiteId', () => {
    const expectedIds: readonly BrowserMcpSiteId[] = [
      'linkedin',
      'programathor',
      'glassdoor',
      'vagas_com',
      'catho',
      'infojobs_br',
      'gupy_public',
      'trampos_co',
      'revelo',
      'geekhunter',
    ];

    for (const expected of expectedIds) {
      expect(BROWSER_MCP_SITE_IDS).toContain(expected);
    }
    expect([...BROWSER_MCP_SITE_IDS].sort()).toStrictEqual([...expectedIds].sort());
  });
});

describe('ForbiddenSelectorError', () => {
  it('é instância de Error e tem name correto', () => {
    const error = new ForbiddenSelectorError('button.apply');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ForbiddenSelectorError);
    expect(error.name).toBe('ForbiddenSelectorError');
    expect(error.message).toContain('button.apply');
  });
});

describe('GlobalPageBudgetExhaustedError', () => {
  it('é instância de Error e tem name correto', () => {
    const error = new GlobalPageBudgetExhaustedError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GlobalPageBudgetExhaustedError);
    expect(error.name).toBe('GlobalPageBudgetExhaustedError');
  });
});
