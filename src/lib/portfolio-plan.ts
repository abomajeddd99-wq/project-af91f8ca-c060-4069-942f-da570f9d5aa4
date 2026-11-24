/**
 * Pure page planner for the printable portfolio. Every sheet is one A4 page.
 * Order: cover, teacher details, table of contents, then for each section an intro page
 * followed by its evidence pages (images two per page; each rendered PDF page on its own sheet).
 */

export const TOC_ENTRIES_PER_PAGE = 14;
export const IMAGES_PER_PAGE = 2;

export type PlanEvidence =
  | { id: string; kind: "image" }
  /** pages = number of PDF pages included (0 when the PDF could not be rendered). */
  | { id: string; kind: "pdf"; pages: number };

export interface PlanSection {
  id: string;
  evidences: PlanEvidence[];
}

export type Sheet =
  | { type: "cover" }
  | { type: "details" }
  | { type: "toc"; entries: TocEntry[]; part: number; parts: number }
  | { type: "section"; sectionId: string }
  /** A group of image evidence (or PDFs that could not be rendered) shown as cards. */
  | { type: "cards"; sectionId: string; evidenceIds: string[] }
  | { type: "pdf-page"; sectionId: string; evidenceId: string; page: number; pages: number };

export interface TocEntry {
  sectionId: string;
  /** 1-based page number of the section's intro page. */
  page: number;
}

export interface PortfolioPlan {
  sheets: Sheet[];
  toc: TocEntry[];
  totalPages: number;
}

export function planPortfolio(sections: PlanSection[]): PortfolioPlan {
  const tocParts = Math.max(1, Math.ceil(sections.length / TOC_ENTRIES_PER_PAGE));
  const body: Sheet[] = [];
  const toc: TocEntry[] = [];
  const firstBodyPage = 2 + tocParts + 1; // cover + details + toc pages, then next page

  for (const section of sections) {
    toc.push({ sectionId: section.id, page: firstBodyPage + body.length });
    body.push({ type: "section", sectionId: section.id });

    let group: string[] = [];
    const flush = () => {
      if (group.length) body.push({ type: "cards", sectionId: section.id, evidenceIds: group });
      group = [];
    };
    for (const ev of section.evidences) {
      if (ev.kind === "pdf" && ev.pages > 0) {
        flush();
        for (let p = 1; p <= ev.pages; p++) {
          body.push({ type: "pdf-page", sectionId: section.id, evidenceId: ev.id, page: p, pages: ev.pages });
        }
      } else {
        group.push(ev.id);
        if (group.length === IMAGES_PER_PAGE) flush();
      }
    }
    flush();
  }

  const tocSheets: Sheet[] = [];
  for (let part = 0; part < tocParts; part++) {
    tocSheets.push({
      type: "toc",
      entries: toc.slice(part * TOC_ENTRIES_PER_PAGE, (part + 1) * TOC_ENTRIES_PER_PAGE),
      part: part + 1,
      parts: tocParts,
    });
  }

  const sheets: Sheet[] = [{ type: "cover" }, { type: "details" }, ...tocSheets, ...body];
  return { sheets, toc, totalPages: sheets.length };
}
