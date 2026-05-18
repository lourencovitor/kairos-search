import { describe, expect, it } from 'vitest';

import { SENIORITY_REPORT_GROUP_V2_ORDER, type SeniorityReportGroupV2 } from './job.types.js';

describe('SENIORITY_REPORT_GROUP_V2_ORDER', () => {
  it('contém exatamente os 8 grupos exportáveis na ordem canônica', () => {
    const expected: SeniorityReportGroupV2[] = [
      'junior',
      'pleno',
      'senior',
      'staff',
      'arq',
      'qa',
      'devops',
      'management',
    ];
    expect(SENIORITY_REPORT_GROUP_V2_ORDER).toStrictEqual(expected);
  });

  it("não inclui o bucket interno 'other'", () => {
    expect(SENIORITY_REPORT_GROUP_V2_ORDER).not.toContain('other');
  });

  it('tem tamanho 8', () => {
    expect(SENIORITY_REPORT_GROUP_V2_ORDER).toHaveLength(8);
  });
});
