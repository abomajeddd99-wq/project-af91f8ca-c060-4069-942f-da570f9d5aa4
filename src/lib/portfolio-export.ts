import { PDFDocument, rgb, type PDFImage } from "pdf-lib";
import { computeEvidenceCoverage, computeManualProgress, STATUS_LABELS, statusFor } from "./progress";
import { formatEvidenceDate, formatBytes, isImage, isPdf } from "./evidence-files";
import { renderPortfolioPage } from "./portfolio-page-renderer";
import { layoutEvidenceImage, layoutEvidenceGroup, evidenceLayoutFor, splitImageDescription, type EvidenceImageLayout, type EvidenceLayoutPreferences, type EvidenceItemsPerPage } from "./portfolio-image-layout";
import { buildStandardCover } from "./portfolio-standard-cover";
import { buildRoyalClosing } from "./portfolio-royal-design";
import { buildEducationalCover, buildEducationalCv } from "./portfolio-educational-design";
import { buildEducationalObjectives } from "./portfolio-educational-objectives";

const PAGE_A4: [number, number] = [595.28, 841.89];
const TOC_ROWS_PER_PAGE = 17;

interface ExportPageFrame {
  pageNumber: number;
  totalPages: number;
}

export interface PortfolioExportStandard {
  id: string;
  code: string;
  title: string;
  description: string | null;
  indicators: string[];
  weight: number | string | null;
  is_placeholder: boolean;
  is_active?: boolean;
}

export interface PortfolioExportProgress {
  standard_id: string;
  status: string;
  notes: string | null;
}

export interface PortfolioExportProfile {
  full_name?: string | null;
  job_title?: string | null;
  subject?: string | null;
  stage?: string | null;
  school?: string | null;
  education_office?: string | null;
  academic_year?: string | null;
  years_experience?: number | null;
  bio?: string | null;
}

export interface PortfolioExportEvidence {
  id: string;
  standard_id: string;
  indicator_index?: number | null;
  indicator_text?: string | null;
  title: string;
  file_name: string;
  description: string | null;
  evidence_date: string | null;
  created_at: string;
  mime_type: string;
  file_size: number;
}

export interface DownloadedEvidence {
  evidence: PortfolioExportEvidence;
  bytes?: Uint8Array;
  error?: string;
}

export interface PortfolioCoverOptions {
  layout: "royal" | "classic";
  accent: "gold" | "emerald";
  title: string;
}

interface PreparedPdfEvidence {
  evidence: PortfolioExportEvidence;
  kind: "pdf";
  source: PDFDocument;
  pageCount: number;
  bytes: Uint8Array;
}

interface PreparedImageEvidence {
  evidence: PortfolioExportEvidence;
  kind: "image";
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  width: number;
  height: number;
  pagePlan?: {
    descriptionChunks: string[];
    metadata: string;
    layout: ReturnType<typeof layoutEvidenceImage>;
    narrowMetadataHeight: number;
  };
}

interface NormalizedImage {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

interface UnavailableEvidence {
  evidence: PortfolioExportEvidence;
  kind: "unavailable";
  reason: string;
}

type PreparedEvidence = PreparedPdfEvidence | PreparedImageEvidence | UnavailableEvidence;

export interface PortfolioExportInput {
  profile: PortfolioExportProfile | null;
  standards: PortfolioExportStandard[];
  summaryStandards?: PortfolioExportStandard[];
  progress: PortfolioExportProgress[];
  attachments: DownloadedEvidence[];
  cover?: Partial<PortfolioCoverOptions>;
  evidenceLayout?: EvidenceLayoutPreferences;
  generatedAt?: Date;
  onProgress?: (completed: number, total: number) => void;
  onPageProgress?: (completed: number, total: number) => void;
}

export interface PortfolioExportResult {
  bytes: Uint8Array;
  warnings: { fileName: string; standardTitle: string }[];
  pageCount: number;
}

/** Copy complete source pages into the destination without rasterizing or resizing them. */
export async function appendImportedPdfPages(target: PDFDocument, source: PDFDocument): Promise<number> {
  const indices = source.getPageIndices();
  if (indices.length === 0) throw new Error("PDF has no pages");
  const pages = await target.copyPages(source, indices);
  for (const page of pages) target.addPage(page);
  return pages.length;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: Date, calendar: "gregory" | "islamic-umalqura"): string {
  return new Intl.DateTimeFormat(`ar-SA-u-ca-${calendar}`, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

async function addRasterPage(documentPdf: PDFDocument, pngBytes: Uint8Array): Promise<void> {
  const image = await documentPdf.embedPng(pngBytes);
  const page = documentPdf.addPage(PAGE_A4);
  page.drawImage(image, { x: 0, y: 0, width: PAGE_A4[0], height: PAGE_A4[1] });
}

function addPageFrame(pageNumber: number, totalPages: number) {
  return { pageNumber, totalPages };
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type });
}

async function normalizeImage(bytes: Uint8Array, mimeType: string): Promise<NormalizedImage> {
  if (typeof createImageBitmap !== "function") throw new Error("Image decoding is unavailable.");
  const bitmap = await createImageBitmap(bytesToBlob(bytes, mimeType));
  const width = bitmap.width;
  const height = bitmap.height;
  if (width < 1 || height < 1) {
    bitmap.close();
    throw new Error("Image dimensions are invalid.");
  }

  if (mimeType === "image/png" || mimeType === "image/jpeg") {
    bitmap.close();
    return {
      bytes,
      mimeType,
      width,
      height,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Image conversion is unavailable.");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Image conversion failed."))), "image/png");
  });
  canvas.width = 0;
  canvas.height = 0;
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mimeType: "image/png",
    width,
    height,
  };
}

