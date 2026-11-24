import type { EvidenceLayoutPreferences, EvidenceItemsPerPage } from "./portfolio-image-layout";

export const defaultEvidenceLayout = (): EvidenceLayoutPreferences => ({ defaultItemsPerPage: 2, byStandard: {} });
const valid = (value: unknown): value is EvidenceItemsPerPage => [1, 2, 3, 4].includes(value as number);

/** Only layout choices are stored locally, never evidence, teacher information, or file URLs. */
export function parseEvidenceLayout(value: string | null): EvidenceLayoutPreferences {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (!parsed || typeof parsed !== "object") return defaultEvidenceLayout();
    const record = parsed as Record<string, unknown>;
    const byStandard: Record<string, EvidenceItemsPerPage> = {};
    if (record["byStandard"] && typeof record["byStandard"] === "object") {
      for (const [id, count] of Object.entries(record["byStandard"])) {
        if (valid(count) && !["__proto__", "constructor", "prototype"].includes(id)) byStandard[id] = count;
      }
    }
    return { defaultItemsPerPage: valid(record["defaultItemsPerPage"]) ? record["defaultItemsPerPage"] : 2, byStandard };
  } catch {
    return defaultEvidenceLayout();
  }
}
