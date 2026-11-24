/** Evidence coverage counts standards that have at least one attached evidence item. */
export interface EvidenceCoverageSummary {
  /** Number of standards in the selected set. */
  total: number;
  /** Standards with at least one evidence item. */
  documented: number;
  /** Standards without evidence yet. */
  empty: number;
  /** documented / total, from 0 to 100. */
  percent: number;
  /** Evidence items attached to the listed standards. */
  evidenceCount: number;
}

export function evidenceCountFor(standardId: string, evidences: { standard_id: string }[]): number {
  let n = 0;
  for (const e of evidences) if (e.standard_id === standardId) n += 1;
  return n;
}

export function computeEvidenceCoverage(
  standards: { id: string }[],
  evidences: { standard_id: string }[],
): EvidenceCoverageSummary {
  const ids = new Set(standards.map((s) => s.id));
  const withEvidence = new Set<string>();
  let evidenceCount = 0;
  for (const e of evidences) {
    if (!ids.has(e.standard_id)) continue;
    evidenceCount += 1;
    withEvidence.add(e.standard_id);
  }
  const total = ids.size;
  const documented = withEvidence.size;
  const percent = total === 0 ? 0 : Math.round((documented / total) * 100);
  return { total, documented, empty: total - documented, percent, evidenceCount };
}

// ---- Teacher-selected status is intentionally independent of evidence coverage ----
export type ProgressStatus = "not_started" | "in_progress" | "completed";

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: "لم يبدأ",
  in_progress: "قيد الإنجاز",
  completed: "مكتمل",
};

export const STATUS_ORDER: ProgressStatus[] = ["not_started", "in_progress", "completed"];

export interface ManualProgressSummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percent: number;
  weightedPercent: number;
}

export function statusFor(
  standardId: string,
  progress: { standard_id: string; status: string }[],
): ProgressStatus {
  const s = progress.find((p) => p.standard_id === standardId)?.status;
  return s === "completed" || s === "in_progress" ? s : "not_started";
}

export function computeManualProgress(
  standards: { id: string; weight: number | string | null }[],
  progress: { standard_id: string; status: string }[],
): ManualProgressSummary {
  const total = standards.length;
  let completed = 0;
  let inProgress = 0;
  let weightAll = 0;
  let weightDone = 0;
  for (const s of standards) {
    const w = Number(s.weight ?? 0) || 0;
    weightAll += w;
    const st = statusFor(s.id, progress);
    if (st === "completed") {
      completed += 1;
      weightDone += w;
    } else if (st === "in_progress") {
      inProgress += 1;
    }
  }
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const weightedPercent = weightAll > 0 ? Math.round((weightDone / weightAll) * 100) : percent;
  return { total, completed, inProgress, notStarted: total - completed - inProgress, percent, weightedPercent };
}
