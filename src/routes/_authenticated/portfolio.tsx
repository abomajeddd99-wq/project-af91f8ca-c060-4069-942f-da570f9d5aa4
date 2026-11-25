import { PORTFOLIO_TEMPLATES, getPortfolioTheme, type PortfolioTemplateId } from "@/lib/portfolio-theme";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allStandardsQuery, evidencesQuery, profileQuery, progressQuery, standardsQuery } from "@/lib/queries";
import { computeEvidenceCoverage, computeManualProgress, statusFor, STATUS_LABELS } from "@/lib/progress";
import { compareEvidenceChronological, isImage } from "@/lib/evidence-files";
import { LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { createPortfolioPdf, type PortfolioCoverOptions, type DownloadedEvidence } from "@/lib/portfolio-export";
import { defaultEvidenceLayout, parseEvidenceLayout } from "@/lib/portfolio-layout-preferences";
import { EvidenceLayoutControls } from "@/components/portfolio/EvidenceLayoutControls";
import { PortfolioA4Preview } from "@/components/portfolio/PortfolioA4Preview";

const NO_ATTACHMENTS: DownloadedEvidence[] = [];

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "ملف الإنجاز للطباعة — إنجازي" },
      { name: "description", content: "معاينة ملف الإنجاز وطباعته أو حفظه بصيغة PDF." },
      { property: "og:title", content: "ملف الإنجاز للطباعة — إنجازي" },
      { property: "og:description", content: "معاينة ملف الإنجاز وطباعته أو حفظه بصيغة PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(standardsQuery()),
      context.queryClient.ensureQueryData(allStandardsQuery()),
      context.queryClient.ensureQueryData(progressQuery()),
      context.queryClient.ensureQueryData(evidencesQuery()),
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
    ]),
  component: Portfolio,
});

