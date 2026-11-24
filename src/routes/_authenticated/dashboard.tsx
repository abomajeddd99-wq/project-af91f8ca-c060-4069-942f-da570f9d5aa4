import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, FileStack, Printer, UserRound } from "lucide-react";
import { evidencesQuery, profileQuery, progressQuery, standardsQuery } from "@/lib/queries";
import { computeEvidenceCoverage, computeManualProgress, statusFor } from "@/lib/progress";
import { ProgressRing } from "@/components/app/ProgressRing";
import { StatusBadge, PlaceholderBadge } from "@/components/app/StatusBadge";
import { PlaceholderNotice } from "@/components/app/PlaceholderNotice";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — إنجازي" },
      { name: "description", content: "متابعة نسبة إنجاز ملفك وشواهدك." },
      { property: "og:title", content: "لوحة التحكم — إنجازي" },
      { property: "og:description", content: "متابعة نسبة إنجاز ملفك وشواهدك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(standardsQuery()),
      context.queryClient.ensureQueryData(progressQuery()),
      context.queryClient.ensureQueryData(evidencesQuery()),
    ]),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { data: standards } = useSuspenseQuery(standardsQuery());
  const { data: progress } = useSuspenseQuery(progressQuery());
  const { data: evidences } = useSuspenseQuery(evidencesQuery());
  const { data: profile } = useQuery(profileQuery(user.id));
  const summary = computeManualProgress(standards, progress);
  const evidenceCoverage = computeEvidenceCoverage(standards, evidences);
  const hasPlaceholders = standards.some((s) => s.is_placeholder);
  const profileIncomplete = !profile?.school || !profile?.subject;
  const firstName = (profile?.full_name || "").split(" ")[0];

  const next = standards.filter((s) => statusFor(s.id, progress) !== "completed").slice(0, 4);

  return (
    <div className="space-y-6 animate-rise" dir="rtl">
      <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-brand-gradient px-5 py-7 text-primary-foreground shadow-lift sm:px-7">
        <div className="absolute left-8 top-0 h-32 w-32 rounded-full border border-white/10" aria-hidden="true" />
        <p className="text-sm text-white/75">أهلًا{firstName ? `، ${firstName}` : ""}</p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">لوحة ملف الإنجاز المهني</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">
          راجع تقدّمك، وادمج المعايير والشواهد في ملف مهني رسمي جاهز للمراجعة والطباعة.
        </p>
        {profile?.job_title && <p className="mt-3 text-xs text-white/70">{profile.job_title}</p>}
      </div>

      {!profile?.onboarding_completed_at && <Button asChild variant="outline"><Link to="/onboarding">استكمال الحساب واختيار المسار الوظيفي</Link></Button>}

      {hasPlaceholders && <PlaceholderNotice />}

      {profileIncomplete && (
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary-soft/60 p-4 text-sm"
        >
          <UserRound className="size-5 text-primary" aria-hidden="true" />
          <span className="flex-1">أكمل بياناتك المهنية لتظهر في غلاف ملف الإنجاز.</span>
          <ArrowLeft className="size-4 text-primary" aria-hidden="true" />
        </Link>
      )}

      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col items-start gap-5 rounded-3xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <ProgressRing value={summary.weightedPercent} label="إنجاز يدوي" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground">المعايير التي حدّدت اكتمالها</p>
            <p className="font-display text-3xl font-bold">
              {summary.completed}
              <span className="text-lg text-muted-foreground"> / {summary.total}</span>
            </p>
            <p className="text-xs text-muted-foreground">تغطية الشواهد: {evidenceCoverage.documented} من {evidenceCoverage.total} معيار ({evidenceCoverage.percent}٪)</p>
            <p className="text-xs text-muted-foreground">هذه التغطية مستقلة عن الحالة التي تختارها.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat icon={FileStack} label="الشواهد" value={evidences.length} />
          <Stat icon={Clock} label="قيد الإنجاز يدويًا" value={summary.inProgress} />
          <Stat icon={CheckCircle2} label="مكتمل يدويًا" value={summary.completed} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="hero" size="lg">
          <Link to="/standards">
            <FileStack /> إضافة شاهد
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/portfolio">
            <Printer /> طباعة ملف الإنجاز
          </Link>
        </Button>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">التالي في قائمتك</h2>
          <Link to="/standards" className="text-sm text-primary hover:underline">
            كل المعايير
          </Link>
        </div>
        {next.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {standards.length === 0 ? "لا توجد معايير بعد." : "أحسنت، أكملت جميع المعايير."}
          </div>
        ) : (
          <ul className="space-y-2">
            {next.map((s) => {
              const count = evidences.filter((e) => e.standard_id === s.id).length;
              return (
                <li key={s.id}>
                  <Link
                    to="/standards/$standardId"
                    params={{ standardId: s.id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft font-display text-sm font-semibold text-accent-foreground">
                      {s.sort_order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <StatusBadge status={statusFor(s.id, progress)} />
                        <span>{count} شاهد</span>
                        {s.is_placeholder && <PlaceholderBadge />}
                      </div>
                    </div>
                    <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-soft">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <div className="mt-3">
        <p className="font-display text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
