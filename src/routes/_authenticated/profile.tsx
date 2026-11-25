import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery, profileQuery, type Profile } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "ملفي الشخصي — إنجازي" },
      { name: "description", content: "بياناتك المهنية التي تظهر في ملف الإنجاز." },
      { property: "og:title", content: "ملفي الشخصي — إنجازي" },
      { property: "og:description", content: "بياناتك المهنية التي تظهر في ملف الإنجاز." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery(context.user.id)),
  component: ProfilePage,
});

type Field = { key: keyof Profile; label: string; placeholder?: string; type?: string; dir?: "ltr" };

const fields: Field[] = [
  { key: "full_name", label: "الاسم الكامل" },
  { key: "job_title", label: "المسمى الوظيفي", placeholder: "معلم / معلمة" },
  { key: "subject", label: "التخصص / المادة", placeholder: "مثال: الرياضيات" },
  { key: "stage", label: "المرحلة الدراسية", placeholder: "مثال: المتوسطة" },
  { key: "school", label: "المدرسة" },
  { key: "education_office", label: "إدارة / مكتب التعليم", placeholder: "مثال: إدارة تعليم الرياض" },
  { key: "academic_year", label: "العام الدراسي", placeholder: "مثال: 1448هـ" },
  { key: "years_experience", label: "سنوات الخبرة", type: "number" },
  { key: "phone", label: "رقم الجوال", type: "tel", dir: "ltr", placeholder: "05xxxxxxxx" },
];

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const { data: isAdmin = false } = useQuery(isAdminQuery());
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f.key] = profile?.[f.key] != null ? String(profile[f.key]) : "";
    v["bio"] = profile?.bio ?? "";
    return v;
  });
  const [saving, setSaving] = useState(false);
  const get = (k: string): string => values[k] ?? "";

  const isRoleLocked = Boolean(profile?.professional_role_id && !isAdmin);
  const isNameLocked = Boolean(profile?.full_name?.trim() && profile?.professional_role_id && !isAdmin);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const years = get("years_experience").trim() === "" ? null : Number(get("years_experience"));
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) {
      toast.error("سنوات الخبرة يجب أن تكون رقمًا بين 0 و 60.");
      return;
    }
    const finalName = isNameLocked && profile?.full_name ? profile.full_name : get("full_name").trim().slice(0, 200);
    if (finalName.length < 3) {
      toast.error("يرجى كتابة الاسم الكامل.");
      return;
    }
    setSaving(true);
    const clean = (k: string) => get(k).trim().slice(0, 200) || null;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: finalName,
      job_title: clean("job_title"),
      subject: clean("subject"),
      stage: clean("stage"),
      school: clean("school"),
      education_office: clean("education_office"),
      academic_year: clean("academic_year"),
      years_experience: years,
      phone: clean("phone"),
      bio: get("bio").trim().slice(0, 2000) || null,
    });
    setSaving(false);
    if (error) {
      toast.error("تعذر حفظ البيانات.");
      return;
    }
    toast.success("تم حفظ بياناتك.");
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-rise">
      <div className="rounded-3xl border border-border bg-card px-5 py-5 shadow-soft sm:px-6">
        <p className="text-xs font-semibold text-primary">بيانات الغلاف والسيرة المهنية</p>
        <h1 className="mt-1 text-2xl font-bold text-primary-deep">ملفي الشخصي</h1>
        <p className="mt-1 text-sm text-muted-foreground">تظهر هذه البيانات في غلاف ملف الإنجاز وصفحة السيرة المهنية.</p>
        {!isRoleLocked ? (
          <Button asChild variant="outline" className="mt-3">
            <Link to="/onboarding">اختيار / تغيير المسار الوظيفي</Link>
          </Button>
        ) : (
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            الحساب مرتبط بمسارك الوظيفي والاسم المعتمد، ولتعديلهما يرجى التواصل مع إدارة المنصة.
          </p>
        )}
      </div>
      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="space-y-2">
          <Label>البريد الإلكتروني</Label>
          <Input value={user.email ?? ""} disabled dir="ltr" className="h-11 text-left" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type={f.type ?? "text"}
                dir={f.dir}
                inputMode={f.type === "number" ? "numeric" : undefined}
                placeholder={f.placeholder}
                value={get(f.key)}
                disabled={f.key === "full_name" && isNameLocked}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                maxLength={200}
                className={f.dir === "ltr" ? "h-11 text-left" : "h-11"}
              />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">نبذة مهنية</Label>
          <Textarea
            id="bio"
            rows={4}
            maxLength={2000}
            value={get("bio")}
            onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
          />
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full sm:w-auto" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          حفظ البيانات
        </Button>
      </form>
    </div>
  );
}
