import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { allStandardsQuery, evidencesQuery, progressQuery, standardsQuery } from "@/lib/queries";
import { STATUS_LABELS, statusFor, type ProgressStatus } from "@/lib/progress";
import { StatusBadge, PlaceholderBadge } from "@/components/app/StatusBadge";
import { PlaceholderNotice } from "@/components/app/PlaceholderNotice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/standards/")({
  head: () => ({
    meta: [
      { title: "معايير الأداء — إنجازي" },
      { name: "description", content: "قائمة معايير الأداء الوظيفي وحالة إنجاز كل معيار." },
      { property: "og:title", content: "معايير الأداء — إنجازي" },
      { property: "og:description", content: "قائمة معايير الأداء الوظيفي وحالة إنجاز كل معيار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(standardsQuery()),
      context.queryClient.ensureQueryData(progressQuery()),
      context.queryClient.ensureQueryData(evidencesQuery()),
      context.queryClient.ensureQueryData(allStandardsQuery()),
    ]),
  component: StandardsList,
});

type Filter = "all" | ProgressStatus;

function StandardsList() {
  const { data: standards } = useSuspenseQuery(standardsQuery());
  const { data: progress } = useSuspenseQuery(progressQuery());
  const { data: evidences } = useSuspenseQuery(evidencesQuery());
  const { data: historical } = useSuspenseQuery(allStandardsQuery());
  const previous = historical.filter((s) => !standards.some((current) => current.id === s.id) && evidences.some((e) => e.standard_id === s.id));
  const [filter, setFilter] = useState<Filter>("all");

  const rows = standards.filter((s) => filter === "all" || statusFor(s.id, progress) === filter);
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "not_started", label: STATUS_LABELS.not_started },
    { key: "in_progress", label: STATUS_LABELS.in_progress },
    { key: "completed", label: STATUS_LABELS.completed },
  ];

  return (
    <div className="space-y-5 animate-rise">
      <div className="rounded-3xl border border-border bg-card px-5 py-5 shadow-soft sm:px-6">
        <p className="text-xs font-semibold text-primary">سجل الأداء المهني</p>
        <h1 className="mt-1 text-2xl font-bold text-primary-deep">معايير الأداء</h1>
        <p className="mt-1 text-sm text-muted-foreground">اعرض المؤشرات وحدد حالة الإنجاز واربط الشواهد بكل معيار.</p>
      </div>
      {standards.some((s) => s.is_placeholder) && <PlaceholderNotice />}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((s) => {
          const count = evidences.filter((e) => e.standard_id === s.id).length;
          return (
            <li key={s.id}>
              <Link
                to="/standards/$standardId"
                params={{ standardId: s.id }}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-lg bg-secondary px-2 py-0.5 font-display text-xs font-semibold text-secondary-foreground">
                    {s.code}
                  </span>
                  <span className="text-xs text-muted-foreground">الوزن {Number(s.weight)}٪</span>
                </div>
                <h2 className="text-base font-semibold leading-relaxed">{s.title}</h2>
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span>حالة يدوية:</span>
                    <StatusBadge status={statusFor(s.id, progress)} />
                  </span>
                  <span>{count} شواهد</span>
                  {s.is_placeholder && <PlaceholderBadge />}
                  {!s.is_placeholder && s.owner_id === null && <span className="text-success">معيار رسمي معتمد</span>}
                  <ArrowLeft className="ms-auto size-4" aria-hidden="true" />
                </div>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground md:col-span-2">
            لا توجد معايير في هذا التصنيف.
          </li>
        )}
      </ul>
      {previous.length > 0 && <section><h2 className="mb-3 text-lg font-semibold">معايير شواهدي السابقة</h2><ul className="space-y-2">{previous.map((s) => <li key={s.id}><Link to="/standards/$standardId" params={{ standardId: s.id }} className="block border-b border-border py-3 text-primary">{s.title}</Link></li>)}</ul></section>}
    </div>
  );
}
