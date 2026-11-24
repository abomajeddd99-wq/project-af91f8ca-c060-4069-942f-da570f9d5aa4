import { describe, expect, it } from "vitest";
import { assignedStandards, validateCareerSelection } from "./career";

describe("personal career paths", () => {
  it("accepts active configured paths without granting permissions", () => {
    expect(validateCareerSelection("teacher", [{ id: "teacher", is_active: true }])).toBe(true);
    expect(validateCareerSelection("admin", [{ id: "teacher", is_active: true }])).toBe(false);
  });
  it("rejects archived career paths", () => {
    expect(validateCareerSelection("principal", [{ id: "principal", is_active: false }])).toBe(
      false,
    );
  });
  it("shows only published assigned criteria, preserving own sections", () => {
    const rows = [
      { id: "teacher", owner_id: null, criteria_version_id: "teacher-v1" },
      { id: "principal", owner_id: null, criteria_version_id: "principal-v1" },
      { id: "draft", owner_id: null, criteria_version_id: "teacher-draft" },
      { id: "own", owner_id: "me", criteria_version_id: null },
    ];
    expect(
      assignedStandards(rows, [
        { id: "teacher-v1", status: "published" },
        { id: "teacher-draft", status: "draft" },
      ]).map((s) => s.id),
    ).toEqual(["teacher", "own"]);
  });

  it("preserves published standard titles, descriptions, and indicators", () => {
    const standard = {
      id: "standard-1",
      owner_id: null,
      criteria_version_id: "teacher-v1",
      title: "Planning",
      description: "Plans learning with clear outcomes.",
      indicators: ["Sets outcomes", "Sequences activities"],
    };

    expect(assignedStandards([standard], [{ id: "teacher-v1", status: "published" }])).toEqual([
      standard,
    ]);
  });
});