async function prepareAttachment(input: DownloadedEvidence): Promise<PreparedEvidence> {
  const unavailable = (reason: string): UnavailableEvidence => ({
    evidence: input.evidence,
    kind: "unavailable",
    reason,
  });
  if (input.error || !input.bytes) return unavailable(input.error || "تعذر الوصول إلى المرفق.");

  if (isPdf(input.evidence.mime_type)) {
    try {
      const source = await PDFDocument.load(input.bytes);
      const pageCount = source.getPageCount();
      if (pageCount === 0) return unavailable("ملف PDF لا يحتوي على صفحات.");
      const validationDocument = await PDFDocument.create();
      await validationDocument.copyPages(source, source.getPageIndices());
      return { evidence: input.evidence, kind: "pdf", source, pageCount, bytes: input.bytes };
    } catch {
      return unavailable("تعذر قراءة صفحات ملف PDF أو استيرادها.");
    }
  }

  if (isImage(input.evidence.mime_type)) {
    try {
      const image = await normalizeImage(input.bytes, input.evidence.mime_type);
      const validationDocument = await PDFDocument.create();
      if (image.mimeType === "image/png") await validationDocument.embedPng(image.bytes);
      else await validationDocument.embedJpg(image.bytes);
      return { ...image, kind: "image", evidence: input.evidence };
    } catch {
      return unavailable("تعذر قراءة ملف الصورة أو تضمينه.");
    }
  }

  return unavailable("نوع الملف غير مدعوم في ملف الإنجاز.");
}

function imagePageMarkup(
  items: { evidence: PreparedImageEvidence; layout: EvidenceImageLayout }[],
): string {
  // Render Arabic captions using the proven browser renderer, but embed the evidence
  // itself natively afterwards: no screenshot recompression or downsampling.
  const cssScale = 794 / PAGE_A4[0];
  return `<section data-evidence-image-page="true" data-evidence-item-count="${items.length}">${items.map(({ evidence, layout }) => {
    if (!evidence.pagePlan) throw new Error("Image evidence layout was not prepared.");
    return `<article data-evidence-item="${escapeHtml(evidence.evidence.id)}" data-image-aspect="${evidence.width / evidence.height}">
    <div data-evidence-image-slot="true" style="position:absolute;left:${layout.x * cssScale}px;top:${layout.imageTop * cssScale}px;width:${layout.width * cssScale}px;height:${layout.height * cssScale}px"></div>
    <div data-evidence-caption="true" style="position:absolute;left:${layout.margin * cssScale}px;top:${layout.metadataTop * cssScale}px;width:${layout.metadataWidth * cssScale}px">${evidence.pagePlan.metadata}</div>
    </article>`;
  }).join("")}</section>`;
}

async function embedEvidenceImages(
  documentPdf: PDFDocument,
  items: { evidence: PreparedImageEvidence; layout: EvidenceImageLayout }[],
): Promise<void> {
  const page = documentPdf.getPage(documentPdf.getPageCount() - 1);
  for (const { evidence, layout } of items) {
    const image: PDFImage =
      evidence.mimeType === "image/png"
        ? await documentPdf.embedPng(evidence.bytes)
        : await documentPdf.embedJpg(evidence.bytes);
    page.drawImage(image, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    });
    page.drawRectangle({
      x: layout.x - 0.5, y: layout.y - 0.5,
      width: layout.width + 1, height: layout.height + 1,
      borderColor: rgb(197 / 255, 164 / 255, 109 / 255), borderWidth: 0.6,
    });
  }
}

export function fitEvidenceImage(
  imageWidth: number,
  imageHeight: number,
  pageSize: [number, number],
  margin = 30,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min((pageSize[0] - margin * 2) / imageWidth, (pageSize[1] - margin * 2) / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (pageSize[0] - width) / 2, y: (pageSize[1] - height) / 2, width, height };
}

