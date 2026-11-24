export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_UPLOAD = 10;

export const ALLOWED_EVIDENCE_TYPES: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

export const EVIDENCE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export type EvidenceFileCheck =
  | { ok: true; ext: string; mimeType: string }
  | { ok: false; error: string };

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function validateEvidenceFile(file: { name: string; type: string; size: number }): EvidenceFileCheck {
  const ext = fileExtension(file.name);
  const allowedExts = ALLOWED_EVIDENCE_TYPES[file.type];
  if (!allowedExts || !allowedExts.includes(ext)) {
    return { ok: false, error: "نوع الملف غير مدعوم. المسموح: صور (JPG، PNG، WEBP) أو ملفات PDF." };
  }
  if (file.size <= 0) return { ok: false, error: "الملف فارغ." };
  if (file.size > MAX_EVIDENCE_BYTES) {
    return { ok: false, error: "حجم الملف يتجاوز 10 ميجابايت." };
  }
  return { ok: true, ext, mimeType: file.type };
}

/** Storage path: the first folder must be the owner's user id (enforced by storage policies). */
export function buildEvidencePath(userId: string, ext: string, id: string = crypto.randomUUID()): string {
  return `${userId}/${id}.${ext}`;
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

/** Default evidence title from a file name: drop the extension, tidy separators, cap at 120 chars. */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "شاهد").slice(0, 120);
}

/** Today's date in the user's local time zone as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local date (avoids the UTC off-by-one of `new Date("2026-01-15")`). */
export function parseISODate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatEvidenceDate(iso: string | null | undefined): string {
  const d = parseISODate(iso);
  if (!d) return "";
  return d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" });
}

/** Chronological order for the printed portfolio: evidence date, then upload time. */
export function compareEvidenceChronological(
  a: { evidence_date: string | null; created_at: string },
  b: { evidence_date: string | null; created_at: string },
): number {
  const da = a.evidence_date ?? a.created_at.slice(0, 10);
  const db = b.evidence_date ?? b.created_at.slice(0, 10);
  if (da !== db) return da < db ? -1 : 1;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

export interface RejectedFile {
  name: string;
  error: string;
}

/** Split a picked batch into files we can upload and files we must reject (type/size/batch cap). */
export function splitEvidenceFiles<T extends { name: string; type: string; size: number }>(
  files: T[],
  alreadyQueued = 0,
): { accepted: T[]; rejected: RejectedFile[] } {
  const accepted: T[] = [];
  const rejected: RejectedFile[] = [];
  for (const f of files) {
    const check = validateEvidenceFile(f);
    if (!check.ok) rejected.push({ name: f.name, error: check.error });
    else if (alreadyQueued + accepted.length >= MAX_FILES_PER_UPLOAD)
      rejected.push({ name: f.name, error: `الحد الأقصى ${MAX_FILES_PER_UPLOAD} ملفات في كل دفعة.` });
    else accepted.push(f);
  }
  return { accepted, rejected };
}

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;

export type EvidenceFieldsCheck =
  | { ok: true; value: { title: string; description: string | null; evidence_date: string } }
  | { ok: false; error: string };

/** Validate and normalise the editable fields of an evidence item. */
export function normalizeEvidenceFields(input: {
  title: string;
  description: string;
  date: string;
}): EvidenceFieldsCheck {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "اكتب عنوانًا للشاهد." };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: "العنوان طويل جدًا (200 حرف كحد أقصى)." };
  const description = input.description.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH)
    return { ok: false, error: "الوصف طويل جدًا (2000 حرف كحد أقصى)." };
  const d = parseISODate(input.date);
  if (!d || todayISO(d) !== input.date) return { ok: false, error: "اختر تاريخًا صحيحًا للشاهد." };
  return { ok: true, value: { title, description: description || null, evidence_date: input.date } };
}
