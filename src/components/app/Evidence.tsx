import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signedUrlQuery, type Evidence, type Standard } from "@/lib/queries";
import {
  deleteEvidenceSafely,
  replaceEvidenceFileSafely,
  saveEvidenceWithFile,
} from "@/lib/evidence-operations";
import {
  EVIDENCE_ACCEPT,
  MAX_DESCRIPTION_LENGTH,
  MAX_FILES_PER_UPLOAD,
  MAX_TITLE_LENGTH,
  buildEvidencePath,
  formatBytes,
  formatEvidenceDate,
  isImage,
  isPdf,
  normalizeEvidenceFields,
  splitEvidenceFiles,
  todayISO,
  validateEvidenceFile,
} from "@/lib/evidence-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const BUCKET = "evidence";
const MAX_PREVIEW_PAGES = 30;

function resolveEvidenceTitle(indicatorText: string | null | undefined, fallback = "شاهد") {
  const clean = (indicatorText ?? "").trim();
  return (clean || fallback).slice(0, MAX_TITLE_LENGTH);
}

/* ------------------------------------------------------------------ */
/* Upload (multiple files)                                             */
/* ------------------------------------------------------------------ */

interface QueuedFile {
  key: string;
  file: File;
  description: string;
  date: string;
  error?: string | undefined;
}

async function uploadOne(
  userId: string,
  standardId: string,
  indicators: string[],
  indicatorIndex: number | null,
  item: QueuedFile,
): Promise<void> {
  const check = validateEvidenceFile(item.file);
  if (!check.ok) throw new Error(check.error);
  const indicatorText = indicatorIndex === null ? null : (indicators[indicatorIndex] ?? null);
  const autoTitle = resolveEvidenceTitle(indicatorText, "شاهد المعيار");
  const fields = normalizeEvidenceFields({
    title: autoTitle,
    description: item.description,
    date: item.date,
  });
  if (!fields.ok) throw new Error(fields.error);
  const path = buildEvidencePath(userId, check.ext);
  await saveEvidenceWithFile({
    upload: () =>
      supabase.storage
        .from(BUCKET)
        .upload(path, item.file, { contentType: check.mimeType, upsert: false }),
    save: () =>
      supabase.from("evidences").insert({
        user_id: userId,
        standard_id: standardId,
        indicator_index: indicatorIndex,
        indicator_text: indicatorText,
        ...fields.value,
        file_path: path,
        file_name: item.file.name.slice(0, 255),
        mime_type: check.mimeType,
        file_size: item.file.size,
      }),
    removeNewFile: () => supabase.storage.from(BUCKET).remove([path]),
  });
}

