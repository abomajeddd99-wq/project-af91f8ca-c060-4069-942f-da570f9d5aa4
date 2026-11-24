export const PORTFOLIO_A4: [number, number] = [595.28, 841.89];

/** All coordinates use PDF points; top offsets are measured down from the page top. */
export function layoutEvidenceImage(width: number, height: number, metadataHeight: number) {
  if (![width, height, metadataHeight].every(Number.isFinite) || width <= 0 || height <= 0 || metadataHeight < 0) {
    throw new Error("Invalid evidence layout dimensions.");
  }
  const [pageWidth, pageHeight] = PORTFOLIO_A4;
  const margin = 40;
  const top = 88;
  const bottom = 64;
  const gap = 12;
  const availableHeight = pageHeight - top - bottom - metadataHeight - gap;
  if (availableHeight < 220) throw new Error("Evidence metadata requires a continuation page.");
  const scale = Math.min((pageWidth - 2 * margin) / width, Math.min(pageHeight / 3, availableHeight) / height);
  const imageWidth = width * scale;
  const imageHeight = height * scale;
  const imageTop = top;
  return {
    x: (pageWidth - imageWidth) / 2,
    y: pageHeight - imageTop - imageHeight,
    width: imageWidth,
    height: imageHeight,
    imageTop,
    metadataTop: imageTop + imageHeight + gap,
    metadataHeight,
    metadataWidth: pageWidth - margin * 2,
    margin,
  };
}

export type EvidenceImageLayout = ReturnType<typeof layoutEvidenceImage>;

export type EvidenceItemsPerPage = 1 | 2 | 3 | 4;
export interface EvidenceLayoutPreferences {
  defaultItemsPerPage: EvidenceItemsPerPage;
  byStandard: Record<string, EvidenceItemsPerPage>;
}
export function evidenceLayoutFor(preferences: Partial<EvidenceLayoutPreferences> | undefined, standardId: string): EvidenceItemsPerPage {
  const value = preferences?.byStandard?.[standardId] ?? preferences?.defaultItemsPerPage ?? 2;
  return value === 1 || value === 3 || value === 4 ? value : 2;
}

/** A teacher's choice is a maximum, never permission to clip captions or distort images. */
export function layoutEvidenceGroup(
  originals: EvidenceImageLayout[],
  target: EvidenceItemsPerPage,
): EvidenceImageLayout[] | null {
  if (!originals.length || originals.length > target) return null;
  if (originals.length === 1) return [{ ...originals[0]! }];
  if (target <= 2) return layoutEvidencePair(originals[0]!, originals[1]!);
  const [pageWidth, pageHeight] = PORTFOLIO_A4;
  const columns = target === 4 ? 2 : 1;
  const gap = 22;
  const margin = 40;
  const top = 88;
  const cellWidth = (pageWidth - 2 * margin - gap * (columns - 1)) / columns;
  const rows = Math.ceil(originals.length / columns);
  const rowHeight = (pageHeight - top - 64 - gap * (rows - 1)) / rows;
  const result: EvidenceImageLayout[] = [];
  for (const [index, original] of originals.entries()) {
    const imageSpace = rowHeight - original.metadataHeight - 12;
    const scale = Math.min(1, cellWidth / original.width, imageSpace / original.height);
    // Denser choices allow smaller images, but not illegible thumbnails.
    const shortest = Math.min(original.width, original.height);
    if (scale < 0.42 || shortest * scale < Math.min(72, shortest * 0.8)) return null;
    const width = original.width * scale;
    const height = original.height * scale;
    const cellLeft = margin + (columns - 1 - index % columns) * (cellWidth + gap);
    const imageTop = top + Math.floor(index / columns) * (rowHeight + gap);
    result.push({
      ...original, width, height, x: cellLeft + (cellWidth - width) / 2,
      y: pageHeight - imageTop - height, imageTop,
      metadataTop: imageTop + height + 12, margin: cellLeft, metadataWidth: cellWidth,
    });
  }
  return result;
}

/** Pair only when each image retains at least 80% of its single-item display size. */
export function layoutEvidencePair(
  first: EvidenceImageLayout,
  second: EvidenceImageLayout,
): [EvidenceImageLayout, EvidenceImageLayout] | null {
  const [pageWidth, pageHeight] = PORTFOLIO_A4;
  const top = 88;
  const bottom = 64;
  const captionGap = 12;
  const itemGap = 22;
  const availableImages = pageHeight - top - bottom - first.metadataHeight - second.metadataHeight - captionGap * 2 - itemGap;
  const scale = Math.min(1, availableImages / (first.height + second.height));
  if (scale < 0.8) return null;
  let nextTop = top;
  const place = (original: EvidenceImageLayout): EvidenceImageLayout => {
    const width = original.width * scale;
    const height = original.height * scale;
    const imageTop = nextTop;
    const metadataTop = imageTop + height + captionGap;
    nextTop = metadataTop + original.metadataHeight + itemGap;
    return { ...original, x: (pageWidth - width) / 2, y: pageHeight - imageTop - height, width, height, imageTop, metadataTop };
  };
  return [place(first), place(second)];
}

/** Count hard line breaks as lines too, so newline-heavy descriptions cannot escape their page budget. */
export function splitImageDescription(value: string | null): string[] {
  if (!value) return [];
  const result: string[] = [];
  let chunk = "";
  let cost = 0;
  let limit = 240;
  for (const character of Array.from(value)) {
    const nextCost = character === "\n" ? 65 : 1;
    if (chunk && cost + nextCost > limit) {
      const boundary = chunk.lastIndexOf(" ") + 1;
      if (boundary > chunk.length * 0.7) {
        result.push(chunk.slice(0, boundary));
        chunk = chunk.slice(boundary);
        cost = Array.from(chunk).reduce((sum, value) => sum + (value === "\n" ? 65 : 1), 0);
      } else {
        result.push(chunk);
        chunk = "";
        cost = 0;
      }
      limit = 1600;
    }
    chunk += character;
    cost += nextCost;
  }
  if (chunk) result.push(chunk);
  return result;
}
