import { LayoutGrid, LockKeyhole, PanelsTopLeft, Printer } from "lucide-react";

type ItemsPerPage = 1 | 2 | 3 | 4;

export type EvidenceLayoutPreferences = {
  defaultItemsPerPage: ItemsPerPage;
  byStandard: Record<string, ItemsPerPage>;
};

export type EvidenceLayoutStandard = {
  id: string;
  code: string;
  title: string;
};

type EvidenceLayoutControlsProps = {
  preferences: EvidenceLayoutPreferences;
  onChange: (value: EvidenceLayoutPreferences) => void;
  standards: EvidenceLayoutStandard[];
  disabled?: boolean;
};

const LAYOUT_OPTIONS: { value: ItemsPerPage; label: string; detail: string }[] = [
  { value: 1, label: "عنصر واحد", detail: "مساحة أوسع" },
  { value: 2, label: "عنصران", detail: "متوازن" },
  { value: 3, label: "ثلاثة عناصر", detail: "مكثّف" },
  { value: 4, label: "أربعة عناصر", detail: "شبكة ٢ × ٢" },
];

function LayoutPreview({ count }: { count: ItemsPerPage }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 gap-1 rounded-lg border border-primary/15 bg-background p-1 ${
        count === 4 ? "grid-cols-2" : "grid-cols-1"
      }`}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`rounded-[3px] bg-primary/25 ${count === 1 ? "min-h-0" : ""} ${
            ""
          }`}
        />
      ))}
    </span>
  );
}

export function EvidenceLayoutControls({
  preferences,
  onChange,
  standards,
  disabled = false,
}: EvidenceLayoutControlsProps) {
  const overrideCount = Object.keys(preferences.byStandard).length;

  function changeDefault(value: ItemsPerPage) {
    onChange({ ...preferences, defaultItemsPerPage: value });
  }

  function changeStandard(standardId: string, value: string) {
    const byStandard = { ...preferences.byStandard };
    if (value === "inherit") {
      delete byStandard[standardId];
    } else {
      byStandard[standardId] = Number(value) as ItemsPerPage;
    }
    onChange({ ...preferences, byStandard });
  }

  return (
    <section
      dir="rtl"
      aria-labelledby="evidence-layout-title"
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
    >
      <div className="border-b border-border bg-primary-soft/45 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-primary/10 bg-card text-primary shadow-sm">
            <LayoutGrid className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-primary">إعدادات العرض والطباعة</p>
            <h2 id="evidence-layout-title" className="mt-1 text-lg font-bold text-primary-deep">
              تخطيط الشواهد
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              حدّد الحد الأقصى للشواهد في الصفحة، ويمكنك تخصيصه لكل معيار عند الحاجة.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <fieldset disabled={disabled} className="min-w-0">
          <legend className="text-sm font-semibold text-foreground">الحد الأقصى الافتراضي في الصفحة</legend>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            يُطبّق على جميع المعايير ما لم تختر إعدادًا مختلفًا لأحدها.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LAYOUT_OPTIONS.map((option) => {
              const selected = preferences.defaultItemsPerPage === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => changeDefault(option.value)}
                  className={`group flex min-h-[76px] items-center gap-2 rounded-2xl border px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                    selected
                      ? "border-primary bg-primary-soft/70 text-primary-deep shadow-sm"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary-soft/25"
                  }`}
                >
                  <LayoutPreview count={option.value} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-2xl border border-[#C5A15B]/35 bg-[#C5A15B]/[0.08] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <PanelsTopLeft className="mt-0.5 size-4 shrink-0 text-[#94743B]" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-foreground/80">
              أربعة شواهد تظهر بتنسيق ٢ × ٢. الأعداد المحددة أهداف قصوى وليست إلزامية؛ يبقى عنوان كل شاهد
              ووصفه مع صورته، وتظل ملفات PDF الأصلية دون أي تغيير.
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">تخصيص حسب المعيار</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                اختر «استخدام الافتراضي» ليرث المعيار الحد العام ({preferences.defaultItemsPerPage}).
              </p>
            </div>
            <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {overrideCount} تخصيص
            </span>
          </div>

          {standards.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-center">
              <p className="text-sm font-medium text-foreground">لا توجد معايير متاحة للتخصيص</p>
              <p className="mt-1 text-xs text-muted-foreground">سيُطبّق الحد الافتراضي على ملف الإنجاز.</p>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-background">
              {standards.map((standard) => {
                const override = preferences.byStandard[standard.id];
                const selectId = `evidence-layout-${standard.id}`;
                return (
                  <div
                    key={standard.id}
                    className="flex flex-col gap-2.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-primary" dir="auto">{standard.code}</p>
                      <p className="mt-0.5 text-sm font-medium leading-snug text-foreground" dir="auto">
                        {standard.title}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label htmlFor={selectId} className="sr-only">
                        عدد الشواهد في الصفحة لمعيار {standard.code} {standard.title}
                      </label>
                      <select
                        id={selectId}
                        value={override ?? "inherit"}
                        disabled={disabled}
                        onChange={(event) => changeStandard(standard.id, event.target.value)}
                        className="h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-[210px]"
                      >
                        <option value="inherit">استخدام الافتراضي ({preferences.defaultItemsPerPage})</option>
                        {LAYOUT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} كحد أقصى
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>تُحفظ هذه التفضيلات في هذا المتصفح فقط، ولا تغيّر ملفات الشواهد الأصلية.</p>
          <Printer className="ms-auto mt-0.5 size-4 shrink-0 text-[#94743B]" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