function Portfolio() {
  const { user } = Route.useRouteContext();
  const { data: standards } = useSuspenseQuery(standardsQuery());
  const { data: allStandards } = useSuspenseQuery(allStandardsQuery());
  const { data: progress } = useSuspenseQuery(progressQuery());
  const { data: evidences } = useSuspenseQuery(evidencesQuery());
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const [showEmpty, setShowEmpty] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [exportError, setExportError] = useState("");
  const [evidenceLayout, setEvidenceLayout] = useState(defaultEvidenceLayout);
  const [preferencesLoaded, setPreferencesLoaded] = useState("");
  const [preferenceWarning, setPreferenceWarning] = useState("");
  const [generatedAt] = useState(() => new Date());
  const preferenceKey = `injazi:portfolio-layout:${user.id}`;
  useEffect(() => {
    try {
      setEvidenceLayout(parseEvidenceLayout(localStorage.getItem(preferenceKey)));
    } catch {
      setEvidenceLayout(defaultEvidenceLayout());
      setPreferenceWarning("تعذر قراءة التفضيلات المحلية؛ سيُستخدم التخطيط الافتراضي.");
    }
    setPreferencesLoaded(preferenceKey);
  }, [preferenceKey]);
  useEffect(() => {
    if (preferencesLoaded !== preferenceKey) return;
    try { localStorage.setItem(preferenceKey, JSON.stringify(evidenceLayout)); }
    catch { setPreferenceWarning("التخطيط يعمل لهذه الجلسة، لكن المتصفح لا يسمح بحفظ التفضيلات."); }
  }, [evidenceLayout, preferenceKey, preferencesLoaded]);
  const [cover, setCover] = useState<PortfolioCoverOptions>({
    layout: "royal",
    accent: "gold",
    template: "ministerial" as PortfolioTemplateId,
    title: "ملف شواهد الأداء الوظيفي",
  });
  const [includeCv, setIncludeCv] = useState(true);
  const [includeObjectives, setIncludeObjectives] = useState(true);
  const selectedTheme = getPortfolioTheme(cover.template);
  const summary = computeManualProgress(standards, progress);
  const evidenceCoverage = computeEvidenceCoverage(standards, evidences);

  const imagePaths = evidences.filter((e) => isImage(e.mime_type)).map((e) => e.file_path);
  const { data: urls } = useQuery({
    queryKey: ["signed-urls", imagePaths],
    enabled: imagePaths.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("evidence").createSignedUrls(imagePaths, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      return map;
    },
  });

  const today = new Date();
  const hijri = today.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" });
  const greg = today.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" });
  const roleStandardIds = useMemo(() => new Set(standards.map((s) => s.id)), [standards]);
  const roleEvidences = useMemo(() => evidences.filter((e) => roleStandardIds.has(e.standard_id)), [evidences, roleStandardIds]);
  const portfolioStandards = useMemo(() => {
    const evidenceIds = new Set(roleEvidences.map((e) => e.standard_id));
    return standards.filter((s) => showEmpty || evidenceIds.has(s.id));
  }, [standards, roleEvidences, showEmpty]);
  const visible = portfolioStandards;
  const hasPlaceholders = standards.some((s) => s.is_placeholder);
  const attachmentQuery = useQuery({
    queryKey: ["portfolio-preview-attachments", user.id, roleEvidences],
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<DownloadedEvidence[]> => {
      const result: DownloadedEvidence[] = [];
      for (const evidence of [...roleEvidences].sort(compareEvidenceChronological)) {
        try {
          const { data, error } = await supabase.storage.from("evidence").download(evidence.file_path);
          if (error) throw error;
          result.push({ evidence, bytes: new Uint8Array(await data.arrayBuffer()) });
        } catch {
          result.push({ evidence, error: "تعذر الوصول إلى الملف في مساحة الشواهد الخاصة." });
        }
      }
      return result;
    },
  });
  const previewInput = useMemo(() => ({
    profile, standards: portfolioStandards, summaryStandards: standards, progress,
    attachments: attachmentQuery.data ?? NO_ATTACHMENTS, generatedAt, evidenceLayout,
    cover: { ...cover, title: cover.title.trim() || "ملف شواهد الأداء الوظيفي" },
    includeCv,
    includeObjectives,
  }), [profile, portfolioStandards, standards, progress, attachmentQuery.data, generatedAt, evidenceLayout, cover, includeCv, includeObjectives]);

  async function exportPortfolio() {
    setExporting(true);
    setExportError("");
    try {
      setExportProgress("جارٍ تجهيز المرفقات…");
      const refreshed = await attachmentQuery.refetch();
      if (!refreshed.data || refreshed.error) throw new Error("Attachment loading failed.");

      const result = await createPortfolioPdf({
        ...previewInput,
        attachments: refreshed.data,
        onPageProgress: (completed, total) => {
          setExportProgress(`جارٍ تجهيز الصفحات ${completed} من ${total}`);
        },
      });
      const blob = new Blob([result.bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
      downloadBlob(blob, "ملف-الإنجاز-إنجازي.pdf");
      if (result.warnings.length) {
        const affectedStandards = result.warnings.map((warning) => warning.standardTitle).join("، ");
        toast.warning(
          `تم تنزيل الملف، لكن تعذر تضمين ${result.warnings.length} مرفق. أُدرج تقرير واضح داخل PDF.`,
          { description: affectedStandards },
        );
      } else {
        toast.success("تم تنزيل ملف الإنجاز بجميع مرفقاته.");
      }
    } catch {
      setExportError("تعذر إنشاء ملف الإنجاز. تحقق من اتصالك ثم أعد المحاولة.");
      toast.error("تعذر إنشاء ملف الإنجاز. لم يتم تغيير أي بيانات.");
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  }

  const info: [string, string | null | undefined][] = [
    ["المسمى الوظيفي", profile?.job_title],
    ["التخصص", profile?.subject],
    ["المرحلة", profile?.stage],
    ["المدرسة", profile?.school],
    ["إدارة التعليم", profile?.education_office],
    ["العام الدراسي", profile?.academic_year],
    ["سنوات الخبرة", profile?.years_experience != null ? String(profile.years_experience) : null],
  ];

  return (
    <div className="space-y-7 animate-rise" dir="rtl">
      <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-6 print:hidden">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary">النسخة المهنية للطباعة</p>
          <h1 className="mt-1 text-2xl font-bold text-primary-deep">ملف الإنجاز والطباعـة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نزّل ملفًا يجمع المعايير والصور وكل صفحات ملفات PDF المرتبطة بها.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="show-empty" checked={showEmpty} onCheckedChange={setShowEmpty} />
              <Label htmlFor="show-empty" className="text-sm">إظهار المعايير بلا شواهد</Label>
            </div>
            <Button variant="hero" onClick={exportPortfolio} disabled={exporting || preferencesLoaded !== preferenceKey} aria-live="polite">
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exporting ? exportProgress || "جارٍ تجهيز PDF…" : "تنزيل ملف PDF"}
            </Button>
          </div>
          {exportError && (
            <p role="alert" className="max-w-sm text-sm text-destructive">{exportError}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] space-y-6 print:max-w-none print:space-y-0">
        <EvidenceLayoutControls preferences={evidenceLayout} onChange={setEvidenceLayout} standards={portfolioStandards} disabled={exporting || preferencesLoaded !== preferenceKey} />
        {preferenceWarning && <p role="status" className="text-sm text-muted-foreground">{preferenceWarning}</p>}
        <PortfolioA4Preview input={previewInput} loading={attachmentQuery.isPending || preferencesLoaded !== preferenceKey} loadError={attachmentQuery.isError} />
        <section className="space-y-6 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6 print:hidden" aria-labelledby="cover-designer-title">
          <div>
            <p className="text-xs font-semibold text-primary">قبل الطباعة والتصدير</p>
            <h2 id="cover-designer-title" className="mt-1 text-lg font-bold text-primary-deep">قالب ملف الإنجاز وصفحاته</h2>
            <p className="mt-1 text-sm text-muted-foreground">اختر القالب المناسب لهويتك؛ سيُطبّق فوراً على الغلاف وصفحات المعايير والشواهد في المعاينة والـ PDF.</p>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-foreground">قالب الملف</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="اختيار قالب ملف الإنجاز">
              {PORTFOLIO_TEMPLATES.map((tpl) => {
                const active = (cover.template ?? "ministerial") === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setCover((current) => ({ ...current, template: tpl.id }))}
                    className={`relative flex items-center gap-3 rounded-2xl border p-3.5 text-right transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "border-primary bg-primary-soft/60 ring-1 ring-primary shadow-sm"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-inner"
                      style={{ background: `linear-gradient(135deg, ${tpl.primary} 50%, ${tpl.accent} 50%)` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{tpl.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{tpl.subtitle}</span>
                    </span>
                    {active && (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                        <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth="2.4">
                          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 border-t border-border pt-5 md:grid-cols-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3.5">
              <div>
                <div className="text-sm font-bold text-foreground">السيرة الذاتية</div>
                <div className="text-xs text-muted-foreground">صفحة بياناتك المهنية ومؤهلاتك بعد الغلاف</div>
              </div>
              <input
                type="checkbox"
                checked={includeCv}
                onChange={(e) => setIncludeCv(e.target.checked)}
                className="size-5 accent-primary"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3.5">
              <div>
                <div className="text-sm font-bold text-foreground">أهداف التعليم في المملكة</div>
                <div className="text-xs text-muted-foreground">صفحة أهداف التعليم وفق رؤية 2030</div>
              </div>
              <input
                type="checkbox"
                checked={includeObjectives}
                onChange={(e) => setIncludeObjectives(e.target.checked)}
                className="size-5 accent-primary"
              />
            </label>

            <div>
              <Label htmlFor="cover-title" className="mb-2 block text-sm font-semibold">عنوان فرعي للغلاف (اختياري)</Label>
              <input
                id="cover-title"
                value={cover.title}
                onChange={(event) => setCover((current) => ({ ...current, title: event.target.value }))}
                maxLength={80}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                dir="auto"
              />
            </div>
          </div>
        </section>

        {/* Cover */}
        <section
          aria-label="معاينة غلاف ملف الإنجاز"
          className={`relative mx-auto aspect-[210/297] w-full overflow-hidden border bg-card p-5 shadow-soft sm:p-10 print:min-h-[265mm] print:aspect-auto print:rounded-none print:border-0 print:shadow-none ${
            cover.layout === "royal" ? "rounded-[1.75rem]" : "rounded-lg"
          }`}
          style={{ borderColor: selectedTheme.accent, backgroundColor: selectedTheme.bg }}
        >
          <div className="absolute inset-0 opacity-40" aria-hidden="true">
            {cover.layout === "royal" && <div className="pattern-dots h-full w-full" />}
          </div>
          <div
            className="absolute inset-x-0 top-0 h-2"
            aria-hidden="true"
            style={{ backgroundColor: selectedTheme.primary }}
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3">
              <LogoMark className="size-11" />
              <span className="font-display text-lg font-bold text-primary-deep">إنجازي</span>
            </div>
            <div className={`my-auto py-6 sm:py-12 ${cover.layout === "classic" ? "text-center" : ""}`}>
              <p className="text-sm font-medium text-primary">المملكة العربية السعودية</p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-primary-deep sm:text-4xl">
                {cover.title.trim() || "ملف الإنجاز الوظيفي"}
              </h2>
              <div
                className={`mt-4 h-1 w-24 rounded-full ${cover.layout === "classic" ? "mx-auto" : ""}`}
                style={{ backgroundColor: selectedTheme.primary }}
              />
              <p className="mt-8 text-xl font-semibold sm:text-2xl">{profile?.full_name || "—"}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:gap-x-6 sm:text-sm">
              {info
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="border-b border-border pb-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
            {profile?.bio && <p className="mt-6 text-sm leading-loose text-muted-foreground">{profile.bio}</p>}
            <p className="mt-8 text-xs text-muted-foreground">
              تاريخ الإصدار: {hijri} — الموافق {greg}
            </p>
            {hasPlaceholders && (
              <p className="mt-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-xs text-warning-foreground">
                تنبيه: المعايير الواردة في هذا الملف تجريبية، وستُستبدل بالمعايير الرسمية المعتمدة.
              </p>
            )}
          </div>
        </section>

        {/* Summary */}
        <section className="print-break rounded-3xl border border-border bg-card p-6 shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="text-xl font-bold text-primary-deep">ملخص الإنجاز</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            الإنجاز الموزون حسب الحالة اليدوية: <strong className="text-foreground">{summary.weightedPercent}٪</strong>
            — المعايير التي حدّدت اكتمالها: {summary.completed} من {summary.total} — تغطية الشواهد:
            {" "}{evidenceCoverage.documented} من {evidenceCoverage.total} معيار ({evidenceCoverage.percent}٪)
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary-soft text-accent-foreground">
                  <th className="border border-border p-2 text-start">#</th>
                  <th className="border border-border p-2 text-start">المعيار</th>
                  <th className="border border-border p-2 text-start">الوزن</th>
                  <th className="border border-border p-2 text-start">الحالة اليدوية</th>
                  <th className="border border-border p-2 text-start">الشواهد</th>
                </tr>
              </thead>
              <tbody>
                {standards.map((s) => (
                  <tr key={s.id} className="print-avoid">
                    <td className="border border-border p-2">{s.code}</td>
                    <td className="border border-border p-2">{s.title}</td>
                    <td className="border border-border p-2">{Number(s.weight)}٪</td>
                    <td className="border border-border p-2">{STATUS_LABELS[statusFor(s.id, progress)]}</td>
                    <td className="border border-border p-2">
                      {evidences.filter((e) => e.standard_id === s.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Standards with evidence */}
        {visible.map((s) => {
          const items = evidences.filter((e) => e.standard_id === s.id);
          const notes = progress.find((p) => p.standard_id === s.id)?.notes;
          const matchesIndicator = (evidence: (typeof items)[number], index: number, indicator: string) =>
            evidence.indicator_text ? evidence.indicator_text === indicator : evidence.indicator_index === index;

          const renderEvidenceFigure = (e: (typeof items)[number], label: string) => (
            <figure key={e.id} className="print-avoid overflow-hidden rounded-2xl border border-border bg-background">
              {isImage(e.mime_type) ? (
                urls?.[e.file_path] ? (
                  <img src={urls[e.file_path]} alt={label} className="max-h-72 w-full bg-secondary object-contain" />
                ) : (
                  <div className="grid h-40 place-items-center bg-secondary text-xs text-muted-foreground">
                    جارٍ تحميل الصورة…
                  </div>
                )
              ) : (
                <div className="flex items-center gap-3 bg-secondary p-4">
                  <FileText className="size-8 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">مرفق PDF</p>
                    <p className="truncate text-sm font-medium" dir="auto">{e.file_name}</p>
                  </div>
                </div>
              )}
              {e.description && (
                <figcaption className="border-t border-border/60 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">{e.description}</p>
                </figcaption>
              )}
            </figure>
          );

          const unlinkedItems = items.filter(
            (e) => !(s.indicators ?? []).some((indicator, index) => matchesIndicator(e, index, indicator)),
          );

          return (
            <section
              key={s.id}
              className="print-break rounded-3xl border border-border bg-card p-6 shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              <div className="flex items-center justify-between gap-3 border-b-2 border-primary pb-3">
                <div>
                  <p className="text-xs font-semibold text-primary">
                    {s.code} · الوزن {Number(s.weight)}٪{s.is_placeholder ? " · معيار تجريبي" : ""}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-primary-deep">{s.title}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-accent-foreground">
                  {STATUS_LABELS[statusFor(s.id, progress)]}
                </span>
              </div>
              {notes && <p className="mt-3 rounded-xl bg-secondary p-3 text-sm leading-relaxed">{notes}</p>}
              {items.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">لا توجد شواهد مرفقة لهذا المعيار.</p>
              ) : (
                <div className="mt-5 space-y-5">
                  {(s.indicators ?? []).map((indicator, index) => {
                    const indicatorItems = items.filter((e) => matchesIndicator(e, index, indicator));
                    if (indicatorItems.length === 0) return null;
                    return (
                      <div key={`${index}-${indicator}`} className="space-y-3 rounded-2xl border border-border/80 bg-background/50 p-4">
                        <div className="flex items-start gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <h3 className="text-sm font-bold leading-relaxed text-primary-deep">{indicator}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
                          {indicatorItems.map((e) => renderEvidenceFigure(e, indicator))}
                        </div>
                      </div>
                    );
                  })}
                  {unlinkedItems.length > 0 && (
                    <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
                      <h3 className="text-sm font-semibold text-muted-foreground">شواهد عامة للمعيار</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
                        {unlinkedItems.map((e) => renderEvidenceFigure(e, s.title))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
