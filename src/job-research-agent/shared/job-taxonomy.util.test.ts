import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type {
  RoleCategory,
  SeniorityLevel,
  SeniorityReportGroupV2,
} from "../domain/job.types.js";
import {
  getRoleCategoryLabel,
  getSeniorityLabel,
  getSeniorityReportGroupV2Label,
  toSeniorityReportGroupV2,
} from "./job-taxonomy.util.js";
import {
  seniorityLevelArb,
  roleCategoryArb,
} from "../../../test-fixtures/browser-mcp/generators.js";

const ALL_SENIORITIES: SeniorityLevel[] = [
  "architect",
  "principal",
  "staff",
  "lead",
  "staff_or_principal",
  "senior",
  "mid_level",
  "junior",
  "unknown",
];

const ALL_ROLE_CATEGORIES: RoleCategory[] = [
  "software_engineering",
  "tech_lead",
  "devops",
  "software_architecture",
  "solutions_architecture",
  "cloud_architecture",
  "qa",
];

// Oráculo independente da implementação: reflete a precedência do design
// (devops → arq → qa → junior → pleno → senior → staff → other).
function expectedGroup(
  seniority: SeniorityLevel,
  roleCategory: RoleCategory,
): SeniorityReportGroupV2 {
  if (roleCategory === "devops") return "devops";
  if (
    roleCategory === "software_architecture" ||
    roleCategory === "solutions_architecture" ||
    roleCategory === "cloud_architecture" ||
    seniority === "architect"
  ) {
    return "arq";
  }
  if (roleCategory === "qa") return "qa";
  switch (seniority) {
    case "junior":
      return "junior";
    case "mid_level":
      return "pleno";
    case "senior":
    case "lead":
      return "senior";
    case "staff":
    case "principal":
    case "staff_or_principal":
      return "staff";
    default:
      return "other";
  }
}

describe("toSeniorityReportGroupV2 — full (seniority, roleCategory) matrix", () => {
  for (const seniority of ALL_SENIORITIES) {
    for (const roleCategory of ALL_ROLE_CATEGORIES) {
      it(`maps (${seniority}, ${roleCategory}) to ${expectedGroup(seniority, roleCategory)}`, () => {
        expect(toSeniorityReportGroupV2({ seniority, roleCategory })).toBe(
          expectedGroup(seniority, roleCategory),
        );
      });
    }
  }
});

describe("toSeniorityReportGroupV2 — precedence spot checks", () => {
  it("devops wins over architect seniority", () => {
    expect(
      toSeniorityReportGroupV2({ seniority: "architect", roleCategory: "devops" }),
    ).toBe("devops");
  });

  it("devops wins over qa roleCategory is unreachable (mutually exclusive) but devops still wins over senior", () => {
    expect(
      toSeniorityReportGroupV2({ seniority: "senior", roleCategory: "devops" }),
    ).toBe("devops");
  });

  it("architecture roleCategory wins over senior seniority", () => {
    expect(
      toSeniorityReportGroupV2({
        seniority: "senior",
        roleCategory: "solutions_architecture",
      }),
    ).toBe("arq");
  });

  it("architect seniority wins even when roleCategory is software_engineering", () => {
    expect(
      toSeniorityReportGroupV2({
        seniority: "architect",
        roleCategory: "software_engineering",
      }),
    ).toBe("arq");
  });

  it("qa roleCategory wins over junior seniority", () => {
    expect(
      toSeniorityReportGroupV2({ seniority: "junior", roleCategory: "qa" }),
    ).toBe("qa");
  });

  it("lead seniority maps to senior group", () => {
    expect(
      toSeniorityReportGroupV2({
        seniority: "lead",
        roleCategory: "software_engineering",
      }),
    ).toBe("senior");
  });

  it("staff_or_principal maps to staff group", () => {
    expect(
      toSeniorityReportGroupV2({
        seniority: "staff_or_principal",
        roleCategory: "software_engineering",
      }),
    ).toBe("staff");
  });

  it("unknown seniority with non-special roleCategory falls back to other", () => {
    expect(
      toSeniorityReportGroupV2({
        seniority: "unknown",
        roleCategory: "software_engineering",
      }),
    ).toBe("other");
  });

  it("tech_lead roleCategory does not force any override (follows seniority)", () => {
    expect(
      toSeniorityReportGroupV2({ seniority: "senior", roleCategory: "tech_lead" }),
    ).toBe("senior");
    expect(
      toSeniorityReportGroupV2({ seniority: "junior", roleCategory: "tech_lead" }),
    ).toBe("junior");
  });
});

