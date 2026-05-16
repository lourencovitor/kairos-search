// Feature: browsermcp-job-search-engine, Property 4: Idempotência do deduplicator
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { jobOpportunityArb } from "../../../test-fixtures/browser-mcp/generators.js";
import { deduplicateJobs } from "./duplicate-detector.skill.js";

describe("Property 4 — dedup idempotence", () => {
  // **Validates: Requirements 6.4, 15.4**
  it("dedup(dedup(jobs, now), now) produces the same ids in the same order as dedup(jobs, now)", () => {
    fc.assert(
      fc.property(
        fc.array(jobOpportunityArb, { minLength: 0, maxLength: 20 }),
        (jobs) => {
          const now = new Date("2026-01-15T00:00:00.000Z");

          const firstPass = deduplicateJobs(jobs, now);
          const secondPass = deduplicateJobs(firstPass, now);

          const firstPassIds = firstPass.map((j) => j.id);
          const secondPassIds = secondPass.map((j) => j.id);

          expect(secondPassIds).toEqual(firstPassIds);
        },
      ),
      { numRuns: 100 },
    );
  });
});
