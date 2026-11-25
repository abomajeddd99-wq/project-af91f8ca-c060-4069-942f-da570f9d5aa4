import { degrees, PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toPngMock, renderedMarkup } = vi.hoisted(() => ({
  toPngMock: vi.fn(),
  renderedMarkup: [] as string[],
}));

vi.mock("html-to-image", () => ({ toPng: toPngMock }));

import { createPortfolioPdf, fitEvidenceImage, planPortfolioPages } from "./portfolio-export";
import { layoutEvidenceImage, layoutEvidencePair, splitImageDescription } from "./portfolio-image-layout";
import { buildStandardCover } from "./portfolio-standard-cover";
import * as rasterQuality from "./portfolio-raster-quality";
import { portfolioPageMarkup } from "./portfolio-page-renderer";

const ONE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/yZQAAAAASUVORK5CYII=";

async function syntheticPdf(sizes: [number, number][], rotatedPages: number[] = []) {
  const pdf = await PDFDocument.create();
  sizes.forEach((size, index) => {
    const page = pdf.addPage(size);
    page.drawText(`Synthetic evidence page ${index + 1}`);
    if (rotatedPages.includes(index)) page.setRotation(degrees(90));
  });
  return {
    bytes: new Uint8Array(await pdf.save()),
    sizes,
    rotations: sizes.map((_, index) => (rotatedPages.includes(index) ? 90 : 0)),
  };
}

const standard = (id: string, code: string, title: string, description: string | null = null, indicators: string[] = []) => ({
  id,
  code,
  title,
  description,
  indicators,
  weight: 50,
  is_placeholder: false,
});

const evidence = (id: string, standardId: string, fileName: string) => ({
  id,
  standard_id: standardId,
  title: `شاهد ${fileName}`,
  file_name: fileName,
  description: "ملف اختبار اصطناعي",
  evidence_date: "2026-11-14",
  created_at: "2026-11-14T00:00:00.000Z",
  mime_type: "application/pdf",
  file_size: 1024,
});

