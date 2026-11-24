import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LayoutDashboard, ListChecks, LogOut, BookOpenCheck, UserRound, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { isAdminQuery } from "@/lib/queries";

const baseNav = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/standards", label: "المعايير", icon: ListChecks },
  { to: "/portfolio", label: "ملف الإنجاز", icon: BookOpenCheck },
  { to: "/profile", label: "حسابي", icon: UserRound },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nav = baseNav;
  const { data: isAdmin } = useQuery(isAdminQuery());

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  return (
    <div className="min-h-[100dvh] bg-background" dir="rtl">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col border-l border-border/80 bg-card px-4 py-5 shadow-soft md:flex print:hidden" aria-label="القائمة الجانبية">
        <div className="px-2"><Logo to="/dashboard" /></div>
        <div className="mt-7 border-t border-border/70 pt-5">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">منصة المعلم</p>
          <nav className="space-y-1" aria-label="التنقل الرئيسي">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "border-s-2 border-primary bg-primary-soft/80 !text-primary-deep font-semibold", "aria-current": "page" }}
              >
                <item.icon className="size-[18px]" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "border-s-2 border-primary bg-primary-soft/80 !text-primary-deep font-semibold", "aria-current": "page" }}
              >
                <ShieldCheck className="size-[18px]" aria-hidden="true" />
                الإدارة
              </Link>
            )}
          </nav>
        </div>
        <div className="mt-auto space-y-2 border-t border-border/70 pt-4">
          <Link to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <Settings className="size-[18px]" aria-hidden="true" />
            الإعدادات
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start px-3 text-muted-foreground" aria-label="تسجيل الخروج">
            <LogOut aria-hidden="true" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur md:hidden print:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Logo to="/dashboard" />
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="تسجيل الخروج"><LogOut /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:mr-64 md:max-w-[calc(100%-16rem)] md:px-8 md:pb-12 print:max-w-none print:p-0">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur safe-bottom md:hidden print:hidden"
        aria-label="التنقل السفلي"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
          {nav.map((item) => (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                activeProps={{ className: "!text-primary font-semibold", "aria-current": "page" }}
              >
                <item.icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
