import { describe, expect, it } from "vitest";
import {
  MAX_EVIDENCE_BYTES,
  MAX_FILES_PER_UPLOAD,
  buildEvidencePath,
  normalizeEvidenceFields,
  splitEvidenceFiles,
  validateEvidenceFile,
} from "./evidence-files";

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("evidence file rules", () => {
  it("accepts images and PDF only", () => {
    expect(validateEvidenceFile(f("a.jpg", "image/jpeg")).ok).toBe(true);
    expect(validateEvidenceFile(f("a.pdf", "application/pdf")).ok).toBe(true);
    expect(validateEvidenceFile(f("a.exe", "application/octet-stream")).ok).toBe(false);
    expect(validateEvidenceFile(f("a.pdf", "image/png")).ok).toBe(false);
  });

  it("rejects files over 10 MB", () => {
    expect(validateEvidenceFile(f("a.png", "image/png", MAX_EVIDENCE_BYTES)).ok).toBe(true);
    expect(validateEvidenceFile(f("a.png", "image/png", MAX_EVIDENCE_BYTES + 1)).ok).toBe(false);
  });

  it("uploads at most 10 files per batch and reports the rest", () => {
    const files = Array.from({ length: 12 }, (_, i) => f(`p${i}.png`, "image/png"));
    const { accepted, rejected } = splitEvidenceFiles(files);
    expect(accepted).toHaveLength(MAX_FILES_PER_UPLOAD);
    expect(rejected).toHaveLength(2);
    expect(splitEvidenceFiles([f("x.png", "image/png")], 10).accepted).toHaveLength(0);
  });

  it("keeps a batch's valid files when one is invalid", () => {
    const r = splitEvidenceFiles([f("a.pdf", "application/pdf"), f("b.txt", "text/plain")]);
    expect(r.accepted.map((x) => x.name)).toEqual(["a.pdf"]);
    expect(r.rejected.map((x) => x.name)).toEqual(["b.txt"]);
  });

  it("stores files inside the teacher's own folder", () => {
    expect(buildEvidencePath("user-1", "pdf", "abc")).toBe("user-1/abc.pdf");
  });
});

describe("evidence fields", () => {
  it("requires a title", () => {
    expect(normalizeEvidenceFields({ title: "  ", description: "", date: "2026-01-15" }).ok).toBe(false);
  });

  it("trims text and stores an empty description as null", () => {
    const r = normalizeEvidenceFields({ title: " درس ", description: "  ", date: "2026-01-15" });
    expect(r).toEqual({ ok: true, value: { title: "درس", description: null, evidence_date: "2026-01-15" } });
  });

  it("rejects missing or impossible dates", () => {
    expect(normalizeEvidenceFields({ title: "x", description: "", date: "" }).ok).toBe(false);
    expect(normalizeEvidenceFields({ title: "x", description: "", date: "2026-02-30" }).ok).toBe(false);
  });

  it("caps title at 200 characters", () => {
    expect(normalizeEvidenceFields({ title: "a".repeat(201), description: "", date: "2026-01-15" }).ok).toBe(false);
  });
});