describe("complete portfolio PDF export", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    renderedMarkup.length = 0;
    toPngMock.mockReset();
    toPngMock.mockImplementation(async (element: HTMLElement) => {
      renderedMarkup.push(element.innerHTML);
      return ONE_PIXEL_PNG;
    });
  });

  it.each([1, 2, 3, 4] as const)("uses the same ordered, numbered plan for layout %s preview and PDF", async (target) => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    const original = HTMLElement.prototype.getBoundingClientRect;
    const measurement = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.style.visibility === "hidden" ? { width: 680, height: 64 } as DOMRect : original.call(this);
    });
    try {
      const bytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1]!), (c) => c.charCodeAt(0));
      const source = await syntheticPdf([[700, 450], [400, 600]], [1]);
      const attachments = Array.from({ length: 5 }, (_, index) => ({
        evidence: { ...evidence(`e-${index}`, "s1", `PRIVATE-ID-${index}.png`), title: `عنوان سري ${index + 1}`, indicator_index: index % 2, indicator_text: "بند متابعة تجريبي", description: "وصف موجز", mime_type: "image/png" },
        bytes,
      }));
      const input = {
        profile: null, standards: [standard("s1", "01", "أول"), standard("s2", "02", "ثان")], progress: [],
        evidenceLayout: { defaultItemsPerPage: target, byStandard: { s2: 1 as const } },
        attachments: [
          ...attachments,
          { evidence: { ...evidence("pdf", "s1", "PRIVATE-ATTACHMENT.pdf"), title: "عنوان سري لمرفق", indicator_index: 1, indicator_text: "بند متابعة تجريبي" }, bytes: source.bytes },
          { ...attachments[0]!, evidence: { ...attachments[0]!.evidence, id: "after-pdf" } },
          ...attachments.slice(0, 2).map((item, index) => ({ ...item, evidence: { ...item.evidence, standard_id: "s2", id: `s2-${index}` } })),
        ],
      };
      const plan = await planPortfolioPages(input);
      const images = plan.pages.filter((page) => page.kind === "generated" && page.images.length);
      expect(images.map((page) => page.kind === "generated" ? page.images.length : 0))
        .toEqual([...Array.from({ length: Math.ceil(5 / target) }, (_, index) => Math.min(target, 5 - index * target)), 1, 1, 1]);
      expect(images.flatMap((page) => page.kind === "generated" ? page.images.map((item) => item.evidence.evidence.id) : []))
        .toEqual(["e-0", "e-1", "e-2", "e-3", "e-4", "after-pdf", "s2-0", "s2-1"]);
      const originals = plan.pages.filter((page) => page.kind === "original");
      expect(originals.map((page) => page.kind === "original" && page.index)).toEqual([0, 1]);
      const result = await createPortfolioPdf(input);
      expect(result.pageCount).toBe(plan.pages.length);
      const generated = plan.pages.filter((page) => page.kind === "generated");
      expect(renderedMarkup).toHaveLength(generated.length);
      generated.forEach((page, index) => {
        if (page.kind !== "generated") return;
        const expected = document.createElement("div");
        expected.innerHTML = portfolioPageMarkup(page.content, page.heading, page.frame);
        expect(renderedMarkup[index]).toBe(expected.innerHTML);
        expect(page.frame.pageNumber).toBe(plan.pages.indexOf(page) + 1);
        expect(page.frame.totalPages).toBe(plan.pages.length);
      });
      expect(renderedMarkup.join("")).not.toContain("PRIVATE-");
      expect(renderedMarkup.join("")).not.toContain("عنوان سري");
      expect(renderedMarkup.join("")).toContain("بند متابعة تجريبي");
    } finally { measurement.mockRestore(); }
  });

  it("includes all pages of multiple evidence PDFs in standard order with original dimensions and rotation", async () => {
    const first = await syntheticPdf(
      [
        [610, 810],
        [910, 610],
        [630, 830],
        [930, 630],
        [650, 850],
      ],
      [1],
    );
    const second = await syntheticPdf([
      [720, 920],
      [1020, 720],
    ]);

    const result = await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "معيار أول"), standard("s2", "2", "معيار ثان")],
      progress: [],
      generatedAt: new Date("2026-11-14T00:00:00.000Z"),
      attachments: [
        { evidence: evidence("e1", "s1", "five-pages.pdf"), bytes: first.bytes },
        { evidence: evidence("e2", "s2", "two-pages.pdf"), bytes: second.bytes },
      ],
    });

    const exported = await PDFDocument.load(result.bytes);
    const pages = exported.getPages();
    expect(result.warnings).toEqual([]);
    expect(result.pageCount).toBe(18);
    expect(pages).toHaveLength(18);
    expect(toPngMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        skipFonts: true,
        style: expect.objectContaining({ left: "0px", top: "0px", opacity: "1" }),
      }),
    );
    const capturedPage = toPngMock.mock.calls[0]![0] as HTMLElement;
    expect(capturedPage.dir).toBe("rtl");
    expect(capturedPage.style.padding).toBe("");
    expect(capturedPage.style.background).toBe("rgb(248, 245, 236)");

    const firstEvidencePages = pages.slice(8, 13);
    expect(firstEvidencePages.map((page) => [page.getWidth(), page.getHeight()])).toEqual(first.sizes);
    expect(firstEvidencePages.map((page) => page.getRotation().angle)).toEqual(first.rotations);

    const secondEvidencePages = pages.slice(15, 17);
    expect(secondEvidencePages.map((page) => [page.getWidth(), page.getHeight()])).toEqual(second.sizes);
    const contentsMarkup = renderedMarkup[5] ?? "";
    expect(contentsMarkup).toContain(">7</span>");
    expect(contentsMarkup).toContain(">14</span>");
    expect(contentsMarkup).toContain("6 / 18");
    const capturedHtml = renderedMarkup.join("\n");
    expect(capturedHtml.indexOf("معيار أول")).toBeLessThan(capturedHtml.indexOf("معيار ثان"));
    expect(capturedHtml).toContain("five-pages.pdf");
    expect(capturedHtml).toContain("two-pages.pdf");
  });

  it("adds a clear report page for an inaccessible attachment while exporting the rest", async () => {
    const source = await syntheticPdf([[612, 792]]);
    const result = await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "معيار الشاهد")],
      progress: [],
      generatedAt: new Date("2026-11-14T00:00:00.000Z"),
      attachments: [
        { evidence: evidence("e1", "s1", "available.pdf"), bytes: source.bytes },
        {
          evidence: evidence("e2", "s1", "unavailable.pdf"),
          error: "تعذر الوصول إلى الملف في مساحة الشواهد الخاصة.",
        },
      ],
    });

    const exported = await PDFDocument.load(result.bytes);
    expect(result.warnings).toEqual([{ fileName: "unavailable.pdf", standardTitle: "معيار الشاهد" }]);
    expect(result.pageCount).toBe(11);
    expect(exported.getPageCount()).toBe(11);
    expect(renderedMarkup.join("\n")).toContain("تعذر تضمين هذا المرفق");
    expect(renderedMarkup.join("\n")).toContain("unavailable.pdf");
    expect(renderedMarkup.join("\n")).toContain("معيار الشاهد");
  });

  it("includes an uploaded image and its metadata under the linked standard", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1200, height: 800, close })),
    );
    const imageBytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1] ?? ""), (character) => character.charCodeAt(0));
    const imageEvidence = { ...evidence("image-1", "s1", "sample.png"), mime_type: "image/png" };
    const result = await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "معيار الصورة")],
      progress: [],
      generatedAt: new Date("2026-11-14T00:00:00.000Z"),
      attachments: [{ evidence: imageEvidence, bytes: imageBytes }],
    });

    const exported = await PDFDocument.load(result.bytes);
    expect(result.warnings).toEqual([]);
    expect(exported.getPageCount()).toBe(9);
    expect(exported.getPage(7).getWidth()).toBeCloseTo(595.28);
    expect(exported.getPage(7).getHeight()).toBeCloseTo(841.89);
    const combinedPage = renderedMarkup.find((html) => html.includes('data-evidence-image-page="true"'))!;
    expect(combinedPage).toContain("sample.png");
    expect(combinedPage).toContain("شاهد sample.png");
    expect(combinedPage).toContain("ملف اختبار اصطناعي");
    expect(combinedPage).toContain("المعيار 1");
    expect(combinedPage).toContain('data-evidence-caption="true"');
    expect(renderedMarkup.join("\n")).not.toContain(">بيانات الشاهد</h1>");
    expect(renderedMarkup.join("\n")).toContain("sample.png");
    expect(renderedMarkup.join("\n")).toContain("معيار الصورة");
    expect(close).toHaveBeenCalledOnce();
  });

  it("fits images proportionally inside the page margins without cropping", () => {
    const fitted = fitEvidenceImage(1200, 800, [841.89, 595.28], 30);
    expect(fitted.width / fitted.height).toBeCloseTo(1200 / 800, 8);
    expect(fitted.x).toBeGreaterThanOrEqual(30);
    expect(fitted.y).toBeGreaterThanOrEqual(30);
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(841.89 - 30);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(595.28 - 30);
  });

  it.each([1, 2, 3, 4])("paginates %s same-standard images into ordered groups of at most two", async (count) => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    const imageBytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1]!), (character) => character.charCodeAt(0));
    const onProgress = vi.fn();
    const result = await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "معيار تجريبي")],
      progress: [],
      attachments: Array.from({ length: count }, (_, index) => ({
        evidence: { ...evidence(`image-${index + 1}`, "s1", `image-${index + 1}.png`), mime_type: "image/png" },
        bytes: imageBytes,
      })),
      onProgress,
    });
    const imagePages = renderedMarkup.filter((html) => html.includes('data-evidence-image-page="true"'));
    expect(imagePages).toHaveLength(Math.ceil(count / 2));
    const items = imagePages.map((html) => Array.from(html.matchAll(/data-evidence-item="([^"]+)"/g), (match) => match[1]));
    expect(items.map((page) => page.length)).toEqual(count === 1 ? [1] : count === 2 ? [2] : count === 3 ? [2, 1] : [2, 2]);
    expect(items.flat()).toEqual(Array.from({ length: count }, (_, index) => `image-${index + 1}`));
    expect(result.pageCount).toBe(8 + Math.ceil(count / 2));
    expect(renderedMarkup.at(-1)).toContain(`${result.pageCount} / ${result.pageCount}`);
    expect(onProgress.mock.calls).toEqual(Array.from({ length: count }, (_, index) => [index + 1, count]));
    const pdf = await PDFDocument.load(result.bytes);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28);
      expect(page.getHeight()).toBeCloseTo(841.89);
    }
  });

  it("uses one-third-page single images and declines pairs that would shrink them excessively", () => {
    const single = layoutEvidenceImage(1200, 800, 80);
    expect(single.height).toBeCloseTo(841.89 / 3);
    const pair = layoutEvidencePair(single, layoutEvidenceImage(800, 1200, 80))!;
    expect(pair).not.toBeNull();
    expect(pair[0].height / single.height).toBeGreaterThanOrEqual(0.8);
    expect(pair[1].imageTop - (pair[0].metadataTop + pair[0].metadataHeight)).toBeCloseTo(22);
    expect(pair[1].metadataTop + pair[1].metadataHeight).toBeLessThanOrEqual(841.89 - 64);
    const tallCaption = layoutEvidenceImage(1200, 800, 190);
    expect(layoutEvidencePair(tallCaption, tallCaption)).toBeNull();
  });

  it("does not pair images across standards or move them past a PDF attachment", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    const imageBytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1]!), (character) => character.charCodeAt(0));
    const pdf = await syntheticPdf([[710, 510]], [0]);
    const image = (id: string, standardId: string) => ({
      evidence: { ...evidence(id, standardId, `${id}.png`), mime_type: "image/png" }, bytes: imageBytes,
    });
    const result = await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "المعيار الأول"), standard("s2", "2", "المعيار الثاني")],
      progress: [],
      attachments: [
        image("first", "s1"),
        { evidence: evidence("pdf-between", "s1", "between.pdf"), bytes: pdf.bytes },
        image("second", "s1"), image("third", "s1"), image("other-standard", "s2"),
      ],
    });
    const imagePages = renderedMarkup.filter((html) => html.includes('data-evidence-image-page="true"'));
    expect(imagePages).toHaveLength(3);
    expect(imagePages[0]).toContain('data-evidence-item="first"');
    expect(imagePages[1]).toContain('data-evidence-item="second"');
    expect(imagePages[1]).toContain('data-evidence-item="third"');
    expect(imagePages[2]).toContain('data-evidence-item="other-standard"');
    const pdfMetadataIndex = renderedMarkup.findIndex((html) => html.includes("between.pdf"));
    expect(pdfMetadataIndex).toBeGreaterThan(renderedMarkup.indexOf(imagePages[0]!));
    expect(pdfMetadataIndex).toBeLessThan(renderedMarkup.indexOf(imagePages[1]!));
    const exported = await PDFDocument.load(result.bytes);
    expect(exported.getPage(9).getSize()).toEqual({ width: 710, height: 510 });
    expect(exported.getPage(9).getRotation().angle).toBe(90);
    expect(renderedMarkup.at(-1)).toContain(`${result.pageCount} / ${result.pageCount}`);
  });

  it("calculates later index references from paired evidence pages rather than individual image counts", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    const bytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1]!), (character) => character.charCodeAt(0));
    const result = await createPortfolioPdf({
      profile: null,
      standards: [
        standard("s1", "1", "المعيار السابق", "نص ".repeat(220)),
        standard("s2", "2", "المعيار التالي"),
      ],
      progress: [],
      attachments: [1, 2].map((index) => ({
        evidence: { ...evidence(`pair-${index}`, "s1", `image-${index}.png`), mime_type: "image/png" },
        bytes,
      })),
    });
    const imageIndex = renderedMarkup.findIndex((html) => html.includes('data-evidence-item-count="2"'));
    const nextIndex = renderedMarkup.findIndex((html, index) => index > imageIndex && html.includes(">المعيار التالي</h1>"));
    expect(imageIndex).toBeGreaterThan(5);
    expect(nextIndex).toBe(imageIndex + 1);
    expect(renderedMarkup.find((html) => html.includes('data-toc-standard="2"'))).toContain(
      `>${nextIndex + 1}</span>`,
    );
    expect(result.pageCount).toBe(renderedMarkup.length);
  });

  it.each([[1600, 900], [900, 1600], [500, 3000], [3000, 500]])(
    "reserves readable caption space directly below a %sx%s image without cropping",
    (width, height) => {
      const layout = layoutEvidenceImage(width, height, 140);
      expect(layout.width / layout.height).toBeCloseTo(width / height, 8);
      expect(layout.x).toBeGreaterThanOrEqual(40);
      expect(layout.y).toBeGreaterThanOrEqual(50);
      expect(layout.x + layout.width).toBeLessThanOrEqual(595.28 - 40 + 0.001);
      expect(layout.metadataTop - (layout.imageTop + layout.height)).toBeCloseTo(12);
      expect(layout.metadataTop + layout.metadataHeight).toBeLessThanOrEqual(841.89 - 50);
      expect(layout.height).toBeGreaterThan(80);
    },
  );

  it("preserves hard line breaks and all description text across bounded image continuation pages", () => {
    const text = `${"سطر تجريبي\n".repeat(90)}نهاية الوصف`;
    const chunks = splitImageDescription(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks[0]!.split("\n").length).toBeLessThanOrEqual(5);
    expect(() => layoutEvidenceImage(1200, 800, 600)).toThrow("continuation");
  });

  it("places long image descriptions after the combined page and recalculates later standards and closing references", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 800, height: 1200, close: vi.fn() })));
    const imageBytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1]!), (character) => character.charCodeAt(0));
    const description = `${"تفصيل ".repeat(260)}نهاية وصف الصورة`;
    const chunks = splitImageDescription(description);
    const result = await createPortfolioPdf({
      profile: null,
      standards: [
        standard("s1", "1", "المعيار السابق", "وصف ".repeat(200), ["مؤشر ".repeat(100)]),
        standard("s2", "2", "المعيار اللاحق"),
      ],
      progress: [],
      attachments: [{
        evidence: { ...evidence("image-long", "s1", "portrait.png"), mime_type: "image/png", evidence_date: null, description },
        bytes: imageBytes,
      }],
    });
    const imageIndex = renderedMarkup.findIndex((html) => html.includes('data-evidence-image-page="true"'));
    expect(imageIndex).toBeGreaterThan(4);
    const combined = renderedMarkup[imageIndex];
    expect(combined).not.toContain("2026");
    expect(combined).toContain(chunks[0]);
    expect(renderedMarkup.slice(imageIndex + 1).join("")).toContain("نهاية وصف الصورة");
    expect(renderedMarkup[imageIndex + 1]).toContain("تكملة وصف الشاهد");
    expect(result.pageCount).toBe(renderedMarkup.length);
    const laterStandardIndex = renderedMarkup.findIndex((html, index) => index > imageIndex && html.includes(">المعيار اللاحق</h1>"));
    expect(laterStandardIndex).toBeGreaterThan(imageIndex);
    expect(renderedMarkup[5]).toContain(`>${laterStandardIndex + 1}</span>`);
    expect(renderedMarkup.at(-1)).toContain(`${result.pageCount} / ${result.pageCount}`);
  });

  it("keeps long evidence descriptions complete across metadata pages", async () => {
    const source = await syntheticPdf([[612, 792]]);
    const longDescription = `${"تفصيل ".repeat(180)}نهاية الوصف`;
    const longEvidence = {
      ...evidence("long-1", "s1", "long-description.pdf"),
      description: longDescription,
    };
    const result = await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "معيار الوصف الطويل")],
      progress: [],
      generatedAt: new Date("2026-11-14T00:00:00.000Z"),
      attachments: [{ evidence: longEvidence, bytes: source.bytes }],
    });

    expect(result.pageCount).toBe(11);
    expect(renderedMarkup.join("\n")).toContain("نهاية الوصف");
  });

  it("builds the full front matter, labels generic copy, preserves standard text, and numbers the final contents accurately", async () => {
    const standards = Array.from({ length: 18 }, (_, index) =>
      standard(
        `s${index + 1}`,
        `S-${index + 1}`,
        `معيار ${index + 1}`,
        index === 0 ? "الوصف الرسمي كما ورد" : null,
        index === 0 ? ["المؤشر الأصلي دون تعديل"] : [],
      ),
    );
    const result = await createPortfolioPdf({
      profile: {
        full_name: "اسم افتراضي للاختبار",
        school: "مدرسة اختبارية",
        education_office: "إدارة تعليم اختبارية",
        academic_year: "1448 هـ",
        subject: "لغة عربية",
      },
      cover: {
        layout: "classic",
        accent: "gold",
        title: "ملف المعلم — رؤية وأثر",
      },
      standards,
      progress: [{ standard_id: "s1", status: "completed", notes: null }],
      attachments: [],
      generatedAt: new Date("2026-11-14T00:00:00.000Z"),
    });

    const html = renderedMarkup.join("\n");
    expect(result.pageCount).toBe(26); // 5 front pages + 2 contents + 18 individual covers + closing
    expect(html).toContain("مدرسة اختبارية");
    expect(html).toContain("إدارة تعليم اختبارية");
    expect(html).toContain("1448 هـ");
    expect(html).toContain("ملف المعلم — رؤية وأثر");
    expect(html).toContain("السيرة الذاتية");
    expect(html).toContain("النص الآتي عام وقابل للتحرير");
    expect(html).toContain("الوصف الرسمي كما ورد");
    expect(html).toContain("المؤشر الأصلي دون تعديل");
    expect(html).toContain("الحالة اليدوية");
    expect(html).toContain("تغطية الشواهد");
    expect(html).toContain("ختام الملف");
    expect(html).toContain("S-1");
    expect(html).toContain("S-18");
    expect((renderedMarkup.at(-1)?.match(/ختام الملف/g) ?? [])).toHaveLength(1);
    expect(renderedMarkup[0]).toContain("#F8F5EC");
    expect(renderedMarkup[0]).toContain("#C5A46D");
    expect(renderedMarkup[0]).toContain('data-royal-layout="classic"');
    expect(renderedMarkup[0]).toContain("overflow-wrap:anywhere");
    expect(renderedMarkup[4]).toContain("background:#E5DFD2");
    expect(renderedMarkup[4]).toContain("background:#E0D8C7");
    expect(renderedMarkup[7]).toContain('data-standard-cover="true"');
    expect(renderedMarkup[4]).toContain("توزيع الشواهد على المعايير");
    // TOC pages are 6–7; each standard owns one page, so the 18th begins on 25.
    expect(html).toContain(">8</span>");
    expect(html).toContain(">25</span>");
    expect(html).toContain("26 / 26");
  });

  it("captures visible Arabic RTL content at the viewport origin with the opaque capture override", async () => {
    await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "معيار مرئي")],
      progress: [],
      attachments: [],
    });
    const [element, options] = toPngMock.mock.calls[0] as [HTMLElement, { style: Record<string, string> }];
    expect(element.lang).toBe("ar");
    expect(element.dir).toBe("rtl");
    expect(options.style).toEqual(expect.objectContaining({
      left: "0px",
      top: "0px",
      opacity: "1",
    }));
    expect(renderedMarkup.join("\n")).toContain("معيار مرئي");
  });

  it("gives even concise standards their own cover and accurate distinct index reference", async () => {
    const standards = [
      standard("s1", "01", "المعيار الأول"),
      standard("s2", "02", "المعيار الثاني"),
      standard("s3", "03", "المعيار الثالث"),
    ];
    const result = await createPortfolioPdf({
      profile: null,
      standards,
      progress: [],
      attachments: [],
      generatedAt: new Date("2026-11-15T00:00:00.000Z"),
    });

    expect(result.pageCount).toBe(10);
    for (let index = 0; index < standards.length; index++) {
      const page = renderedMarkup[6 + index]!;
      expect(page).toContain(standards[index]!.title);
      expect(page).toContain(`data-standard-number="0${index + 1}"`);
      expect(page.match(/data-standard-cover="true"/g)).toHaveLength(1);
      expect(renderedMarkup[5]).toContain(`>${7 + index}</span>`);
      for (const other of standards.filter((_, otherIndex) => otherIndex !== index)) {
        expect(page).not.toContain(other.title);
      }
    }
  });

  it("keeps each standard and all of its evidence in a single sequential section", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    const imageBytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1]!), (character) => character.charCodeAt(0));
    const pdf = await syntheticPdf([[612, 792], [792, 612]]);
    const standards = [
      standard("s1", "01", "المعيار الأول المستقل"),
      standard("s2", "02", "المعيار الثاني المستقل"),
    ];
    const input = {
      profile: null,
      standards,
      progress: [],
      evidenceLayout: { defaultItemsPerPage: 2 as const, byStandard: {} },
      attachments: [
        ...Array.from({ length: 3 }, (_, index) => ({
          evidence: {
            ...evidence(`s1-image-${index + 1}`, "s1", `s1-image-${index + 1}.png`),
            mime_type: "image/png",
          },
          bytes: imageBytes,
        })),
        { evidence: evidence("s2-pdf", "s2", "s2-evidence.pdf"), bytes: pdf.bytes },
      ],
    };

    const plan = await planPortfolioPages(input);
    const pages = plan.pages;
    const firstCoverIndex = pages.findIndex((page) =>
      page.kind === "generated" && page.content.includes('data-standard-cover="true"') && page.content.includes("المعيار الأول المستقل"),
    );
    const secondCoverIndex = pages.findIndex((page) =>
      page.kind === "generated" && page.content.includes('data-standard-cover="true"') && page.content.includes("المعيار الثاني المستقل"),
    );

    expect(firstCoverIndex).toBeGreaterThan(-1);
    expect(secondCoverIndex).toBeGreaterThan(firstCoverIndex);

    const firstSectionPages = pages.slice(firstCoverIndex, secondCoverIndex);
    expect(firstSectionPages[0]).toMatchObject({ kind: "generated" });
    expect(firstSectionPages[0]!.kind === "generated" && firstSectionPages[0]!.content).toContain("المعيار الأول المستقل");
    expect(firstSectionPages.filter((page) => page.kind === "original")).toHaveLength(0);
    expect(firstSectionPages.some((page) =>
      page.kind === "generated" && page.content.includes("المعيار الثاني المستقل"),
    )).toBe(false);

    const firstEvidencePages = firstSectionPages.filter((page) =>
      page.kind === "generated" && page.images.length > 0,
    );
    expect(firstEvidencePages).toHaveLength(2);
    expect(firstEvidencePages.map((page) => page.kind === "generated" ? page.images.length : 0)).toEqual([2, 1]);

    const secondSectionPages = pages.slice(secondCoverIndex);
    expect(secondSectionPages[0]!.kind === "generated");
    expect(secondSectionPages[0]!.kind === "generated" && secondSectionPages[0]!.content).toContain("المعيار الثاني المستقل");
    expect(secondSectionPages.some((page) =>
      page.kind === "generated" && page.content.includes("المعيار الأول المستقل"),
    )).toBe(false);
    expect(secondSectionPages.filter((page) => page.kind === "original")).toHaveLength(2);

    const firstCover = pages[firstCoverIndex]!;
    const secondCover = pages[secondCoverIndex]!;
    expect(firstCover.kind).toBe("generated");
    expect(secondCover.kind).toBe("generated");
    if (firstCover.kind !== "generated" || secondCover.kind !== "generated") throw new Error("Expected generated cover pages.");
    expect(firstCover.frame.pageNumber).toBe(firstCoverIndex + 1);
    expect(secondCover.frame.pageNumber).toBe(secondCoverIndex + 1);

    const tocPages = pages.filter((page) =>
      page.kind === "generated" && page.heading === "فهرس المعايير",
    );
    expect(tocPages.map((page) => page.kind === "generated" ? page.content : "") .join("\n"))
      .toContain(`data-toc-page="${firstCover.frame.pageNumber}"`);
    expect(tocPages.map((page) => page.kind === "generated" ? page.content : "").join("\n"))
      .toContain(`data-toc-page="${secondCover.frame.pageNumber}"`);

    const closing = plan.pages.at(-1);
    expect(closing?.kind).toBe("generated");
    if (closing?.kind !== "generated") throw new Error("Expected generated closing page.");
    expect(closing.content).toContain("ختام الملف");
    expect(closing.frame.pageNumber).toBe(plan.pages.length);
  });

  it("continues a long professional biography instead of clipping profile content", async () => {
    const bio = `${"نبذة مهنية اصطناعية للمراجعة البصرية ".repeat(100)}نهاية النبذة المهنية`;
    const result = await createPortfolioPdf({
      profile: { full_name: "اسم افتراضي", bio },
      standards: [standard("s1", "1", "معيار الملف")],
      progress: [],
      attachments: [],
      generatedAt: new Date("2026-11-15T00:00:00.000Z"),
    });

    expect(result.pageCount).toBe(12);
    expect(renderedMarkup[1]).toContain("السيرة الذاتية");
    expect(renderedMarkup[2]).toContain("تكملة");
    const finalBiographyPage = renderedMarkup.find((markup) => markup.includes("نهاية النبذة المهنية"));
    expect(finalBiographyPage).toContain("6 / 12");
  });

  it("preserves all manual notes on the single standard cover and keeps final page numbers accurate", async () => {
    const notes = `${"ملاحظة مهنية تجريبية ".repeat(30)}نهاية الملاحظة`;
    const result = await createPortfolioPdf({
      profile: null,
      standards: [standard("s1", "1", "معيار الملاحظات")],
      progress: [{ standard_id: "s1", status: "in_progress", notes }],
      attachments: [],
      generatedAt: new Date("2026-11-14T00:00:00.000Z"),
    });

    const html = renderedMarkup.join("\n");
    expect(result.pageCount).toBe(8);
    expect(html).toContain("نهاية الملاحظة");
    expect(renderedMarkup[6]).toContain(notes);
    expect(renderedMarkup.filter((page) => page.includes('data-standard-cover="true"'))).toHaveLength(1);
    expect(html).toContain("7 / 8");
    expect(html).toContain("8 / 8");
  });

  it("exports all 11 covers exactly once, each immediately followed by its own paired evidence", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    const bytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(",")[1]!), (character) => character.charCodeAt(0));
    const standards = Array.from({ length: 11 }, (_, index) => standard(
      `s${index + 1}`, String(index + 1).padStart(2, "0"), `عنوان معيار ${index + 1}`,
      `وصف محفوظ ${index + 1}`, Array.from({ length: 6 }, (_, indicator) => `مؤشر محفوظ ${index + 1} — ${indicator + 1}`),
    ));
    const result = await createPortfolioPdf({
      profile: null, standards, progress: [],
      attachments: standards.flatMap((item) => [1, 2].map((index) => ({
        evidence: { ...evidence(`${item.id}-image-${index}`, item.id, `${item.id}-${index}.png`), mime_type: "image/png" },
        bytes,
      }))),
    });
    expect(result.pageCount).toBe(29);
    expect(renderedMarkup.filter((page) => page.includes('data-standard-cover="true"'))).toHaveLength(11);
    for (const [index, item] of standards.entries()) {
      const coverIndex = 6 + index * 2;
      const cover = renderedMarkup[coverIndex]!;
      expect(cover).toContain(`data-standard-number="${item.code}"`);
      expect(cover).toContain(item.title);
      expect(cover).toContain(item.description);
      item.indicators.forEach((indicator) => expect(cover).toContain(indicator));
      expect(renderedMarkup[coverIndex + 1]).toContain(`data-evidence-item="${item.id}-image-1"`);
      expect(renderedMarkup[coverIndex + 1]).toContain(`data-evidence-item="${item.id}-image-2"`);
      expect(renderedMarkup[5]).toContain(`>${coverIndex + 1}</span>`);
    }
  });

  it("escapes supplied standard content rather than interpreting it as executable markup", () => {
    const html = buildStandardCover({
      number: 11, code: "11", title: "<script>bad()</script>", description: "<b>وصف محفوظ</b>",
      indicators: ['<img src=x onerror="bad()">'], status: "قيد الإنجاز", weight: 9, evidenceCount: 2, notes: "ملاحظة أصلية",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;وصف محفوظ&lt;/b&gt;");
    expect(html).toContain("ملاحظة أصلية");
    expect(html).toContain('data-standard-number="11"');
  });

  it("retries a rejected capture at bounded lower resolution without losing any pages", async () => {
    const validate = vi.spyOn(rasterQuality, "validatePortfolioRaster")
      .mockRejectedValueOnce(new Error("collapsed synthetic capture")).mockResolvedValue(undefined);
    try {
      const result = await createPortfolioPdf({
        profile: null, standards: [standard("s1", "01", "معيار آمن")], progress: [], attachments: [],
      });
      expect(result.pageCount).toBe(8);
      expect(toPngMock).toHaveBeenCalledTimes(9);
      expect(toPngMock.mock.calls[0]![1]).toMatchObject({ pixelRatio: 3, width: 794, height: 1123 });
      expect(toPngMock.mock.calls[1]![1]).toMatchObject({ pixelRatio: 2, canvasWidth: 794, canvasHeight: 1123 });
      expect(renderedMarkup.at(-1)).toContain("8 / 8");
    } finally { validate.mockRestore(); }
  });

  it("aborts persistently corrupt captures explicitly rather than saving or deleting a page", async () => {
    const validate = vi.spyOn(rasterQuality, "validatePortfolioRaster")
      .mockRejectedValue(new Error("ظهرت صفحة مولدة سوداء"));
    try {
      await expect(createPortfolioPdf({
        profile: null, standards: [standard("s1", "01", "معيار آمن")], progress: [], attachments: [],
      })).rejects.toThrow("سوداء");
      expect(toPngMock).toHaveBeenCalledTimes(2);
      expect(document.querySelector("[data-portfolio-page-number]")).toBeNull();
    } finally { validate.mockRestore(); }
  });

  it("reports content that cannot fit one readable cover instead of silently clipping or adding standard pages", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(666);
    const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(683);
    const body = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(2000);
    try {
      await expect(createPortfolioPdf({
        profile: null, standards: [standard("s1", "01", "معيار طويل")], progress: [], attachments: [],
      })).rejects.toThrow("يتجاوز المساحة المقروءة لصفحة واحدة");
      expect(document.querySelector("[data-standard-cover]")).toBeNull();
    } finally {
      width.mockRestore();
      height.mockRestore();
      body.mockRestore();
    }
  });
});
