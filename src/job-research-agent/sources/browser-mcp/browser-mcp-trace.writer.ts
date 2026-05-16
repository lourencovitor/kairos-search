import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { SiteAdapterTraceEntry } from "./browser-mcp.types.js";

/**
 * Shape of the trace object persisted to browser-mcp-trace.json. Matches the
 * design's "browser-mcp-trace.json" artifact contract (Requirement 16.4).
 */
export interface BrowserMcpTrace {
  runId: string;
  generatedAt: string;
  config: {
    enabled: boolean;
    parallelSites: boolean;
    globalMaxPages: number;
  };
  sites: SiteAdapterTraceEntry[];
  metadata?: {
    warnings?: string[];
  };
}

/**
 * Regex que identifica parâmetros sensíveis em URLs para redação antes de
 * persistir o trace. Precisa casar qualquer um dos parâmetros listados em
 * qualquer posição de query string (primeira ou subsequente) preservando o
 * separador `?` ou `&` original.
 */
const TOKEN_REDACTION_REGEX =
  /([?&])(jwt|access_token|csrf-token|authorization|session_key)=[^&#]*/gi;

/**
 * Nomes de chave que nunca devem aparecer no artefato de trace — remove tanto
 * cookies (que podem conter session tokens) quanto headers arbitrários (que
 * podem conter `Authorization: Bearer ...`).
 */
const FORBIDDEN_KEY_REGEX = /^(cookie|cookies|headers|Cookie)$/;

/**
 * Aplica a regex de redação em uma string, substituindo apenas o valor do
 * parâmetro (mantém o separador e o nome do parâmetro intactos).
 */
function redactString(input: string): string {
  return input.replace(TOKEN_REDACTION_REGEX, "$1$2=REDACTED");
}

/**
 * Deep walker que produz uma cópia segura de `value` para persistência:
 *
 * 1. Strings têm tokens sensíveis substituídos por `REDACTED`.
 * 2. Chaves proibidas (`cookie`, `cookies`, `headers`, `Cookie`) são omitidas
 *    em qualquer nível do objeto.
 * 3. Estruturas não suportadas por JSON (Dates, functions, etc.) são
 *    preservadas como-estão para que `JSON.stringify` as trate conforme suas
 *    regras padrão.
 */
export function redactTraceForPersistence(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactTraceForPersistence(item));
  }

  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      if (FORBIDDEN_KEY_REGEX.test(key)) {
        continue;
      }
      result[key] = redactTraceForPersistence(source[key]);
    }
    return result;
  }

  return value;
}

export class BrowserMcpTraceWriter {
  /**
   * Writes `browser-mcp-trace.json` inside `runDirectory`, redacting session
   * tokens from all URL-shaped strings before serialization. Returns the
   * absolute path of the written file.
   */
  async write(runDirectory: string, trace: BrowserMcpTrace): Promise<string> {
    const filePath = path.join(runDirectory, "browser-mcp-trace.json");
    const redacted = redactTraceForPersistence(trace);
    const json = JSON.stringify(redacted, null, 2);
    await writeFile(filePath, json, "utf8");
    return filePath;
  }
}
