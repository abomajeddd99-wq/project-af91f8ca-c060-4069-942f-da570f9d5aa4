import { Info } from "lucide-react";

export function PlaceholderNotice() {
  return (
    <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning-foreground print:hidden">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="leading-relaxed">
        المعايير المعروضة حاليًا <strong>تجريبية</strong> لأغراض العرض فقط، وسيتم استبدالها بالمعايير الرسمية
        المعتمدة فور توفرها.
      </p>
    </div>
  );
}
