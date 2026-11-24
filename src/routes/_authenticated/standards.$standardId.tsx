import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allStandardsQuery, evidencesQuery, progressQuery, standardsQuery } from "@/lib/queries";
import { STATUS_LABELS, STATUS_ORDER, statusFor, type ProgressStatus } from "@/lib/progress";
import { PlaceholderBadge } from "@/components/app/StatusBadge";
import { EvidenceCard, EvidenceUploader } from "@/components/app/Evidence";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/standards/$standardId")({
  head: () => ({
    meta: [
      { title: "تفاصيل المعيار — إنجازي" },
      { name: "description", content: "مؤشرات المعيار وشواهدك المرفقة وحالة الإنجاز." },
      { property: "og:title", content: "تفاصيل المعيار — إنجازي" },
      { property: "og:description", content: "مؤشرات المعيار وشواهدك المرفقة وحالة الإنجاز." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const [standards] = await Promise.all([
      context.queryClient.ensureQueryData(allStandardsQuery()),
      context.queryClient.ensureQueryData(standardsQuery()),
      context.queryClient.ensureQueryData(progressQuery()),
      context.queryClient.ensureQueryData(evidencesQuery()),
    ]);
    if (!standards.some((s) => s.id === params.standardId)) throw notFound();
  },
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">المعيار غير موجود.</p>
      <Link to="/standards" className="mt-4 inline-block text-primary hover:underline">
        العودة للمعايير
      </Link>
    </div>
  ),
  component: StandardDetail,
});