function buildCover(
  profile: PortfolioExportProfile | null,
  generatedAt: Date,
  cover: Partial<PortfolioCoverOptions> = {},
): string {
  const title = cover.title?.trim().slice(0, 100) || "توثيق الممارسة ومسيرة الأثر";
  return buildEducationalCover({
    name: profile?.full_name || "المعلم",
    ...(profile?.school ? { school: profile.school } : {}),
    ...(profile?.academic_year ? { year: profile.academic_year } : {}),
    ...(profile?.education_office ? { educationOffice: profile.education_office } : {}),
    ...(profile?.subject ? { subject: profile.subject } : {}),
    ...(profile?.job_title ? { jobTitle: profile.job_title } : {}),
    subtitle: title === "ملف الإنجاز الوظيفي" ? "" : title,
    date: formatDate(generatedAt, "gregory"),
    layout: cover.layout === "classic" ? "classic" : "royal",
    accent: cover.accent === "emerald" ? "emerald" : "gold",
  });
}

function teacherInformationPageCount(profile: PortfolioExportProfile | null): number {
  return Math.max(1, splitEvidenceDescription(profile?.bio ?? "", 520, 900).length);
}

function buildTeacherInformation(
  profile: PortfolioExportProfile | null,
  pageIndex = 0,
  pageCount = 1,
): string {
  const bioChunks = splitEvidenceDescription(profile?.bio ?? "", 520, 900);
  return buildEducationalCv({ profile, bio: bioChunks[pageIndex] ?? "", pageIndex, pageCount });
}

function buildIntroduction(): string {
  return `
    <div style="margin-top:24px;border-right:1px solid #D8C9AA;padding-right:24px">
      <div style="border-right:2px solid #C5A15B;background:#F0ECE2;padding:14px 18px">
        <div style="font-size:11px;color:#765F35;font-weight:700">ملاحظة تحريرية</div>
        <p style="margin:5px 0 0;color:#5D5B51;font-size:13px;line-height:1.7">النص الآتي عام وقابل للتحرير، وليس وصفًا لتجربة المعلم أو إنجازاته. يُستحسن استبداله بمقدمة شخصية قبل اعتماد النسخة النهائية.</p>
      </div>
      <h2 style="margin-top:35px;color:#07594F;font-size:24px;border-bottom:1px solid #D8C9AA;padding-bottom:12px">مقدمة عامة قابلة للتحرير</h2>
      <p style="margin-top:10px;line-height:1.85;color:#465956;font-size:15px">يُعد هذا الملف إطارًا لتنظيم توثيق الممارسات المهنية والشواهد المرتبطة بمعايير العمل التعليمي. وتُعرض البيانات الواردة فيه كما أُدخلت في الملف، لتيسير الاطلاع والمراجعة.</p>
      <h2 style="margin-top:35px;color:#07594F;font-size:24px;border-bottom:1px solid #D8C9AA;padding-bottom:12px">أهداف الملف</h2>
      <ul style="padding-right:23px;margin-top:9px;color:#465956;font-size:15px">
        <li style="margin-top:8px">تنظيم الشواهد وربطها بالمعايير المختارة.</li>
        <li style="margin-top:8px">عرض حالة الإنجاز اليدوية وتغطية الشواهد كمؤشرين منفصلين.</li>
        <li style="margin-top:8px">توفير مرجع واضح يسهل مراجعته وتحديثه.</li>
      </ul>
    </div>`;
}