export function EvidenceUploader({
  userId,
  standardId,
  indicators,
  selectedIndicatorIndex = null,
}: {
  userId: string;
  standardId: string;
  indicators: string[];
  selectedIndicatorIndex?: number | null;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  const activeIndicatorText =
    selectedIndicatorIndex !== null ? (indicators[selectedIndicatorIndex] ?? null) : null;

  function add(list: FileList | null) {
    if (!list?.length) return;
    const { accepted, rejected } = splitEvidenceFiles(Array.from(list), queue.length);
    rejected.forEach((r) => toast.error(`${r.name}: ${r.error}`));
    const today = todayISO();
    setQueue((q) => [
      ...q,
      ...accepted.map((file) => ({
        key: crypto.randomUUID(),
        file,
        description: "",
        date: today,
      })),
    ]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function patch(key: string, change: Partial<QueuedFile>) {
    setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...change, error: undefined } : it)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!queue.length) return;
    if (indicators.length > 0 && selectedIndicatorIndex === null) {
      toast.error("اختر البند من الأعلى أولاً.");
      return;
    }
    for (const it of queue) {
      const r = normalizeEvidenceFields({
        title: resolveEvidenceTitle(activeIndicatorText, "شاهد المعيار"),
        description: it.description,
        date: it.date,
      });
      if (!r.ok) {
        toast.error(`${it.file.name}: ${r.error}`);
        return;
      }
    }
    setBusy({ done: 0, total: queue.length });
    const failed: QueuedFile[] = [];
    let ok = 0;
    for (const [i, it] of queue.entries()) {
      try {
        await uploadOne(userId, standardId, indicators, selectedIndicatorIndex, it);
        ok++;
      } catch (err) {
        failed.push({ ...it, error: (err as Error).message });
      }
      setBusy({ done: i + 1, total: queue.length });
    }
    setQueue(failed);
    setBusy(null);
    if (ok) toast.success(ok === 1 ? "تمت إضافة الشاهد للبند المحدد." : `تمت إضافة ${ok} شواهد.`);
    if (failed.length) toast.error(`تعذر رفع ${failed.length} من الملفات. راجع القائمة وحاول مرة أخرى.`);
    await queryClient.invalidateQueries({ queryKey: ["evidences"] });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border-2 border-primary/30 bg-card p-4 shadow-soft sm:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-primary">إضافة شاهد للبند المختار</p>
        {activeIndicatorText && (
          <h3 className="text-base font-bold leading-relaxed text-primary-deep">
            {selectedIndicatorIndex! + 1}. {activeIndicatorText}
          </h3>
        )}
      </div>

      <label
        htmlFor={`file-${standardId}`}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary-soft/40 px-4 py-6 text-center transition-colors hover:bg-primary-soft/70"
      >
        <UploadCloud className="size-7 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">اضغط لاختيار صور أو ملفات PDF (يمكن اختيار أكثر من ملف)</span>
        <span className="text-xs text-muted-foreground">
          JPG، PNG، WEBP، PDF — حتى 10 ميجابايت للملف، و{MAX_FILES_PER_UPLOAD} ملفات في كل دفعة
        </span>
        <input
          ref={inputRef}
          id={`file-${standardId}`}
          type="file"
          multiple
          accept={EVIDENCE_ACCEPT}
          className="sr-only"
          disabled={busy !== null}
          onChange={(e) => add(e.target.files)}
        />
      </label>

      {queue.length > 0 && (
        <ul className="space-y-3" aria-label="الملفات المختارة">
          {queue.map((it) => (
            <li key={it.key} className="space-y-3 rounded-xl border border-border bg-background p-3.5">
              <div className="flex items-center gap-2">
                {isImage(it.file.type) ? (
                  <ImageIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
                  {it.file.name}
                </span>
                <span className="text-xs text-muted-foreground">{formatBytes(it.file.size)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={busy !== null}
                  aria-label={`إزالة ${it.file.name}`}
                  onClick={() => setQueue((q) => q.filter((x) => x.key !== it.key))}
                >
                  <X />
                </Button>
              </div>
              {it.error && <p className="text-xs text-destructive">{it.error}</p>}

              <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={`d-${it.key}`}>تاريخ الشاهد</Label>
                  <Input
                    id={`d-${it.key}`}
                    type="date"
                    value={it.date}
                    onChange={(e) => patch(it.key, { date: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`s-${it.key}`}>ملاحظة أو وصف (اختياري)</Label>
                  <Textarea
                    id={`s-${it.key}`}
                    rows={1}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    value={it.description}
                    onChange={(e) => patch(it.key, { description: e.target.value })}
                    className="min-h-10"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="submit" className="w-full sm:w-auto" disabled={busy !== null || queue.length === 0}>
        {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />}
        {busy
          ? `جارٍ الرفع ${busy.done} من ${busy.total}`
          : queue.length > 1
            ? `رفع ${queue.length} شواهد`
            : "رفع الشاهد"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Thumbnails & preview                                                */
/* ------------------------------------------------------------------ */

const pdfThumbQuery = (path: string) => ({
  queryKey: ["pdf-thumb", path],
  queryFn: async (): Promise<string> => {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) throw error;
    const { openPdf, renderPdfPage } = await import("@/lib/pdf-render");
    const doc = await openPdf(await data.arrayBuffer());
    try {
      return (await renderPdfPage(doc, 1, 480)).dataUrl;
    } finally {
      await doc.destroy();
    }
  },
  staleTime: Infinity,
  retry: 1,
});

export function EvidenceThumb({ evidence, className }: { evidence: Evidence; className?: string }) {
  const image = isImage(evidence.mime_type);
  const pdf = isPdf(evidence.mime_type);
  const label = evidence.indicator_text || evidence.file_name || "شاهد";
  const { data: url } = useQuery({ ...signedUrlQuery(evidence.file_path), enabled: image });
  const { data: pdfThumb } = useQuery({ ...pdfThumbQuery(evidence.file_path), enabled: pdf });
  const src = image ? url : pdfThumb;
  if (src) {
    return <img src={src} alt={label} className={`bg-secondary ${className ?? ""}`} loading="lazy" />;
  }
  return (
    <div className={`grid place-items-center bg-secondary text-primary ${className ?? ""}`}>
      {image ? <ImageIcon className="size-8" aria-hidden="true" /> : <FileText className="size-8" aria-hidden="true" />}
    </div>
  );
}

function PdfPages({ path, title }: { path: string; title: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(path);
        if (error) throw error;
        const { openPdf, renderPdfPage } = await import("@/lib/pdf-render");
        const doc = await openPdf(await data.arrayBuffer());
        destroy = () => doc.destroy();
        if (cancelled) return;
        setTotal(doc.numPages);
        const width = Math.min(1400, Math.round(Math.min(window.innerWidth, 900) * (window.devicePixelRatio || 1)));
        for (let p = 1; p <= Math.min(doc.numPages, MAX_PREVIEW_PAGES); p++) {
          const img = await renderPdfPage(doc, p, width);
          if (cancelled) return;
          setPages((prev) => [...prev, img.dataUrl]);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setFailed(true);
      } finally {
        if (destroy) await destroy().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) return <p className="py-8 text-center text-sm text-destructive">تعذر عرض ملف PDF.</p>;
  return (
    <div className="space-y-3">
      {pages.map((src, i) => (
        <figure key={i} className="space-y-1">
          <img src={src} alt={`${title} — صفحة ${i + 1}`} className="w-full rounded-lg border border-border bg-background" />
          <figcaption className="text-center text-xs text-muted-foreground">
            صفحة {i + 1} من {total}
          </figcaption>
        </figure>
      ))}
      {(total === null || pages.length < Math.min(total, MAX_PREVIEW_PAGES)) && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ تجهيز الصفحات…
        </div>
      )}
      {total !== null && total > MAX_PREVIEW_PAGES && pages.length === MAX_PREVIEW_PAGES && (
        <p className="text-center text-xs text-muted-foreground">
          تُعرض أول {MAX_PREVIEW_PAGES} صفحة فقط. افتح الملف الأصلي لعرض الباقي.
        </p>
      )}
    </div>
  );
}

function EvidencePreview({ evidence, onClose }: { evidence: Evidence; onClose: () => void }) {
  const queryClient = useQueryClient();
  const image = isImage(evidence.mime_type);
  const label = evidence.indicator_text || "شاهد المعيار";
  const { data: url, isError } = useQuery({ ...signedUrlQuery(evidence.file_path), enabled: image });

  async function openOriginal() {
    const win = window.open("", "_blank");
    try {
      const signed = await queryClient.fetchQuery(signedUrlQuery(evidence.file_path));
      if (win) win.location.href = signed;
      else window.location.href = signed;
    } catch {
      win?.close();
      toast.error("تعذر فتح الملف.");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-right">
          <DialogTitle className="leading-relaxed">{label}</DialogTitle>
          <DialogDescription>
            {formatEvidenceDate(evidence.evidence_date ?? evidence.created_at)} · {formatBytes(evidence.file_size)}
          </DialogDescription>
        </DialogHeader>
        {evidence.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{evidence.description}</p>
        )}
        {image ? (
          url ? (
            <img src={url} alt={label} className="mx-auto max-h-[70vh] w-auto rounded-lg border border-border" />
          ) : isError ? (
            <p className="py-8 text-center text-sm text-destructive">تعذر عرض الصورة.</p>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )
        ) : (
          <PdfPages path={evidence.file_path} title={label} />
        )}
        <div>
          <Button size="sm" variant="outline" onClick={openOriginal}>
            <ExternalLink /> فتح الملف الأصلي
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Edit & replace                                                      */
/* ------------------------------------------------------------------ */

function EvidenceEditor({
  evidence,
  standards,
  currentStandard,
  onClose,
}: {
  evidence: Evidence;
  standards: Standard[];
  currentStandard: Standard;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(evidence.description ?? "");
  const [date, setDate] = useState(evidence.evidence_date ?? evidence.created_at.slice(0, 10));
  const [standardId, setStandardId] = useState(evidence.standard_id);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(evidence.indicator_index ?? null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const standardOptions = standards.some((standard) => standard.id === currentStandard.id)
    ? standards
    : [currentStandard, ...standards];

  const selectedStandardIndicators = standardOptions.find((item) => item.id === standardId)?.indicators ?? [];

  function pick(f: File | undefined) {
    if (!f) return;
    const check = validateEvidenceFile(f);
    if (!check.ok) {
      toast.error(check.error);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setReplacement(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedStandardIndicators.length > 0 && indicatorIndex === null) {
      toast.error("اختر البند المرتبط بالشاهد.");
      return;
    }
    const indicatorText = indicatorIndex === null ? null : (selectedStandardIndicators[indicatorIndex] ?? null);
    const fields = normalizeEvidenceFields({
      title: resolveEvidenceTitle(indicatorText, evidence.title || "شاهد المعيار"),
      description,
      date,
    });
    if (!fields.ok) {
      toast.error(fields.error);
      return;
    }
    setSaving(true);
    try {
      if (replacement) {
        const check = validateEvidenceFile(replacement);
        if (!check.ok) throw new Error(check.error);
        const newPath = buildEvidencePath(evidence.user_id, check.ext);
        const fileFields = {
          file_path: newPath,
          file_name: replacement.name.slice(0, 255),
          mime_type: check.mimeType,
          file_size: replacement.size,
        };
        const result = await replaceEvidenceFileSafely({
          uploadNewFile: () =>
            supabase.storage
              .from(BUCKET)
              .upload(newPath, replacement, { contentType: check.mimeType, upsert: false }),
          saveChanges: async () => {
            const { data, error } = await supabase
              .from("evidences")
              .update({
                ...fields.value,
                standard_id: standardId,
                indicator_index: indicatorIndex,
                indicator_text: indicatorText,
                ...fileFields,
              })
              .eq("id", evidence.id)
              .eq("user_id", evidence.user_id)
              .select("id")
              .maybeSingle();
            return { data, error: error ?? (data ? null : new Error("Evidence row was not updated")) };
          },
          removeNewFile: () => supabase.storage.from(BUCKET).remove([newPath]),
          removeOldFile: () => supabase.storage.from(BUCKET).remove([evidence.file_path]),
        });
        queryClient.removeQueries({ queryKey: ["signed-url", evidence.file_path] });
        queryClient.removeQueries({ queryKey: ["pdf-thumb", evidence.file_path] });
        if (result.oldFileCleanupFailed) {
          toast.warning("تم حفظ التعديل والملف الجديد، لكن تعذر تنظيف النسخة السابقة.");
        } else {
          toast.success("تم استبدال الملف وحفظ التعديلات.");
        }
      } else {
        const { data, error } = await supabase
          .from("evidences")
          .update({
            ...fields.value,
            standard_id: standardId,
            indicator_index: indicatorIndex,
            indicator_text: indicatorText,
          })
          .eq("id", evidence.id)
          .eq("user_id", evidence.user_id)
          .select("id")
          .maybeSingle();
        if (error || !data) throw new Error("تعذر حفظ التعديلات.");
        toast.success("تم حفظ التعديلات.");
      }
      await queryClient.invalidateQueries({ queryKey: ["evidences"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent dir="rtl" className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader className="text-right">
          <DialogTitle>تعديل الشاهد</DialogTitle>
          <DialogDescription>اختر البند المناسب أو استبدل الملف المرفق.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-standard">المعيار المرتبط بالشاهد</Label>
            <select
              id="edit-standard"
              value={standardId}
              onChange={(event) => {
                setStandardId(event.target.value);
                setIndicatorIndex(null);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {standardOptions.map((standard) => (
                <option value={standard.id} key={standard.id}>
                  {standard.code} · {standard.title}
                </option>
              ))}
            </select>
          </div>
          {selectedStandardIndicators.length > 0 && (
            <div className="space-y-2">
              <Label>البند المرتبط بالشاهد</Label>
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                {selectedStandardIndicators.map((indicator, index) => {
                  const selected = indicatorIndex === index;
                  return (
                    <button
                      key={`${index}-${indicator}`}
                      type="button"
                      onClick={() => setIndicatorIndex(index)}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border p-2.5 text-right text-sm transition-all",
                        selected
                          ? "border-primary bg-primary-soft/70 font-semibold text-primary-deep"
                          : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      {selected ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <span className="leading-relaxed">
                        <span className="ml-1 font-bold text-primary">{index + 1}.</span>
                        {indicator}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">تاريخ الشاهد</Label>
            <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">ملاحظة أو وصف (اختياري)</Label>
            <Textarea
              id="edit-desc"
              rows={2}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-medium">الملف المرفق</p>
            <p className="truncate text-xs text-muted-foreground" dir="auto">
              {replacement ? `الملف الجديد: ${replacement.name} (${formatBytes(replacement.size)})` : evidence.file_name}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" variant="soft" onClick={() => fileRef.current?.click()} disabled={saving}>
                <RefreshCw /> استبدال الملف
              </Button>
              {replacement && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    setReplacement(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  تراجع عن الاستبدال
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={EVIDENCE_ACCEPT}
              className="sr-only"
              aria-label="اختيار ملف بديل"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              حفظ
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function EvidenceCard({
  evidence,
  standards,
  currentStandard,
}: {
  evidence: Evidence;
  standards: Standard[];
  currentStandard: Standard;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"preview" | "edit" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const label = evidence.indicator_text || "شاهد المعيار";

  async function remove() {
    setDeleting(true);
    try {
      await deleteEvidenceSafely({
        downloadBackup: async () => {
          const { data, error } = await supabase.storage.from(BUCKET).download(evidence.file_path);
          return { data, error };
        },
        removeStoredFile: () => supabase.storage.from(BUCKET).remove([evidence.file_path]),
        deleteRecord: async () => {
          const { data, error } = await supabase
            .from("evidences")
            .delete()
            .eq("id", evidence.id)
            .eq("user_id", evidence.user_id)
            .select("id")
            .maybeSingle();
          return { data, error: error ?? (data ? null : new Error("Evidence row was not deleted")) };
        },
        restoreStoredFile: (backup) =>
          supabase.storage.from(BUCKET).upload(evidence.file_path, backup, {
            contentType: evidence.mime_type,
            upsert: true,
          }),
      });
      queryClient.removeQueries({ queryKey: ["signed-url", evidence.file_path] });
      queryClient.removeQueries({ queryKey: ["pdf-thumb", evidence.file_path] });
      toast.success("تم حذف الشاهد وملفه.");
      await queryClient.invalidateQueries({ queryKey: ["evidences"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <button type="button" className="block w-full" onClick={() => setMode("preview")} aria-label={`معاينة ${label}`}>
        <EvidenceThumb evidence={evidence} className="aspect-[4/3] w-full object-cover object-top" />
      </button>
      <div className="space-y-2 p-4">
        {evidence.description && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{evidence.description}</p>
        )}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {formatEvidenceDate(evidence.evidence_date ?? evidence.created_at)} ·{" "}
          {isPdf(evidence.mime_type) ? "PDF" : "صورة"} · {formatBytes(evidence.file_size)}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button size="sm" variant="soft" onClick={() => setMode("preview")}>
            <Eye /> معاينة
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("edit")}>
            <Pencil /> تعديل
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={deleting} aria-label="حذف الشاهد">
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                حذف
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الشاهد؟</AlertDialogTitle>
                <AlertDialogDescription>سيتم حذف الشاهد وملفه نهائيًا ولا يمكن التراجع.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>حذف</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {mode === "preview" && <EvidencePreview evidence={evidence} onClose={() => setMode(null)} />}
      {mode === "edit" && (
        <EvidenceEditor
          evidence={evidence}
          standards={standards}
          currentStandard={currentStandard}
          onClose={() => setMode(null)}
        />
      )}
    </article>
  );
}
