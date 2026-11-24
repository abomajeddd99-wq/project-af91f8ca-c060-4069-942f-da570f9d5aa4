import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/Logo";
import { sanitizeRedirect } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: Mode | undefined; redirect?: string | undefined } => {
    const m = search["mode"];
    const r = search["redirect"];
    return {
      mode: m === "signup" || m === "forgot" || m === "login" ? m : undefined,
      redirect: typeof r === "string" ? r : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — إنجازي" },
      { name: "description", content: "سجّل دخولك أو أنشئ حسابًا جديدًا في منصة إنجازي للمعلمين." },
      { property: "og:title", content: "تسجيل الدخول — إنجازي" },
      { property: "og:description", content: "الدخول إلى ملف إنجازك الخاص." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed")) return "يرجى تأكيد بريدك الإلكتروني أولًا من الرسالة المرسلة إليك.";
  if (m.includes("already registered") || m.includes("already been registered")) return "هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.";
  if (m.includes("password") && (m.includes("weak") || m.includes("pwned") || m.includes("known")))
    return "كلمة المرور ضعيفة أو مسرّبة سابقًا. اختر كلمة مرور أقوى.";
  if (m.includes("at least")) return "كلمة المرور يجب ألا تقل عن 8 أحرف.";
  if (m.includes("rate limit")) return "محاولات كثيرة. حاول بعد قليل.";
  return "تعذر إتمام العملية. حاول مرة أخرى.";
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const target = sanitizeRedirect(search.redirect);

  useEffect(() => {
    if (search.mode) setMode(search.mode);
  }, [search.mode]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: target, replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("أهلًا بعودتك!");
        navigate({ to: target, replace: true });
      } else if (mode === "signup") {
        if (fullName.trim().length < 3) {
          toast.error("يرجى كتابة الاسم الكامل.");
          return;
        }
        if (password.length < 8) {
          toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/onboarding", replace: true });
        } else {
          setSentTo(email.trim());
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentTo(email.trim());
      }
    } catch (err) {
      toast.error(translateAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <Logo />
        <div className="my-auto py-10">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-8">
            {sentTo ? (
              <div className="text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <MailCheck className="size-7" aria-hidden="true" />
                </div>
                <h1 className="mt-4 text-xl font-bold">تحقق من بريدك</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {mode === "signup"
                    ? "أرسلنا رابط تأكيد الحساب إلى"
                    : "أرسلنا رابط إعادة تعيين كلمة المرور إلى"}{" "}
                  <span className="font-medium text-foreground" dir="ltr">{sentTo}</span>
                </p>
                <Button
                  variant="soft"
                  className="mt-6 w-full"
                  onClick={() => {
                    setSentTo(null);
                    setMode("login");
                  }}
                >
                  العودة لتسجيل الدخول
                </Button>
              </div>
            ) : (
              <>
                {mode !== "forgot" && (
                  <div className="mb-6 grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist">
                    {(["login", "signup"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={mode === m}
                        onClick={() => setMode(m)}
                        className={cn(
                          "rounded-lg py-2 text-sm font-medium transition-colors",
                          mode === m ? "bg-card text-primary-deep shadow-soft" : "text-muted-foreground",
                        )}
                      >
                        {m === "login" ? "تسجيل الدخول" : "حساب جديد"}
                      </button>
                    ))}
                  </div>
                )}
                <h1 className="text-xl font-bold">
                  {mode === "login" ? "مرحبًا بعودتك" : mode === "signup" ? "أنشئ حسابك" : "استعادة كلمة المرور"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "forgot"
                    ? "أدخل بريدك وسنرسل لك رابط إعادة التعيين."
                    : "ملف إنجازك الخاص بانتظارك."}
                </p>
                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">الاسم الكامل</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        required
                        className="h-11"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="h-11 text-left"
                    />
                  </div>
                  {mode !== "forgot" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">كلمة المرور</Label>
                        {mode === "login" && (
                          <button
                            type="button"
                            onClick={() => setMode("forgot")}
                            className="text-xs text-primary hover:underline"
                          >
                            نسيت كلمة المرور؟
                          </button>
                        )}
                      </div>
                      <Input
                        id="password"
                        type="password"
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        minLength={8}
                        required
                        className="h-11 text-left"
                      />
                    </div>
                  )}
                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="animate-spin" />}
                    {mode === "login" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال الرابط"}
                  </Button>
                  {mode === "forgot" && (
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                    >
                      العودة لتسجيل الدخول
                    </button>
                  )}
                </form>
              </>
            )}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">العودة للصفحة الرئيسية</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
