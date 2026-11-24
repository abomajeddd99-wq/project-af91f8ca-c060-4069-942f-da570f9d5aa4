import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — إنجازي" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في إنجازي." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — إنجازي" },
      { property: "og:description", content: "إعادة تعيين كلمة المرور." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && isRecovery) setReady(true);
    });
    if (isRecovery) setReady(true);
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("تعذر تحديث كلمة المرور. اطلب رابطًا جديدًا.");
      return;
    }
    toast.success("تم تحديث كلمة المرور.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <Logo />
        <div className="my-auto rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-8">
          <h1 className="text-xl font-bold">كلمة مرور جديدة</h1>
          {ready ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                <Input
                  id="new-password"
                  type="password"
                  dir="ltr"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-11 text-left"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                حفظ كلمة المرور
              </Button>
            </form>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              افتح هذه الصفحة من الرابط المرسل إلى بريدك الإلكتروني لإعادة تعيين كلمة المرور.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