function buildOverview(
  summaryStandards: PortfolioExportStandard[],
  progress: PortfolioExportProgress[],
  evidences: { standard_id: string }[],
): string {
  const summary = computeManualProgress(summaryStandards, progress);
  const evidenceCoverage = computeEvidenceCoverage(summaryStandards, evidences);
  const manualProgressWidth = Math.max(0, Math.min(100, summary.weightedPercent));
  const evidenceCoverageWidth =
    evidenceCoverage.total > 0 ? Math.round((evidenceCoverage.documented / evidenceCoverage.total) * 100) : 0;
  const manualMetrics = [
    ["الإنجاز الموزون", `${summary.weightedPercent}٪`],
    ["مكتمل يدويًا", `${summary.completed} من ${summary.total}`],
  ];
  const evidenceMetrics = [
    ["معايير لها شواهد", `${evidenceCoverage.documented} من ${evidenceCoverage.total}`],
    ["إجمالي الشواهد المرتبطة", String(evidenceCoverage.evidenceCount)],
  ];
  const evidenceCounts = new Map<string, number>();
  for (const evidence of evidences) {
    evidenceCounts.set(evidence.standard_id, (evidenceCounts.get(evidence.standard_id) ?? 0) + 1);
  }
  const maximumEvidenceCount = Math.max(1, ...evidenceCounts.values());
  const distribution = summaryStandards.map((standard) => {
    const count = evidenceCounts.get(standard.id) ?? 0;
    return { standard, count, width: Math.round((count / maximumEvidenceCount) * 100) };
  });
  return `
    <div style="margin-top:25px">
      <div style="border-bottom:1px solid #D8C9AA;border-right:3px solid #07594F;padding:0 12px 12px;color:#07594F;font-size:18px;font-weight:700">الحالة اليدوية</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px">
        ${manualMetrics.map(([label, value], index) => `<div style="padding:15px 18px;background:#FFFFFF;border-top:2px solid #07594F;box-shadow:0 2px 8px rgba(40,54,53,.04)"><div style="font-size:12px;color:#65736F">${escapeHtml(label)}</div><div style="margin-top:6px;font-size:23px;font-weight:700;color:#07594F">${escapeHtml(value)}</div>${index === 0 ? `<div style="margin-top:10px;height:4px;background:#E5DFD2"><span style="display:block;width:${manualProgressWidth}%;height:100%;background:#07594F"></span></div>` : ""}</div>`).join("")}
      </div>
      <div style="margin-top:25px;border-bottom:1px solid #D8C9AA;border-right:3px solid #C5A15B;padding:0 12px 12px;color:#765F35;font-size:18px;font-weight:700">تغطية الشواهد — مؤشر مستقل</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px">
        ${evidenceMetrics.map(([label, value], index) => `<div style="padding:15px 18px;background:#F0ECE2;border-top:2px solid #C5A15B"><div style="font-size:12px;color:#756C56">${escapeHtml(label)}</div><div style="margin-top:6px;font-size:23px;font-weight:700;color:#765F35">${escapeHtml(value)}</div>${index === 0 ? `<div style="margin-top:10px;height:4px;background:#E0D8C7"><span style="display:block;width:${evidenceCoverageWidth}%;height:100%;background:#C5A15B"></span></div>` : ""}</div>`).join("")}
      </div>
      <div style="margin-top:20px">
        <h3 style="margin:0 0 9px;color:#07594F;font-size:14px;font-weight:700">توزيع الشواهد على المعايير</h3>
        <div style="display:grid;gap:5px">
          ${distribution.map(({ standard, count, width }) => `
            <div style="display:grid;grid-template-columns:minmax(0,1fr) 28px;align-items:center;gap:8px;min-height:23px">
              <div style="min-width:0">
                <div style="display:flex;justify-content:space-between;gap:8px;color:#465956;font-size:11px;line-height:1.45">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(standard.code)} · ${escapeHtml(standard.title)}</span>
                  <span dir="ltr">${count}</span>
                </div>
                <div style="margin-top:3px;height:3px;background:#E0D8C7"><span style="display:block;width:${width}%;height:100%;background:#C5A15B"></span></div>
              </div>
            </div>`).join("")}
        </div>
      </div>
    </div>
    <p style="margin-top:20px;padding-right:12px;border-right:2px solid #C5A15B;color:#65736F;font-size:12px;line-height:1.7">الحالة تُسجّل يدويًا، أما تغطية الشواهد فتُحتسب من المرفقات المرتبطة؛ ولا يدل أحد المؤشرين بالضرورة على الآخر.</p>`;
}

interface ExportSection {
  standard: PortfolioExportStandard | null;
  id: string;
  title: string;
  evidences: PreparedEvidence[];
  startPage: number;
  target: EvidenceItemsPerPage;
}

type EvidenceBatch =
  | { kind: "images"; items: { evidence: PreparedImageEvidence; layout: EvidenceImageLayout }[] }
  | { kind: "attachment"; evidence: PreparedPdfEvidence | UnavailableEvidence };

/** Shared by counting and rendering: never skip across PDFs, unavailable files, or standards. */
function evidenceBatches(section: ExportSection): EvidenceBatch[] {
  const batches: EvidenceBatch[] = [];
  for (let index = 0; index < section.evidences.length; index++) {
    const evidence = section.evidences[index]!;
    if (evidence.kind !== "image") {
      batches.push({ kind: "attachment", evidence });
      continue;
    }
    if (!evidence.pagePlan) throw new Error("Image evidence layout was not prepared.");
    const candidates = [evidence];
    // Never cross an attachment, a standard boundary, or a description continuation.
    if (evidence.pagePlan.descriptionChunks.length === 1) {
      for (let offset = 1; offset < section.target; offset++) {
        const next = section.evidences[index + offset];
        if (next?.kind !== "image" || !next.pagePlan || next.pagePlan.descriptionChunks.length !== 1) break;
        candidates.push(next);
      }
    }
    let layouts: EvidenceImageLayout[] | null = null;
    while (!layouts) {
      layouts = layoutEvidenceGroup(candidates.map((candidate) => ({
        ...candidate.pagePlan!.layout,
        metadataHeight: section.target === 4 && candidates.length > 1
          ? candidate.pagePlan!.narrowMetadataHeight : candidate.pagePlan!.layout.metadataHeight,
      })), section.target);
      if (!layouts) candidates.pop();
    }
    const items = candidates.map((candidate, offset) => ({ evidence: candidate, layout: layouts![offset]! }));
    index += candidates.length - 1;
    batches.push({ kind: "images", items });
  }
  return batches;
}

