import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { planPortfolioPages, type PortfolioExportInput, type PortfolioPlan, type PortfolioPlannedPage } from "@/lib/portfolio-export";
import { fitStandardCover, portfolioPageMarkup } from "@/lib/portfolio-page-renderer";
import { getPortfolioTheme } from "@/lib/portfolio-theme";

function GeneratedPage({ page }: { page: Extract<PortfolioPlannedPage, { kind: "generated" }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const theme = getPortfolioTheme(page.template);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    setError("");
    const urls: string[] = [];
    root.innerHTML = portfolioPageMarkup(page.content, page.heading, page.frame, page.template);
    root.querySelectorAll<HTMLElement>("[data-evidence-image-slot]").forEach((slot, index) => {
      const item = page.images[index];
      if (!item) return;
      const url = URL.createObjectURL(new Blob([item.evidence.bytes.slice().buffer as ArrayBuffer], { type: item.evidence.mimeType }));
      urls.push(url);
      const image = document.createElement("img");
      image.src = url;
      image.alt = item.evidence.evidence.title;
      image.style.cssText = `display:block;width:100%;height:100%;object-fit:contain;outline:.8px solid ${theme.accent}`;
      slot.append(image);
    });
    void document.fonts?.ready.then(() => {
      if (!cancelled) {
        try { fitStandardCover(root); } catch (cause) {
          setError(cause instanceof Error ? cause.message : "تعذر عرض الصفحة.");
        }
      }
    });
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [page, theme.accent]);

  return <div>
    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    <div ref={ref} lang="ar" dir="rtl" data-a4-preview-page
      style={{ position: "relative", width: 794, height: 1123, overflow: "hidden", boxSizing: "border-box",
        background: theme.bg, color: theme.ink, fontFamily: "'IBM Plex Sans Arabic',system-ui,sans-serif", fontSize: 18, lineHeight: 1.75 }} />
  </div>;
}

function OriginalPage({ page }: { page: Extract<PortfolioPlannedPage, { kind: "original" }> }) {
  const [image, setImage] = useState<{ page: PortfolioPlannedPage; dataUrl: string; width: number; height: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let pdf: Awaited<ReturnType<typeof import("@/lib/pdf-render")["openPdf"]>> | undefined;
    setImage(null);
    setError("");
    void (async () => {
      try {
        const { openPdf, renderPdfPage } = await import("@/lib/pdf-render");
        pdf = await openPdf(page.bytes.slice().buffer as ArrayBuffer);
        if (cancelled) return;
        const result = await renderPdfPage(pdf, page.index + 1, 1100);
        if (!cancelled) setImage({ ...result, page });
      } catch {
        if (!cancelled) setError("تعذر عرض صفحة المرفق الأصلي. يمكنك إعادة المحاولة؛ لن يُحذف المرفق من التصدير.");
      } finally { await pdf?.destroy(); }
    })();
    return () => { cancelled = true; };
  }, [page]);
  if (error) return <p role="alert" className="p-6 text-destructive">{error}</p>;
  return image?.page === page ? <img src={image.dataUrl} alt={`${page.title} — صفحة ${page.index + 1}`} className="mx-auto max-w-full" />
    : <p className="p-6">جارٍ عرض صفحة المرفق الأصلي…</p>;
}

/** No raster export on each click: both preview and PDF consume the same measured page manifest. */
export function PortfolioA4Preview({ input, loading, loadError }: {
  input: PortfolioExportInput; loading?: boolean; loadError?: boolean;
}) {
  const [result, setResult] = useState<{ input: PortfolioExportInput; plan?: PortfolioPlan; error?: string }>();
  const [pageIndex, setPageIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") {
      const resize = () => setWidth(node.clientWidth || 640);
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (loading || loadError) return;
    void planPortfolioPages(input).then((plan) => {
      if (!cancelled) { setResult({ input, plan }); setPageIndex((index) => Math.min(index, plan.pages.length - 1)); }
    }).catch((cause: unknown) => {
      if (!cancelled) setResult({ input, error: cause instanceof Error ? cause.message : "تعذر إعداد المعاينة." });
    });
    return () => { cancelled = true; };
  }, [input, loading, loadError]);
  const current = result?.input === input && !loading && !loadError;
  const plan = current ? result.plan : undefined;
  const page = plan?.pages[pageIndex];
  const scale = Math.min(1, Math.max(0.1, width / 794));
  return <section className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6 print:hidden" dir="rtl" aria-label="معاينة صفحات PDF">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-primary-deep">معاينة A4 المباشرة</h2>
        <p className="mt-1 text-xs text-muted-foreground">نفس القالب والتوزيع وفواصل الصفحات والفهرس عند التصدير. ملفات PDF الأصلية تحتفظ بمقاساتها واتجاهها.</p></div>
      {plan && <div className="flex items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setPageIndex((index) => Math.max(0, index - 1))} disabled={pageIndex === 0}>السابق</Button>
        <label className="flex items-center gap-2 text-sm">الصفحة
          <select aria-label="صفحة المعاينة" className="rounded border border-border bg-background p-1" value={pageIndex} onChange={(event) => setPageIndex(Number(event.target.value))}>
            {plan.pages.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
          </select> من {plan.pages.length}</label>
        <Button type="button" size="sm" variant="outline" onClick={() => setPageIndex((index) => Math.min(plan.pages.length - 1, index + 1))} disabled={pageIndex === plan.pages.length - 1}>التالي</Button>
      </div>}
    </div>
    {loadError ? <p role="alert" className="text-sm text-destructive">تعذر تحميل بيانات المرفقات للمعاينة.</p>
      : !current ? <p role="status" className="text-sm text-muted-foreground">جارٍ تحديث الصفحات وفق القالب والتخطيط المختار…</p>
      : result.error ? <p role="alert" className="text-sm text-destructive">{result.error}</p> : null}
    <div ref={container} aria-busy={!current} className="min-w-0 rounded-xl bg-[#102C28]/10 p-0">
      {page?.kind === "generated" && <div style={{ height: 1123 * scale, width: "100%", overflow: "hidden" }}>
        <div style={{ width: 794, transform: `scale(${scale})`, transformOrigin: "top right", marginLeft: "auto" }}><GeneratedPage page={page} /></div>
      </div>}
      {page?.kind === "original" && <OriginalPage key={pageIndex} page={page} />}
    </div>
  </section>;
}
