/**
 * QA Repair
 *
 * QA 체크에서 발견된 문제를 Claude를 통해 자동 수정.
 * 최대 2회까지 리페어 시도.
 */

import type { SlideDSL } from "@/types/slide-dsl";
import { repairSlideDSL } from "@/lib/dsl/claude-dsl";
import { runQAChecks, hasErrors } from "./checks";
import type { QAIssue } from "./checks";

export interface RepairResult {
  dsl: SlideDSL;
  issues: QAIssue[];
  repairAttempts: number;
  wasRepaired: boolean;
}

/**
 * QA 체크 + 자동 리페어 (최대 maxAttempts회)
 */
export async function qaAndRepair(
  dsl: SlideDSL,
  maxAttempts: number = 2
): Promise<RepairResult> {
  let currentDSL = dsl;
  let issues = runQAChecks(currentDSL);
  let attempts = 0;

  while (hasErrors(issues) && attempts < maxAttempts) {
    attempts++;
    console.log(
      `[QA] Page ${currentDSL.pageIndex}: ${issues.length} issues found, repair attempt ${attempts}/${maxAttempts}`
    );

    try {
      const repairResult = await repairSlideDSL(
        currentDSL,
        issues.map((i) => ({
          type: i.type,
          elementIds: i.elementIds,
          details: i.details,
        }))
      );

      currentDSL = repairResult.dsl;
      issues = runQAChecks(currentDSL);

      console.log(
        `[QA] Page ${currentDSL.pageIndex}: after repair attempt ${attempts}, ${issues.length} issues remaining`
      );
    } catch (error) {
      console.warn(`[QA] Repair attempt ${attempts} failed:`, error);
      break;
    }
  }

  return {
    dsl: currentDSL,
    issues,
    repairAttempts: attempts,
    wasRepaired: attempts > 0,
  };
}
