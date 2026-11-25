export type PortfolioTemplateId = "ministerial" | "midnight" | "rose" | "classic";

export interface PortfolioTheme {
  id: PortfolioTemplateId;
  name: string;
  subtitle: string;
  primary: string;
  primaryDeep: string;
  primaryMid: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  bg: string;
  surface: string;
  border: string;
  ink: string;
  muted: string;
  logoFilter: string;
}

export const PORTFOLIO_TEMPLATES: readonly PortfolioTheme[] = [
  {
    id: "ministerial",
    name: "زمردي وزاري",
    subtitle: "رسمي فاخر · الهوية التعليمية",
    primary: "#07584F",
    primaryDeep: "#06463F",
    primaryMid: "#087064",
    accent: "#C5A46D",
    accentSoft: "#F1E5C9",
    accentText: "#80643A",
    bg: "#F8F5EC",
    surface: "#F0ECE2",
    border: "#D8C9AA",
    ink: "#252A28",
    muted: "#586A66",
    logoFilter:
      "brightness(0) saturate(100%) invert(22%) sepia(28%) saturate(1320%) hue-rotate(122deg) brightness(92%) contrast(96%)",
  },
  {
    id: "midnight",
    name: "ليلي ومرجاني",
    subtitle: "حديث دافئ · طابع عصري",
    primary: "#1B2A4A",
    primaryDeep: "#121E38",
    primaryMid: "#2A406B",
    accent: "#D96B52",
    accentSoft: "#FBEAE5",
    accentText: "#A84A35",
    bg: "#F8F9FB",
    surface: "#EFF2F7",
    border: "#D2D9E5",
    ink: "#1E2430",
    muted: "#5B6577",
    logoFilter:
      "brightness(0) saturate(100%) invert(14%) sepia(34%) saturate(1250%) hue-rotate(192deg) brightness(92%) contrast(95%)",
  },
  {
    id: "rose",
    name: "وردي وذهبي",
    subtitle: "ناعم راقٍ · لمسة هادئة",
    primary: "#7A2E4D",
    primaryDeep: "#5D2039",
    primaryMid: "#943E60",
    accent: "#CFA872",
    accentSoft: "#F7ECEE",
    accentText: "#8A5E36",
    bg: "#FCF9FA",
    surface: "#F5EDF0",
    border: "#E3CED6",
    ink: "#2E2227",
    muted: "#6F5A62",
    logoFilter:
      "brightness(0) saturate(100%) invert(21%) sepia(36%) saturate(1350%) hue-rotate(296deg) brightness(90%) contrast(94%)",
  },
  {
    id: "classic",
    name: "رسمي دافئ",
    subtitle: "كلاسيكي هندسي · متزن",
    primary: "#1E4D45",
    primaryDeep: "#153832",
    primaryMid: "#2C685E",
    accent: "#B89352",
    accentSoft: "#F3ECD9",
    accentText: "#7C6130",
    bg: "#FBF9F4",
    surface: "#F2EDE1",
    border: "#D8CDB4",
    ink: "#262B28",
    muted: "#5C6863",
    logoFilter:
      "brightness(0) saturate(100%) invert(24%) sepia(24%) saturate(1050%) hue-rotate(122deg) brightness(90%) contrast(94%)",
  },
] as const;

export function getPortfolioTheme(template?: PortfolioTemplateId): PortfolioTheme {
  return PORTFOLIO_TEMPLATES.find((item) => item.id === template) ?? PORTFOLIO_TEMPLATES[0]!;
}

function hexToRgbTuple(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/** Normalize brand paints and apply selected portfolio template across all generated pages. */
export function applyPortfolioPalette(markup: string, template: PortfolioTemplateId = "ministerial"): string {
  const theme = getPortfolioTheme(template);
  const paints: Record<string, string> = {
    "#07594F": theme.primary,
    "#07584F": theme.primary,
    "#06463F": theme.primaryDeep,
    "#087064": theme.primaryMid,
    "#0A655A": theme.primaryMid,
    "#C5A15B": theme.accent,
    "#C5A46D": theme.accent,
    "#E0C98F": theme.accent,
    "#F1E5C9": theme.accentSoft,
    "#8A7041": theme.accentText,
    "#765F35": theme.accentText,
    "#80643A": theme.accentText,
    "#846C40": theme.accentText,
    "#F7F3EA": theme.bg,
    "#F8F5EC": theme.bg,
    "#F0ECE2": theme.surface,
    "#EDE7D9": theme.surface,
    "#D8C9AA": theme.border,
    "#D9CFBA": theme.border,
    "#202B2A": theme.ink,
    "#183331": theme.ink,
    "#252A28": theme.ink,
    "#293531": theme.ink,
    "#344A45": theme.ink,
    "#465650": theme.muted,
    "#465956": theme.muted,
    "#53635C": theme.muted,
    "#586A66": theme.muted,
    "#65716B": theme.muted,
    "#697773": theme.muted,
  };
  const primaryRgb = hexToRgbTuple(theme.primary);
  const accentRgb = hexToRgbTuple(theme.accent);
  const surfaceRgb = hexToRgbTuple(theme.surface);

  return markup.replace(/\b(style|fill|stroke|stop-color)="([^"]*)"/g, (_attribute, name: string, value: string) => {
    let next = value.replace(/#[0-9a-f]{6}\b/gi, (color) => paints[color.toUpperCase()] ?? color);
    if (template !== "ministerial") {
      next = next
        .replace(/rgba\(\s*7\s*,\s*88\s*,\s*79\s*,/g, `rgba(${primaryRgb},`)
        .replace(/rgba\(\s*197\s*,\s*164\s*,\s*109\s*,/g, `rgba(${accentRgb},`)
        .replace(/rgba\(\s*237\s*,\s*231\s*,\s*217\s*,/g, `rgba(${surfaceRgb},`);
    }
    return `${name}="${next}"`;
  });
}
