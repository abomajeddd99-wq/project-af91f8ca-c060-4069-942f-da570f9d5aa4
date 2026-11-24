import { describe, expect, it } from "vitest";
import { computeEvidenceCoverage, computeManualProgress, statusFor } from "./progress";

describe("teacher progress summaries", () => {
  const standards = [
    { id: "s1", weight: 25 },
    { id: "s2", weight: 50 },
    { id: "s3", weight: 25 },
  ];

  it("shows all standards as not started when there are no progress rows", () => {
    expect(computeManualProgress(standards, [])).toEqual({
      total: 3,
      completed: 0,
      inProgress: 0,
      notStarted: 3,
      percent: 0,
      weightedPercent: 0,
    });
    expect(statusFor("s1", [])).toBe("not_started");
  });

  it("calculates completed, in-progress, and weighted progress", () => {
    const progress = [
      { standard_id: "s1", status: "completed" },
      { standard_id: "s2", status: "in_progress" },
    ];

    expect(computeManualProgress(standards, progress)).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      notStarted: 1,
      percent: 33,
      weightedPercent: 25,
    });
  });

  it("keeps teacher-selected completion separate from evidence coverage", () => {
    const progress = [
      { standard_id: "s1", status: "completed" },
      { standard_id: "s2", status: "in_progress" },
    ];
    const noEvidence = computeEvidenceCoverage(standards, []);
    const someEvidence = computeEvidenceCoverage(standards, [
      { standard_id: "s2" },
      { standard_id: "s2" },
      { standard_id: "outside-the-current-standards" },
    ]);

    expect(computeManualProgress(standards, progress).completed).toBe(1);
    expect(noEvidence).toEqual({
      total: 3,
      documented: 0,
      empty: 3,
      percent: 0,
      evidenceCount: 0,
    });
    expect(someEvidence).toEqual({
      total: 3,
      documented: 1,
      empty: 2,
      percent: 33,
      evidenceCount: 2,
    });
    expect(computeManualProgress(standards, progress).completed).toBe(1);
  });

  it("reports zero coverage for an empty standards set", () => {
    expect(computeEvidenceCoverage([], [{ standard_id: "s1" }])).toEqual({
      total: 0,
      documented: 0,
      empty: 0,
      percent: 0,
      evidenceCount: 0,
    });
  });
});
