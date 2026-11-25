import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { careerPathsQuery } from "@/lib/catalog";
import { isAdminQuery, profileQuery } from "@/lib/queries";
import { validateCareerSelection } from "@/lib/career";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CareerProfile({ userId }: { userId: string }) {
  const { data: roles } = useSuspenseQuery(careerPathsQuery());
  const { data: profile } = useSuspenseQuery(profileQuery(userId));
  const { data: isAdmin = false } = useQuery(isAdminQuery());
  const [roleId, setRoleId] = useState(profile?.professional_role_id ?? "");
  const [name, setName] = useState(profile?.full_name ?? "");
  const [school, setSchool] = useState(profile?.school ?? "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isLocked = Boolean(profile?.professional_role_id && !isAdmin);
  const currentRoleTitle = roles.find((r) => r.id === profile?.professional_role_id)?.title ?? "";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (isLocked) return;
    if (!validateCareerSelection(roleId, roles) || name.trim().length < 3) {
      toast.error("أكمل الاسم واختر مسارك الوظيفي.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          school: school.trim() || null,
          professional_role_id: roleId,
          job_title: roles.find((r) => r.id === roleId)?.title ?? null,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw error;
      await queryClient.invalidateQueries();
      toast.success("تم حفظ المسار الوظيفي.");
      await navigate({ to: "/dashboard" });
    } catch {
      toast.error("تعذر حفظ المسار الوظيفي.");
    } finally {
      setSaving(false);
    }
  }

  if (isLocked) {
    return (
      <div className="mx-auto max-w-xl space-y-5 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-primary-deep">المسار الوظيفي معتمد</h1>
        <p className="text-sm text-muted-foreground">
          تم ربط هذا الحساب بالاسم الكامل والمسار الوظيفي المعتمد أدناه ولا يمكن تغييرهما إلا عبر إدارة المنصة.
        </p>
        <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
          <div>
            <span className="text-muted-foreground">الاسم الكامل: </span>
            <strong className="text-foreground">{profile?.full_name}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">المسار الوظيفي: </span>
            <strong className="text-foreground">{currentRoleTitle}</strong>
          </div>
        </div>
        <Button type="button" onClick={() => navigate({ to: "/dashboard" })}>
          العودة إلى لوحة التحكم
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-primary-deep">استكمال الحساب الشخصي</h1>
        {!isAdmin && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            تنبيه: بعد حفظ الاسم الكامل والمسار الوظيفي سيتم ربط الحساب بهما بشكل دائم ولا يمكن تغييرهما إلا عبر الإدارة.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="career-name">الاسم الكامل</Label>
        <Input id="career-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="career-role">المسار الوظيفي</Label>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger id="career-role" className="w-full">
            <SelectValue placeholder="اختر المسار الوظيفي" />
          </SelectTrigger>
          <SelectContent>
            {roles
              .filter((r) => r.is_active)
              .map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="career-school">المدرسة / جهة العمل</Label>
        <Input id="career-school" value={school} onChange={(e) => setSchool(e.target.value)} maxLength={200} />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "جارٍ الحفظ…" : "حفظ المسار والمتابعة"}
      </Button>
    </form>
  );
}