function StandardDetail() {
  const { standardId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { data: standards } = useSuspenseQuery(standardsQuery());
  const { data: progress } = useSuspenseQuery(progressQuery());
  const { data: evidences } = useSuspenseQuery(evidencesQuery());
  const { data: historical } = useSuspenseQuery(allStandardsQuery());
  const standard = historical.find((s) => s.id === standardId);
  const canAdd = standards.some((s) => s.id === standardId);
  const status = statusFor(standardId, progress);
  const savedNotes = progress.find((p) => p.standard_id === standardId)?.notes ?? "";
  const [notes, setNotes] = useState(savedNotes);
  const [saving, setSaving] = useState<ProgressStatus | "notes" | null>(null);
  const [selectedIndicatorIndex, setSelectedIndicatorIndex] = useState<number | null>(null);

  const mine = evidences.filter((e) => e.standard_id === standardId);
  const indicators = standard?.indicators ?? [];
  const matchesIndicator = (evidence: (typeof mine)[number], index: number, indicator: string) =>
    evidence.indicator_text ? evidence.indicator_text === indicator : evidence.indicator_index === index;

  useEffect(() => setNotes(savedNotes), [savedNotes]);
  useEffect(() => setSelectedIndicatorIndex(null), [standardId]);

  if (!standard) return <p>المعيار غير موجود.</p>;

  async function save(next: { status?: ProgressStatus; notes?: string }, key: ProgressStatus | "notes") {
    setSaving(key);
    try {
      const { error } = await supabase.from("standard_progress").upsert(
        {
          user_id: user.id,
          standard_id: standardId,
          status: next.status ?? status,
          notes: next.notes !== undefined ? next.notes.trim() || null : savedNotes || null,
        },
        { onConflict: "user_id,standard_id" },
      );
      if (error) throw error;
      toast.success("تم الحفظ.");
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
    } catch {
      toast.error("تعذر الحفظ.");
    } finally {
      setSaving(null);
    }
  }

  const unlinkedEvidence = mine.filter(
    (e) => !indicators.some((indicator, index) => matchesIndicator(e, index, indicator)),
  );

  return (
    <div className="space-y-6 animate-rise">
      <Link to="/standards" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden="true" /> المعايير
      </Link>

      <header className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-secondary px-2 py-0.5 font-display text-xs font-semibold">{standard.code}</span>
          <span className="text-xs text-muted-foreground">الوزن {Number(standard.weight)}٪</span>
          {standard.is_placeholder && <PlaceholderBadge />}
          {!standard.is_placeholder && standard.owner_id === null && <span className="text-xs text-success">معيار رسمي معتمد</span>}
        </div>
        <h1 className="mt-3 text-xl font-bold leading-relaxed text-primary-deep sm:text-2xl">{standard.title}</h1>
        {standard.description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{standard.description}</p>
        )}

        {indicators.length > 0 && (
          <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="بنود المعيار">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary-deep">اختر البند لإضافة شاهد له:</h2>
              {selectedIndicatorIndex !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedIndicatorIndex(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  عرض جميع البنود
                </button>
              )}
            </div>
            <div className="grid gap-2">
              {indicators.map((ind, index) => {
                const isSelected = selectedIndicatorIndex === index;
                const count = mine.filter((e) => matchesIndicator(e, index, ind)).length;
                return (
                  <button
                    key={`${index}-${ind}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedIndicatorIndex(isSelected ? null : index)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-right text-sm transition-all",
                      isSelected
                        ? "border-primary bg-primary-soft/80 font-semibold text-primary-deep shadow-xs"
                        : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50",
                    )}
                  >
                    <span className="flex items-start gap-2.5 leading-relaxed">
                      {isSelected ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <span>
                        <span className="ml-1.5 font-bold text-primary">{index + 1}.</span>
                        {ind}
                      </span>
                    </span>
                    {count > 0 && (
                      <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                        {count} {count === 1 ? "شاهد" : "شواهد"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {canAdd && (indicators.length === 0 || selectedIndicatorIndex !== null) && (
        <EvidenceUploader
          userId={user.id}
          standardId={standardId}
          indicators={indicators}
          selectedIndicatorIndex={selectedIndicatorIndex}
        />
      )}

      {canAdd && (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="text-base font-semibold">حالة الإنجاز</h2>
          <p className="mt-1 text-xs text-muted-foreground">حالة تختارها بنفسك، ولا تتغير تلقائيًا عند إضافة الشواهد أو حذفها.</p>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="حالة الإنجاز">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={status === s}
                disabled={saving !== null}
                onClick={() => s !== status && save({ status: s }, s)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm transition-colors",
                  status === s
                    ? s === "completed"
                      ? "border-success bg-success-soft font-semibold text-success"
                      : s === "in_progress"
                        ? "border-warning bg-warning-soft font-semibold text-warning-foreground"
                        : "border-primary bg-primary-soft font-semibold text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {saving === s && <Loader2 className="size-3.5 animate-spin" />}
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              ملاحظاتي على المعيار
            </label>
            <Textarea id="notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button
              size="sm"
              variant="soft"
              disabled={saving !== null || notes === savedNotes}
              onClick={() => save({ notes }, "notes")}
            >
              {saving === "notes" && <Loader2 className="animate-spin" />}
              حفظ الملاحظات
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-5">
        <h2 className="text-base font-semibold">الشواهد المرفقة ({mine.length})</h2>
        {mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            لم تضف أي شاهد لهذا المعيار بعد. اختر بندًا من الأعلى لإضافة أول شاهد.
          </p>
        ) : (
          <>
            {indicators.map((indicator, index) => {
              if (selectedIndicatorIndex !== null && selectedIndicatorIndex !== index) return null;
              const indicatorEvidence = mine.filter((e) => matchesIndicator(e, index, indicator));
              if (indicatorEvidence.length === 0 && selectedIndicatorIndex === null) return null;
              return (
                <div key={`${index}-${indicator}`} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <h3 className="text-sm font-semibold leading-relaxed">{indicator}</h3>
                  </div>
                  {indicatorEvidence.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {indicatorEvidence.map((e) => (
                        <EvidenceCard key={e.id} evidence={e} standards={standards} currentStandard={standard} />
                      ))}
                    </div>
                  ) : (
                    <p className="pr-9 text-xs text-muted-foreground">لا توجد شواهد مرتبطة بهذا البند بعد.</p>
                  )}
                </div>
              );
            })}
            {selectedIndicatorIndex === null && unlinkedEvidence.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
                <h3 className="text-sm font-semibold">شواهد سابقة غير مرتبطة ببند حالي</h3>
                <p className="text-xs text-muted-foreground">هذه الشواهد محفوظة كما هي؛ يمكنك تعديلها وربط كل شاهد ببند مناسب.</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {unlinkedEvidence.map((e) => (
                    <EvidenceCard key={e.id} evidence={e} standards={standards} currentStandard={standard} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
