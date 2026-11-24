import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCheck2, FolderLock, ListChecks, Printer, ShieldCheck, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/Logo";
import heroImage from "@/assets/hero-portfolio.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "إنجازي — ملف إنجاز المعلم السعودي" },
      {
        name: "description",
        content: "وثّق شواهد أدائك الوظيفي وفق المعايير، وتابع نسبة إنجازك، واطبع ملف إنجازك بصيغة PDF عربية.",
      },
      { property: "og:title", content: "إنجازي — ملف إنجاز المعلم السعودي" },
      { property: "og:description", content: "منصة عربية خاصة وآمنة لتوثيق شواهد الأداء وطباعة ملف الإنجاز." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ListChecks, title: "معايير الأداء", body: "استعرض معايير الأداء ومؤشراتها في مكان واحد منظّم." },
  { icon: Upload, title: "رفع الشواهد", body: "أرفق الصور وملفات PDF لكل معيار مباشرة من جوالك." },
  { icon: FileCheck2, title: "متابعة الإنجاز", body: "اعرف نسبة اكتمال ملفك وما تبقّى عليك بنظرة واحدة." },
  { icon: Printer, title: "ملف PDF جاهز", body: "اطبع ملف إنجازك بتنسيق عربي أنيق أو احفظه PDF." },
];

const steps = [
  { icon: UserRound, title: "أنشئ حسابك", body: "سجّل ببريدك الإلكتروني وأكمل بياناتك المهنية." },
  { icon: Upload, title: "أضف شواهدك", body: "اختر المعيار وارفع الشاهد مع وصف مختصر." },
  { icon: Printer, title: "اطبع ملفك", body: "ولّد ملف الإنجاز كاملًا بضغطة زر." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth" search={{ mode: "login" }}>دخول</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>إنشاء حساب</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-hero">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 md:grid-cols-2 md:items-center md:pb-24 md:pt-16">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-accent-foreground">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                خاص وآمن — ملفاتك لك وحدك
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-[1.25] text-primary-deep md:text-5xl">
                ملف إنجازك،
                <br />
                <span className="text-primary">منظّم وجاهز للطباعة.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-loose text-muted-foreground md:text-lg">
                إنجازي يساعدك على توثيق شواهد أدائك الوظيفي وفق المعايير، ومتابعة اكتمالها، ثم طباعة ملف إنجاز عربي
                احترافي.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="hero" size="lg">
                  <Link to="/auth" search={{ mode: "signup" }}>ابدأ مجانًا</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/auth" search={{ mode: "login" }}>لدي حساب</Link>
                </Button>
              </div>
            </div>
            <div className="animate-rise [animation-delay:120ms]">
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
                <img
                  src={heroImage}
                  alt="ملف إنجاز معلم منظّم بشهادات وأوراق"
                  width={1280}
                  height={1024}
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold text-primary-deep md:text-3xl">كل ما تحتاجه لملف إنجازك</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-secondary/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold text-primary-deep md:text-3xl">ثلاث خطوات فقط</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl bg-card p-5 shadow-soft">
                  <span className="font-display text-5xl font-bold text-primary-soft">{i + 1}</span>
                  <div className="mt-2 flex items-center gap-2">
                    <s.icon className="size-5 text-primary" aria-hidden="true" />
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-6 rounded-3xl bg-brand-gradient p-8 text-primary-foreground md:grid-cols-[auto_1fr] md:items-center md:p-10">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary-foreground/15">
              <FolderLock className="size-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">خصوصيتك أولًا</h2>
              <p className="mt-2 leading-loose text-primary-foreground/85">
                كل معلم يرى سجلاته وملفاته فقط. الملفات محفوظة في مساحة خاصة مشفّرة، ولا يستطيع حتى مشرفو المنصة
                الاطلاع على شواهدك.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} إنجازي — للمعلمين والمعلمات في المملكة العربية السعودية</p>
        </div>
      </footer>
    </div>
  );
}
