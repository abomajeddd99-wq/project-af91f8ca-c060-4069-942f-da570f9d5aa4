import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAccounts } from "@/lib/admin.functions";
import { careerPathsQuery, criteriaVersionsQuery, categoriesQuery } from "@/lib/catalog";
import { allStandardsQuery, isAdminQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const accountsQuery = () =>
  queryOptions({ queryKey: ["admin-accounts"], queryFn: () => getAdminAccounts() });
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "إدارة المنصة — إنجازي" },
      {
        name: "description",
        content: "إدارة المسارات الوظيفية والمعايير والإصدارات والحسابات الشخصية.",
      },
      { property: "og:title", content: "إدارة المنصة — إنجازي" },
      { property: "og:description", content: "إدارة آمنة منفصلة عن المسارات الوظيفية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    const allowed = await context.queryClient.fetchQuery(isAdminQuery());
    if (!allowed) return { allowed: false };
    await Promise.all([
      context.queryClient.ensureQueryData(accountsQuery()),
      context.queryClient.ensureQueryData(careerPathsQuery()),
      context.queryClient.ensureQueryData(criteriaVersionsQuery()),
      context.queryClient.ensureQueryData(categoriesQuery()),
      context.queryClient.ensureQueryData(allStandardsQuery()),
    ]);
    return { allowed: true };
  },
  component: AdminRoute,
});

function AdminRoute() {
  const allowed = Route.useLoaderData().allowed;
  return allowed ? (
    <AdminPanel />
  ) : (
    <div className="py-12 text-center">
      <h1 className="text-xl font-bold">غير مصرح بالدخول إلى الإدارة</h1>
    </div>
  );
}