describe("getSeniorityReportGroupV2Label", () => {
  const expectedLabels: Record<SeniorityReportGroupV2, string> = {
    junior: "Junior",
    pleno: "Pleno",
    senior: "Senior",
    staff: "Staff",
    arq: "Arq",
    qa: "QA",
    devops: "DevOps",
    management: "Management",
    other: "Other",
  };

  for (const [group, label] of Object.entries(expectedLabels) as [
    SeniorityReportGroupV2,
    string,
  ][]) {
    it(`returns "${label}" for group "${group}"`, () => {
      expect(getSeniorityReportGroupV2Label(group)).toBe(label);
    });
  }
});

describe("getSeniorityLabel — mid_level migration", () => {
  it('returns "Pleno" for mid_level (was "Mid-level / Pleno")', () => {
    expect(getSeniorityLabel("mid_level")).toBe("Pleno");
  });
});

describe("getRoleCategoryLabel — qa branch", () => {
  it('returns "QA / Quality Engineering" for qa', () => {
    expect(getRoleCategoryLabel("qa")).toBe("QA / Quality Engineering");
  });
});

// Feature: browsermcp-job-search-engine, Property 1: Partição total de SeniorityReportGroupV2
describe("Property 1 — partition totality", () => {
  /**
   * Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 15.1
   */

  const VALID_GROUPS: readonly SeniorityReportGroupV2[] = [
    "junior",
    "pleno",
    "senior",
    "staff",
    "arq",
    "qa",
    "devops",
    "other",
  ] as const;

  it("(a) always returns one of the 8 literal SeniorityReportGroupV2 values", () => {
    fc.assert(
      fc.property(seniorityLevelArb, roleCategoryArb, (seniority, roleCategory) => {
        const result = toSeniorityReportGroupV2({ seniority, roleCategory });
        expect(VALID_GROUPS).toContain(result);
      }),
      { numRuns: 500 },
    );
  });

  it("(b) precedence order is respected — DevOps wins over architect wins over QA wins over seniority-based groups", () => {
    fc.assert(
      fc.property(seniorityLevelArb, roleCategoryArb, (seniority, roleCategory) => {
        const result = toSeniorityReportGroupV2({ seniority, roleCategory });

        // DevOps roleCategory always wins regardless of seniority
        if (roleCategory === "devops") {
          expect(result).toBe("devops");
          return;
        }

        // Architecture roleCategories or architect seniority win over QA and seniority-based
        if (
          roleCategory === "software_architecture" ||
          roleCategory === "solutions_architecture" ||
          roleCategory === "cloud_architecture" ||
          seniority === "architect"
        ) {
          expect(result).toBe("arq");
          return;
        }

        // QA roleCategory wins over seniority-based groups
        if (roleCategory === "qa") {
          expect(result).toBe("qa");
          return;
        }

        // Remaining cases follow seniority mapping
        expect(["junior", "pleno", "senior", "staff", "other"]).toContain(result);
      }),
      { numRuns: 500 },
    );
  });

  it("(c) the function is pure — two calls with same input return same output", () => {
    fc.assert(
      fc.property(seniorityLevelArb, roleCategoryArb, (seniority, roleCategory) => {
        const input = { seniority, roleCategory };
        const first = toSeniorityReportGroupV2(input);
        const second = toSeniorityReportGroupV2(input);
        expect(first).toBe(second);
      }),
      { numRuns: 500 },
    );
  });
});