function buildContentsPage(sections: ExportSection[], pageIndex: number, pageCount: number): string {
  const entries = sections.slice(pageIndex * TOC_ROWS_PER_PAGE, (pageIndex + 1) * TOC_ROWS_PER_PAGE);
  return `
    <div style="margin-top:8px;background:#FFFFFF;padding:4px 15px">
      <div style="display:grid;grid-template-columns:64px 1fr 54px;gap:10px;padding:9px 3px;border-bottom:1px solid #C5A15B;color:#765F35;font-size:11px;font-weight:700">
        <span>الرمز</span><span>المعيار</span><span style="text-align:left">الصفحة</span>
      </div>
      ${entries
        .map(
          (section) => `
            <div data-toc-standard="${escapeHtml(section.standard?.code || "")}" data-toc-page="${section.startPage}" style="display:grid;grid-template-columns:64px 1fr 54px;gap:10px;align-items:center;border-bottom:1px solid #EEE9DE;padding:9px 3px">
              <span style="color:#765F35;font-size:12px">${escapeHtml(section.standard?.code || "—")}</span>
              <span style="font-weight:600;color:#202B2A;font-size:14px;line-height:1.5;overflow-wrap:anywhere">${escapeHtml(section.title)}</span>
              <span style="text-align:left;color:#07594F;font-family:monospace;font-weight:700">${escapeHtml(section.startPage)}</span>
            </div>`,
        )
        .join("") || `<p style="color:#697773">لا توجد معايير لعرضها.</p>`}
      <p style="margin-top:15px;text-align:center;font-size:11px;color:#697773">فهرس ${pageIndex + 1} من ${pageCount}</p>
    </div>`;
}

function buildStandardPage(
  section: ExportSection,
  progress: PortfolioExportProgress[],
  number: number,
): string {
  const status = section.standard
    ? statusFor(section.standard.id, progress)
    : "not_started";
  const notes = section.standard ? progress.find((p) => p.standard_id === section.standard?.id)?.notes : null;
  const numericCode = Number(section.standard?.code);
  return buildStandardCover({
    number: Number.isInteger(numericCode) && numericCode > 0 ? numericCode : number,
    code: section.standard?.code ?? "—",
    title: section.title,
    description: section.standard?.description ?? null,
    indicators: section.standard?.indicators ?? [],
    status: STATUS_LABELS[status],
    weight: section.standard?.weight ?? null,
    evidenceCount: section.evidences.length,
    notes: notes ?? null,
  });
}

function splitEvidenceDescription(
  description: string | null,
  firstPageLimit = 450,
  continuationLimit = 1000,
): string[] {
  if (!description) return [];
  const characters = Array.from(description);
  const chunks: string[] = [];
  let offset = 0;
  let limit = firstPageLimit;
  while (offset < characters.length) {
    let end = Math.min(offset + limit, characters.length);
    if (end < characters.length) {
      const wordBoundary = characters.lastIndexOf(" ", end);
      if (wordBoundary > offset + Math.floor(limit * 0.7)) end = wordBoundary;
    }
    chunks.push(characters.slice(offset, end).join(""));
    offset = end;
    limit = continuationLimit;
  }
  return chunks;
}

function evidenceMetadataPageCount(evidence: PreparedEvidence): number {
  if (evidence.kind === "image") {
    if (!evidence.pagePlan) throw new Error("Image evidence layout was not prepared.");
    return Math.max(0, evidence.pagePlan.descriptionChunks.length - 1);
  }
  return Math.max(1, splitEvidenceDescription(evidence.evidence.description).length);
}

