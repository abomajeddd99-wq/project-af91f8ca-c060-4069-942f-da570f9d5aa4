import { describe, expect, it } from "vitest";
import { evidenceLayoutFor, layoutEvidenceGroup, layoutEvidenceImage, type EvidenceItemsPerPage } from "./portfolio-image-layout";
import { defaultEvidenceLayout, parseEvidenceLayout } from "./portfolio-layout-preferences";

describe("teacher-selected evidence pagination", () => {
  it.each([1, 2, 3, 4] as EvidenceItemsPerPage[])("fits target %s without distortion, crop, or caption overlap", (target) => {
    const singles = Array.from({ length: target }, (_, index) => layoutEvidenceImage(index % 2 ? 800 : 1200, index % 2 ? 1200 : 800, 50));
    const group = layoutEvidenceGroup(singles, target)!;
    expect(group).toHaveLength(target);
    group.forEach((item, index) => {
      expect(item.width / item.height).toBeCloseTo(singles[index]!.width / singles[index]!.height);
      expect(item.metadataTop).toBeGreaterThanOrEqual(item.imageTop + item.height + 11);
      expect(item.metadataTop + item.metadataHeight).toBeLessThanOrEqual(841.89 - 64 + 0.01);
      expect(item.x).toBeGreaterThanOrEqual(40);
      expect(item.x + item.width).toBeLessThanOrEqual(595.28 - 40 + 0.01);
      for (const previous of group.slice(0, index)) {
        const separatedHorizontally = item.margin >= previous.margin + previous.metadataWidth + 20 ||
          previous.margin >= item.margin + item.metadataWidth + 20;
        expect(separatedHorizontally || item.imageTop >= previous.metadataTop + previous.metadataHeight + 20).toBe(true);
      }
    });
    if (target === 4) {
      expect(group[0]!.imageTop).toBe(group[1]!.imageTop);
      expect(group[2]!.imageTop).toBe(group[3]!.imageTop);
      expect(group[0]!.margin).toBeGreaterThan(group[1]!.margin); // RTL row-major.
      expect(group[2]!.imageTop).toBeGreaterThan(group[0]!.imageTop);
    }
  });
  it("rejects dense groups with overflowing captions or illegible image sizes", () => {
    const large = layoutEvidenceImage(1200, 800, 220);
    expect(layoutEvidenceGroup([large, large, large], 3)).toBeNull();
    expect(layoutEvidenceGroup([large, large, large, large], 4)).toBeNull();
    expect(layoutEvidenceGroup([large], 4)).toEqual([large]);
    expect(layoutEvidenceGroup([large, large], 1)).toBeNull();
  });
  it("defaults to two and respects per-standard overrides", () => {
    expect(evidenceLayoutFor(undefined, "s1")).toBe(2);
    const preferences = { defaultItemsPerPage: 4 as const, byStandard: { s1: 1 as const } };
    expect(evidenceLayoutFor(preferences, "s1")).toBe(1);
    expect(evidenceLayoutFor(preferences, "s2")).toBe(4);
  });
  it("accepts only validated local layout preferences, never arbitrary stored data", () => {
    expect(parseEvidenceLayout(null)).toEqual(defaultEvidenceLayout());
    expect(parseEvidenceLayout("{broken")).toEqual(defaultEvidenceLayout());
    expect(parseEvidenceLayout('{"defaultItemsPerPage":99,"byStandard":{"s1":3,"s2":0,"__proto__":4,"constructor":4}}'))
      .toEqual({ defaultItemsPerPage: 2, byStandard: { s1: 3 } });
    const preferences = { defaultItemsPerPage: 4, byStandard: { s1: 1, s2: 3 } };
    expect(parseEvidenceLayout(JSON.stringify(preferences))).toEqual(preferences);
  });
});
