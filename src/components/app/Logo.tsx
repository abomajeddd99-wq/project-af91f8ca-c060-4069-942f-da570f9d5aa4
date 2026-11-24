import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-9", className)}>
      <rect width="40" height="40" rx="12" className="fill-primary" />
      <path
        d="M20 7.5l3.4 5.9 6.6-1.5-1.5 6.6 5.9 3.4-5.9 3.4 1.5 6.6-6.6-1.5L20 36.3l-3.4-5.9-6.6 1.5 1.5-6.6-5.9-3.4 5.9-3.4-1.5-6.6 6.6 1.5z"
        className="fill-primary-foreground/15"
      />
      <path
        d="M14 20.5l4.2 4.2L26.5 16"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ to = "/", className }: { to?: "/" | "/dashboard"; className?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-xl font-bold text-primary-deep">إنجازي</span>
    </Link>
  );
}