function buildImageCaption(section: ExportSection, file: PortfolioExportEvidence, description: string): string {
  return `<div style="direction:rtl;text-align:right;border-top:1px solid #C5A15B;padding-top:8px;color:#202B2A">
    <h2 style="margin:0;font-size:17px;line-height:1.7;font-weight:700;color:#07594F;overflow-wrap:anywhere">${escapeHtml(file.indicator_text || "شاهد غير مرتبط ببند محدد")}</h2>
    ${description ? `<div style="margin-top:7px;font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(description)}</div>` : ""}
    <div style="margin-top:4px;font-size:12px;line-height:1.8;color:#765F35;overflow-wrap:anywhere">المعيار ${escapeHtml(section.standard?.code || "—")} · ${escapeHtml(section.title)}</div>
  </div>`;
}

async function prepareImagePage(section: ExportSection, evidence: PreparedImageEvidence): Promise<void> {
  const chunks = splitImageDescription(evidence.evidence.description);
  const descriptionChunks = chunks.length ? chunks : [""];
  let metadata = buildImageCaption(section, evidence.evidence, descriptionChunks[0] ?? "");
  const measure = (html: string, width = 687.3): number => {
    const container = document.createElement("div");
    container.dir = "rtl";
    container.style.cssText = `position:fixed;left:0;top:0;visibility:hidden;width:${width}px;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;font-size:18px;line-height:1.75;box-sizing:border-box`;
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      // jsdom has no layout engine; use a conservative fallback only in that case.
      return container.getBoundingClientRect().height * PAGE_A4[0] / 794;
    } finally {
      container.remove();
    }
  };
  await document.fonts?.ready;
  let height = measure(metadata) || 88;
  if (height > 240 && descriptionChunks[0]) {
    // Keep the image large; move the full description to continuation pages.
    descriptionChunks.unshift("");
    metadata = buildImageCaption(section, evidence.evidence, "");
    height = measure(metadata) || 130;
  }
  evidence.pagePlan = {
    descriptionChunks,
    metadata,
    layout: layoutEvidenceImage(evidence.width, evidence.height, height + 6),
    narrowMetadataHeight: (measure(metadata, ((PAGE_A4[0] - 80 - 22) / 2) * 794 / PAGE_A4[0]) || height * 1.8) + 6,
  };
}

function buildEvidenceMetadata(
  section: ExportSection,
  evidence: PreparedEvidence,
  description: string,
  continuationPage: number,
  totalDescriptionPages: number,
): string {
  const file = evidence.evidence;
  return `
    <div style="margin-top:5px">
       <div style="color:#765F35;font-size:12px;border-right:2px solid #C5A15B;padding-right:9px">المعيار ${escapeHtml(section.standard?.code || "—")} · ${escapeHtml(section.title)}</div>
        <h2 style="margin-top:9px;color:#07594F;font-size:21px;line-height:1.6;overflow-wrap:anywhere">${escapeHtml(file.indicator_text || "شاهد غير مرتبط ببند محدد")}</h2>
      ${continuationPage === 0 ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px">
            ${file.evidence_date ? `<div style="background:#FFFFFF;border-bottom:1px solid #D8C9AA;padding:10px 12px"><span style="color:#697773;font-size:11px">تاريخ الشاهد</span><div style="margin-top:4px;font-size:13px;color:#202B2A">${escapeHtml(formatEvidenceDate(file.evidence_date))}</div></div>` : ""}
            <div style="background:#FFFFFF;border-bottom:1px solid #D8C9AA;padding:10px 12px"><span style="color:#697773;font-size:11px">نوع الملف</span><div style="margin-top:4px;font-size:13px;color:#202B2A;overflow-wrap:anywhere">${escapeHtml(file.mime_type)}</div></div>
            <div style="background:#FFFFFF;border-bottom:1px solid #D8C9AA;padding:10px 12px"><span style="color:#697773;font-size:11px">حجم الملف</span><div style="margin-top:4px;font-size:13px;color:#202B2A">${escapeHtml(formatBytes(file.file_size))}</div></div>
        </div>` : `<p style="margin-top:22px;color:#54716c">تكملة وصف الشاهد (${continuationPage + 1} من ${totalDescriptionPages})</p>`}
       ${description ? `<div style="margin-top:19px;padding:13px 15px;background:#F0ECE2;white-space:pre-wrap;overflow-wrap:anywhere"><strong style="color:#07594F;font-size:13px">وصف الشاهد</strong><p style="margin-top:6px;color:#465956;font-size:14px;line-height:1.75">${escapeHtml(description)}</p></div>` : ""}
       ${evidence.kind === "pdf" && continuationPage === 0 ? `<div style="margin-top:17px;color:#465956;font-size:13px">عدد صفحات المرفق: <strong style="color:#07594F">${evidence.pageCount}</strong></div>` : ""}
    </div>`;
}

function buildUnavailablePage(section: ExportSection, evidence: UnavailableEvidence): string {
  const file = evidence.evidence;
  return `
    <div style="margin-top:7px;padding:21px;background:#F0ECE2;border-right:3px solid #C5A15B">
      <div style="font-size:11px;color:#765F35">بيان حالة المرفق</div>
      <h2 style="margin-top:6px;color:#07594F;font-size:23px">تعذر تضمين هذا المرفق</h2>
      <div style="margin-top:14px;color:#202B2A;overflow-wrap:anywhere"><strong>البند:</strong> ${escapeHtml(file.indicator_text || "غير مرتبط ببند محدد")}</div>
      <div style="margin-top:7px;color:#465956;overflow-wrap:anywhere"><strong>المعيار:</strong> ${escapeHtml(section.standard?.code || "—")} · ${escapeHtml(section.title)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px">
        <div style="padding:9px;background:#FFFFFF"><span style="font-size:11px;color:#697773">التاريخ</span><div style="font-size:13px">${escapeHtml(formatEvidenceDate(file.evidence_date ?? file.created_at))}</div></div>
        <div style="padding:9px;background:#FFFFFF"><span style="font-size:11px;color:#697773">النوع</span><div style="font-size:13px">${escapeHtml(file.mime_type)}</div></div>
        <div style="padding:9px;background:#FFFFFF"><span style="font-size:11px;color:#697773">الحجم</span><div style="font-size:13px">${escapeHtml(formatBytes(file.file_size))}</div></div>
      </div>
      ${file.description ? `<p style="margin-top:14px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px"><strong>الوصف:</strong> ${escapeHtml(file.description)}</p>` : ""}
      <p style="margin-top:14px;color:#765F35;font-size:13px;overflow-wrap:anywhere"><strong>السبب:</strong> ${escapeHtml(evidence.reason)}</p>
      <p style="margin-top:14px;color:#586A66;font-size:12px;line-height:1.7">أُدرج هذا التقرير لإظهار المرفق الذي تعذر الوصول إليه أو قراءته. لم تُستبدل صفحاته بمحتوى آخر.</p>
    </div>`;
}

function buildPageMap(
  sections: ExportSection[],
  tocPageCount: number,
  teacherPageCount: number,
): { closingPage: number } {
  let nextPage = 5 + teacherPageCount + tocPageCount;
  for (const section of sections) {
    section.startPage = nextPage;
    nextPage++;
      for (const batch of evidenceBatches(section)) {
        if (batch.kind === "images") {
          nextPage += 1 + batch.items.reduce((count, { evidence }) => count + evidenceMetadataPageCount(evidence), 0);
          continue;
        }
        const evidence = batch.evidence;
        if (evidence.kind === "unavailable") {
          nextPage++;
        } else {
          nextPage += evidenceMetadataPageCount(evidence);
          nextPage += evidence.kind === "pdf" ? evidence.pageCount : 1;
        }
      }
  }
  return { closingPage: nextPage };
}

export type PortfolioPlannedPage =
  | { kind: "generated"; content: string; heading: string | undefined; frame: ExportPageFrame;
      images: { evidence: PreparedImageEvidence; layout: EvidenceImageLayout }[] }
  | { kind: "original"; source: PDFDocument; bytes: Uint8Array; index: number; title: string };

export interface PortfolioPlan {
  pages: PortfolioPlannedPage[];
  warnings: PortfolioExportResult["warnings"];
}

/**
 * Creates a self-contained portfolio PDF in the browser. Evidence files are supplied by
 * the caller so tests can use local synthetic fixtures without contacting Supabase.
 */
export async function planPortfolioPages(input: PortfolioExportInput): Promise<PortfolioPlan> {
  const generatedAt = input.generatedAt ?? new Date();
  const prepared: PreparedEvidence[] = [];
  for (const attachment of input.attachments) prepared.push(await prepareAttachment(attachment));

  const evidenceByStandard = new Map<string, PreparedEvidence[]>();
  for (const evidence of prepared) {
    const rows = evidenceByStandard.get(evidence.evidence.standard_id) ?? [];
    rows.push(evidence);
    rows.sort((a, b) => {
      const ai = a.evidence.indicator_index ?? Number.MAX_SAFE_INTEGER;
      const bi = b.evidence.indicator_index ?? Number.MAX_SAFE_INTEGER;
      return ai - bi || a.evidence.created_at.localeCompare(b.evidence.created_at);
    });
    evidenceByStandard.set(evidence.evidence.standard_id, rows);
  }

  const standardById = new Map(input.standards.map((standard) => [standard.id, standard]));
  const sectionIds = new Set([...input.standards.map((standard) => standard.id), ...evidenceByStandard.keys()]);
  const sections: ExportSection[] = [...sectionIds].map((id) => {
    const standard = standardById.get(id) ?? null;
    return {
      id,
      standard,
      title: standard?.title ?? "معيار غير متاح",
      evidences: evidenceByStandard.get(id) ?? [],
      startPage: 0,
      target: evidenceLayoutFor(input.evidenceLayout, id),
    };
  });
  sections.sort((a, b) => {
    const aOrder = a.standard ? input.standards.findIndex((standard) => standard.id === a.id) : Number.MAX_SAFE_INTEGER;
    const bOrder = b.standard ? input.standards.findIndex((standard) => standard.id === b.id) : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.title.localeCompare(b.title, "ar");
  });
  for (const section of sections) {
    for (const evidence of section.evidences) {
      if (evidence.kind === "image") await prepareImagePage(section, evidence);
    }
  }
  const tocPageCount = Math.max(1, Math.ceil(sections.length / TOC_ROWS_PER_PAGE));
  const teacherPageCount = teacherInformationPageCount(input.profile);
  const pageMap = buildPageMap(sections, tocPageCount, teacherPageCount);
  const closingPage = pageMap.closingPage;
  const finalPageCount = closingPage;

  const pages: PortfolioPlannedPage[] = [];
  const generated = (content: string, heading: string | undefined, frame: ExportPageFrame) => {
    pages.push({ kind: "generated", content, heading, frame, images: [] });
  };

  generated(buildCover(input.profile, generatedAt, input.cover), undefined, addPageFrame(1, finalPageCount));
  for (let pageIndex = 0; pageIndex < teacherPageCount; pageIndex++) {
    generated(
        buildTeacherInformation(input.profile, pageIndex, teacherPageCount),
        pageIndex === 0 ? "السيرة الذاتية" : "السيرة الذاتية · تكملة",
        addPageFrame(2 + pageIndex, finalPageCount),
    );
  }
  const introductionPage = 2 + teacherPageCount;
  generated(buildIntroduction(), "مقدمة وأهداف الملف", addPageFrame(introductionPage, finalPageCount));
  generated(buildEducationalObjectives(), "أهداف التعليم في المملكة", addPageFrame(introductionPage + 1, finalPageCount));
  const summaryStandards = input.summaryStandards ?? input.standards;
  const overviewPage = introductionPage + 2;
  generated(
      buildOverview(
        summaryStandards,
        input.progress,
        prepared.map((item) => ({ standard_id: item.evidence.standard_id })),
      ),
      "ملخص الإنجاز",
      addPageFrame(overviewPage, finalPageCount),
  );
  for (let index = 0; index < tocPageCount; index++) {
    const pageNumber = overviewPage + 1 + index;
    generated(buildContentsPage(sections, index, tocPageCount), "فهرس المعايير", addPageFrame(pageNumber, finalPageCount));
  }

  const warnings: PortfolioExportResult["warnings"] = [];
  let completed = 0;
  const total = prepared.length;
  let pageNumber = overviewPage + 1 + tocPageCount;
  const appendSectionEvidence = async (section: ExportSection) => {
    for (const batch of evidenceBatches(section)) {
      if (batch.kind === "images") {
        pages.push({ kind: "generated", content: imagePageMarkup(batch.items), heading: undefined,
          frame: addPageFrame(pageNumber++, finalPageCount), images: batch.items });
        for (const { evidence } of batch.items) {
          const chunks = evidence.pagePlan!.descriptionChunks;
          for (let index = 1; index < chunks.length; index++) {
            generated(
                buildEvidenceMetadata(section, evidence, chunks[index] ?? "", index, chunks.length),
                "تكملة وصف الشاهد",
                addPageFrame(pageNumber++, finalPageCount),
            );
          }
          completed++;
          input.onProgress?.(completed, total);
        }
        continue;
      }
      const evidence = batch.evidence;
      if (evidence.kind === "unavailable") {
        generated(
            buildUnavailablePage(section, evidence),
            "تنبيه بشأن مرفق",
            addPageFrame(pageNumber++, finalPageCount),
        );
        warnings.push({ fileName: evidence.evidence.file_name, standardTitle: section.title });
      } else {
        const descriptionChunks = splitEvidenceDescription(evidence.evidence.description);
        const metadataPageCount = Math.max(1, descriptionChunks.length);
        for (let page = 0; page < metadataPageCount; page++) {
          generated(
              buildEvidenceMetadata(
                section,
                evidence,
                descriptionChunks[page] ?? "",
                page,
                metadataPageCount,
              ),
              page === 0 ? "بيانات الشاهد" : "تكملة بيانات الشاهد",
              addPageFrame(pageNumber++, finalPageCount),
          );
        }
        for (const index of evidence.source.getPageIndices()) {
          pages.push({ kind: "original", source: evidence.source, bytes: evidence.bytes, index, title: evidence.evidence.indicator_text || "شاهد" });
          pageNumber++;
        }
      }
      completed++;
      input.onProgress?.(completed, total);
    }
  };

  for (const [index, section] of sections.entries()) {
    generated(buildStandardPage(section, input.progress, index + 1), undefined, addPageFrame(pageNumber++, finalPageCount));
    await appendSectionEvidence(section);
  }

  generated(
      buildRoyalClosing(),
      "ختام الملف",
      addPageFrame(closingPage, finalPageCount),
  );
  if (pages.length !== finalPageCount) throw new Error("Portfolio pagination mismatch.");
  return { pages, warnings };
}

/** Preview and download consume exactly the same measured, numbered page plan. */
export async function createPortfolioPdf(input: PortfolioExportInput): Promise<PortfolioExportResult> {
  const plan = await planPortfolioPages(input);
  const documentPdf = await PDFDocument.create();
  documentPdf.setTitle("ملف الإنجاز الوظيفي — إنجازي");
  if (input.profile?.full_name) documentPdf.setAuthor(input.profile.full_name);
  for (let index = 0; index < plan.pages.length; index++) {
    const page = plan.pages[index]!;
    if (page.kind === "original") {
      const indices = [page.index];
      while (index + 1 < plan.pages.length) {
        const next = plan.pages[index + 1]!;
        if (next.kind !== "original" || next.source !== page.source) break;
        indices.push(next.index);
        index++;
      }
      const copied = await documentPdf.copyPages(page.source, indices);
      for (const original of copied) documentPdf.addPage(original);
    } else {
      await addRasterPage(documentPdf, await renderPortfolioPage(page.content, page.heading, page.frame));
      await embedEvidenceImages(documentPdf, page.images);
    }
    input.onPageProgress?.(index + 1, plan.pages.length);
  }
  const bytes = await documentPdf.save();
  return { bytes, warnings: plan.warnings, pageCount: documentPdf.getPageCount() };
}