function AdminPanel() {
  const { data: roles } = useSuspenseQuery(careerPathsQuery());
  const { data: versions } = useSuspenseQuery(criteriaVersionsQuery());
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const { data: standards } = useSuspenseQuery(allStandardsQuery());
  const { data: accounts } = useSuspenseQuery(accountsQuery());
  const qc = useQueryClient();
  const [kind, setKind] = useState("roles");
  const [editing, setEditing] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [parent, setParent] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [official, setOfficial] = useState(false);
  const [description, setDescription] = useState("");
  const [indicators, setIndicators] = useState("");
  const [saving, setSaving] = useState(false);
  function reset(next = kind) {
    setKind(next);
    setEditing("");
    setTitle("");
    setCode("");
    setParent("");
    setCategory("");
    setSource("");
    setOfficial(false);
    setDescription("");
    setIndicators("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (kind === "roles") {
        const value = { title: title.trim(), code: code.trim() };
        const { error } = editing
          ? await supabase.from("professional_roles").update(value).eq("id", editing)
          : await supabase.from("professional_roles").insert(value);
        if (error) throw error;
      } else if (kind === "versions") {
        if (!parent || (official && !source.trim())) throw new Error();
        const value = {
          title: title.trim(),
          professional_role_id: parent,
          is_official: official,
          source_reference: source.trim() || null,
        };
        const { error } = editing
          ? await supabase.from("criteria_versions").update(value).eq("id", editing)
          : await supabase.from("criteria_versions").insert(value);
        if (error) throw error;
      } else if (kind === "categories") {
        if (!parent) throw new Error();
        const value = { title: title.trim(), version_id: parent };
        const { error } = editing
          ? await supabase.from("criteria_categories").update(value).eq("id", editing)
          : await supabase.from("criteria_categories").insert(value);
        if (error) throw error;
      } else {
        if (!parent) throw new Error();
        const indicatorValues = indicators
          .split("\n")
          .map((indicator) => indicator.trim())
          .filter(Boolean);
        const value = {
          title: title.trim(),
          code: code.trim(),
          description: description.trim() || null,
          indicators: indicatorValues,
          criteria_version_id: parent,
          category_id: category || null,
          is_placeholder: !versions.find((v) => v.id === parent)?.is_official,
        };
        const { error } = editing
          ? await supabase.from("standards").update(value).eq("id", editing)
          : await supabase.from("standards").insert(value);
        if (error) throw error;
      }
      await qc.invalidateQueries();
      reset();
      toast.success("تم الحفظ.");
    } catch {
      toast.error("تعذر الحفظ. تحقق من الحقول والرمز والمصدر المعتمد.");
    } finally {
      setSaving(false);
    }
  }
  async function toggle(id: string, active: boolean) {
    if (!window.confirm("تأكيد تغيير حالة العنصر؟ لن تُحذف البيانات.")) return;
    const result =
      kind === "roles"
        ? await supabase.from("professional_roles").update({ is_active: !active }).eq("id", id)
        : kind === "versions"
          ? await supabase
              .from("criteria_versions")
              .update({ status: active ? "archived" : "published" })
              .eq("id", id)
          : kind === "categories"
            ? await supabase.from("criteria_categories").update({ is_active: !active }).eq("id", id)
            : await supabase.from("standards").update({ is_active: !active }).eq("id", id);
    if (result.error) toast.error("تعذر تغيير الحالة.");
    else {
      await qc.invalidateQueries();
      toast.success("تم تحديث الحالة.");
    }
  }
  const rows =
    kind === "roles"
      ? roles
      : kind === "versions"
        ? versions
        : kind === "categories"
          ? categories
          : standards.filter((s) => s.owner_id === null);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-deep">إدارة المنصة</h1>
      <Tabs value={kind} onValueChange={reset}>
        <TabsList className="h-auto w-full flex-wrap">
          <TabsTrigger value="roles">المسارات</TabsTrigger>
          <TabsTrigger value="versions">الإصدارات</TabsTrigger>
          <TabsTrigger value="categories">التصنيفات</TabsTrigger>
          <TabsTrigger value="standards">المعايير</TabsTrigger>
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr>
                  <th className="p-3">الاسم</th>
                  <th className="p-3">البريد</th>
                  <th className="p-3">المسار</th>
                  <th className="p-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <AdminUserRow
                    key={`${a.id}-${a.career_path ?? ""}-${a.full_name ?? ""}`}
                    account={a}
                    roles={roles}
                    onSaved={() => qc.invalidateQueries()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
      {kind !== "users" && (
        <>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="catalog-title">العنوان</Label>
              <Input
                id="catalog-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            {(kind === "roles" || kind === "standards") && (
              <div className="space-y-2">
                <Label htmlFor="catalog-code">الرمز الفريد</Label>
                <Input
                  id="catalog-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
            )}
            {kind !== "roles" && (
              <div className="space-y-2">
                <Label htmlFor="catalog-parent">
                  {kind === "versions" ? "المسار الوظيفي" : "الإصدار"}
                </Label>
                <Select
                  value={parent}
                  onValueChange={(v) => {
                    setParent(v);
                    setCategory("");
                  }}
                >
                  <SelectTrigger id="catalog-parent" className="w-full">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {(kind === "versions" ? roles : versions).map((r) => (
                      <SelectItem value={r.id} key={r.id}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {kind === "versions" && (
              <>
                <label className="flex items-center gap-2">
                  <Checkbox checked={official} onCheckedChange={(v) => setOfficial(v === true)} />{" "}
                  إصدار رسمي معتمد
                </label>
                <div className="space-y-2">
                  <Label htmlFor="catalog-source">مرجع الاعتماد الرسمي</Label>
                  <Input
                    id="catalog-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    required={official}
                  />
                </div>
              </>
            )}
            {kind === "standards" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="catalog-category">التصنيف</Label>
                  <Select
                    value={category || "none"}
                    onValueChange={(v) => setCategory(v === "none" ? "" : v)}
                  >
                    <SelectTrigger id="catalog-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون تصنيف</SelectItem>
                      {categories
                        .filter((c) => c.version_id === parent)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="catalog-description">الوصف</Label>
                  <Input
                    id="catalog-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="catalog-indicators">بنود المعيار</Label>
                  <Textarea
                    id="catalog-indicators"
                    rows={6}
                    value={indicators}
                    onChange={(e) => setIndicators(e.target.value)}
                    placeholder={"بند واحد في كل سطر"}
                  />
                </div>
              </>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "إضافة"}
              </Button>
              {editing && (
                <Button variant="outline" onClick={() => reset()}>
                  إلغاء
                </Button>
              )}
            </div>
          </form>
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const active = "status" in r ? r.status === "published" : r.is_active;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {"status" in r
                        ? `${r.status === "published" ? "منشور" : r.status === "draft" ? "مسودة" : "مؤرشف"} · ${r.is_official ? "رسمي معتمد" : "تجريبي"}`
                        : active
                          ? "نشط"
                          : "مؤرشف"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(r.id);
                        setTitle(r.title);
                        setCode("code" in r && typeof r.code === "string" ? r.code : "");
                        setParent(
                          "professional_role_id" in r && typeof r.professional_role_id === "string"
                            ? r.professional_role_id
                            : "version_id" in r && typeof r.version_id === "string"
                              ? r.version_id
                              : "criteria_version_id" in r &&
                                  typeof r.criteria_version_id === "string"
                                ? r.criteria_version_id
                                : "",
                        );
                        setOfficial("is_official" in r && r.is_official === true);
                        setSource(
                          "source_reference" in r && typeof r.source_reference === "string"
                            ? r.source_reference
                            : "",
                        );
                        setCategory(
                          "category_id" in r && typeof r.category_id === "string"
                            ? r.category_id
                            : "",
                        );
                        setDescription(
                          "description" in r && typeof r.description === "string"
                            ? r.description
                            : "",
                        );
                        setIndicators(
                          "indicators" in r && Array.isArray(r.indicators)
                            ? r.indicators.join("\n")
                            : "",
                        );
                      }}
                    >
                      تعديل
                    </Button>
                    <Button variant="soft" size="sm" onClick={() => toggle(r.id, active)}>
                      {active ? "أرشفة" : kind === "versions" ? "نشر داخل المنصة" : "تفعيل"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}


function AdminUserRow({
  account,
  roles,
  onSaved,
}: {
  account: { id: string; full_name: string | null; email: string | null; career_path: string | null };
  roles: { id: string; title: string; is_active: boolean }[];
  onSaved: () => Promise<void>;
}) {
  const initialRoleId = roles.find((r) => r.title === account.career_path)?.id ?? "";
  const [fullName, setFullName] = useState(account.full_name ?? "");
  const [roleId, setRoleId] = useState(initialRoleId);
  const [busy, setBusy] = useState(false);

  async function updateAccount() {
    if (!roleId) {
      toast.error("اختر المسار الوظيفي.");
      return;
    }
    if (fullName.trim().length < 3) {
      toast.error("يرجى كتابة الاسم الكامل.");
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).rpc("admin_update_user_account", {
      p_user_id: account.id,
      p_role_id: roleId,
      p_full_name: fullName.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "تعذر تحديث بيانات المستخدم.");
      return;
    }
    await onSaved();
    toast.success("تم تحديث بيانات المستخدم بنجاح.");
  }

  return (
    <tr className="border-t border-border">
      <td className="p-3">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={200}
          className="min-w-[160px]"
        />
      </td>
      <td className="p-3" dir="ltr">
        {account.email}
      </td>
      <td className="p-3">
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger className="min-w-[200px]">
            <SelectValue placeholder="اختر المسار" />
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
      </td>
      <td className="p-3">
        <Button type="button" size="sm" onClick={updateAccount} disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
      </td>
    </tr>
  );
}
