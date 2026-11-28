import { getPortfolioTheme, type PortfolioTemplateId } from "./portfolio-theme";
export interface EducationalCoverInput {
  name: string;
  school?: string;
  year?: string;
  educationOffice?: string;
  subject?: string;
  jobTitle?: string;
  subtitle: string;
  date: string;
  layout?: "royal" | "classic";
  accent?: "gold" | "emerald";
  template?: PortfolioTemplateId;
}

export interface EducationalCvInput {
  profile: {
    full_name?: string | null;
    job_title?: string | null;
    subject?: string | null;
    stage?: string | null;
    school?: string | null;
    education_office?: string | null;
    academic_year?: string | null;
    years_experience?: number | null;
  } | null;
  bio?: string;
  pageIndex: number;
  pageCount: number;
}

const EMERALD = "#07584F";
const DEEP_EMERALD = "#06463F";
const GOLD = "#C5A46D";
const INK = "#293531";
const MUTED = "#65716B";
const IVORY = "#F8F5EC";
const PALE = "#F0ECE2";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function coverIcon(kind: "person" | "school" | "office" | "work" | "calendar"): string {
  const paths: Record<typeof kind, string> = {
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20v-1.6a6.5 6.5 0 0 1 13 0V20z"/>',
    school: '<path d="M3 20h18M5 20v-9l7-4 7 4v9M9 20v-5h6v5M8 12h.01M12 11h.01M16 12h.01"/><path d="m9 7 3-3 3 3"/>',
    office: '<path d="M4 20V5h10v15M14 10h6v10M7 8h1M10 8h1M7 11h1M10 11h1M7 14h1M10 14h1M17 13h1M17 16h1M2 20h20"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M17 14h.01M7 17h2M12 17h2"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" style="display:block;width:28px;height:28px;fill:none;stroke:${EMERALD};stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round">${paths[kind]}</svg>`;
}

function coverRow(label: string, value: string | undefined, icon: Parameters<typeof coverIcon>[0], index: number): string {
  return `
    <div data-teacher-field="${icon}" dir="rtl" style="display:grid;grid-template-columns:42px minmax(156px,178px) minmax(0,1fr);align-items:center;gap:14px;min-height:62px;padding:9px 20px;box-sizing:border-box;${index < 4 ? "border-bottom:1px solid rgba(7,88,79,.16);" : ""}">
      <span style="display:flex;align-items:center;justify-content:center">${coverIcon(icon)}</span>
      <span style="color:${EMERALD};font-size:17px;line-height:1.45;font-weight:700;white-space:nowrap">${label}</span>
      <span style="min-width:0;color:${INK};font-size:17px;line-height:1.55;text-align:right;overflow-wrap:anywhere;word-break:normal;white-space:pre-wrap">${escapeHtml(value || "—")}</span>
    </div>`;
}

function bookMotif(): string {
  return `
    <g aria-hidden="true" transform="translate(0 0)">
      <path d="M0 22C20 9 42 8 66 17V67C41 58 20 59 0 72Z" fill="${IVORY}" stroke="${GOLD}" stroke-width="2"/>
      <path d="M0 22C20 9 42 8 66 17V67C41 58 20 59 0 72Z" fill="none" stroke="${EMERALD}" stroke-width="1"/>
      <path d="M132 22C112 9 90 8 66 17V67C91 58 112 59 132 72Z" fill="${IVORY}" stroke="${GOLD}" stroke-width="2"/>
      <path d="M132 22C112 9 90 8 66 17V67C91 58 112 59 132 72Z" fill="none" stroke="${EMERALD}" stroke-width="1"/>
      <path d="M66 17V69M12 29C29 23 43 24 55 29M12 40C28 35 42 36 55 40M120 29C103 23 89 24 77 29M120 40C104 35 90 36 77 40" fill="none" stroke="${GOLD}" stroke-width="1.2" opacity=".9"/>
      <path d="M-3 74C20 67 43 66 66 73C89 66 112 67 135 74" fill="none" stroke="${EMERALD}" stroke-width="2"/>
    </g>`;
}

function saudiEmblem(color: string): string {
  return `
    <svg aria-hidden="true" viewBox="0 0 120 110" style="position:absolute;left:56px;bottom:26px;width:82px;height:75px;pointer-events:none">
      <g fill="${color}" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
        <rect x="57" y="28" width="6" height="36" rx="2" stroke="none"/>
        <path d="M60 28 C52 14 38 11 26 17 C38 18 48 22 57 31 Z" stroke="none"/>
        <path d="M60 28 C68 14 82 11 94 17 C82 18 72 22 63 31 Z" stroke="none"/>
        <path d="M60 26 C55 11 45 5 35 6 C46 11 53 18 58 29 Z" stroke="none"/>
        <path d="M60 26 C65 11 75 5 85 6 C74 11 67 18 62 29 Z" stroke="none"/>
        <path d="M60 24 C59 10 60 3 60 2 C61 10 61 18 60 26 Z" stroke="none"/>
        <path d="M58 34 C46 27 33 28 24 35 C35 33 46 34 57 39 Z" stroke="none"/>
        <path d="M62 34 C74 27 87 28 96 35 C85 33 74 34 63 39 Z" stroke="none"/>
        <path d="M22 78 Q56 76 92 54" fill="none" stroke-width="4.2"/>
        <path d="M98 78 Q64 76 28 54" fill="none" stroke-width="4.2"/>
        <path d="M24 72 L15 84 M29 82 L17 75" fill="none" stroke-width="2.8"/>
        <path d="M96 72 L105 84 M91 82 L103 75" fill="none" stroke-width="2.8"/>
      </g>
    </svg>`;
}

function themedCoverIcon(kind: "person" | "school" | "office" | "work" | "calendar", color: string): string {
  const paths: Record<typeof kind, string> = {
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20v-1.6a6.5 6.5 0 0 1 13 0V20z"/>',
    school: '<path d="M3 20h18M5 20v-9l7-4 7 4v9M9 20v-5h6v5M8 12h.01M12 11h.01M16 12h.01"/><path d="m9 7 3-3 3 3"/>',
    office: '<path d="M4 20V5h10v15M14 10h6v10M7 8h1M10 8h1M7 11h1M10 11h1M7 14h1M10 14h1M17 13h1M17 16h1M2 20h20"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M17 14h.01M7 17h2M12 17h2"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" style="display:block;width:26px;height:26px;fill:none;stroke:${color};stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">${paths[kind]}</svg>`;
}

function themedCoverRows(input: EducationalCoverInput, primary: string, ink: string, divider: string): string {
  const entries: [string, string | undefined, "person" | "school" | "office" | "work" | "calendar"][] = [
    ["اسم المعلم", input.name, "person"],
    ["المدرسة", input.school, "school"],
    ["الإدارة التعليمية", input.educationOffice, "office"],
    ["المسمى الوظيفي", input.jobTitle, "work"],
    ["العام الدراسي", input.year, "calendar"],
  ];
  return entries
    .map(
      ([label, value, icon], index) => `
    <div data-teacher-field="${icon}" dir="rtl" style="display:grid;grid-template-columns:40px minmax(150px,172px) minmax(0,1fr);align-items:center;gap:14px;min-height:60px;padding:9px 20px;box-sizing:border-box;${index < 4 ? `border-bottom:1px solid ${divider};` : ""}">
      <span style="display:flex;align-items:center;justify-content:center">${themedCoverIcon(icon, primary)}</span>
      <span style="color:${primary};font-size:16.5px;line-height:1.45;font-weight:700;white-space:nowrap">${label}</span>
      <span style="min-width:0;color:${ink};font-size:16.5px;line-height:1.55;text-align:right;overflow-wrap:anywhere;word-break:normal;white-space:pre-wrap">${escapeHtml(value || "—")}</span>
    </div>`,
    )
    .join("");
}

export function buildEducationalCover(input: EducationalCoverInput): string {
  const template = input.template ?? "ministerial";
  const theme = getPortfolioTheme(template);
  const rows = themedCoverRows(input, theme.primary, theme.ink, theme.border);
  const ministryLogo = `<img data-ministry-logo="true" src="/ministry-of-education-logo-white.svg" alt="وزارة التعليم" style="position:absolute;top:20px;right:42px;width:184px;height:142px;object-fit:contain;filter:${theme.logoFilter}">`;

  if (template === "midnight") {
    return `
    <section data-royal-page="true" data-royal-layout="midnight" data-royal-accent="coral" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:${theme.bg};color:${theme.ink};direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <defs>
          <pattern id="midnight-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="2" fill="${theme.primary}" opacity=".16"/>
          </pattern>
        </defs>
        <path d="M0 0H320C270 115 165 215 0 265Z" fill="${theme.primary}"/>
        <path d="M0 0H245C195 95 110 175 0 212Z" fill="${theme.primaryMid}" opacity=".65"/>
        <circle cx="242" cy="186" r="28" fill="${theme.accent}" opacity=".92"/>
        <rect x="26" y="220" width="132" height="110" fill="url(#midnight-dots)"/>
        <path d="M0 950 C210 910 530 1005 794 928 V1123 H0Z" fill="${theme.primary}"/>
        <path d="M0 950 C210 910 530 1005 794 928" fill="none" stroke="${theme.accent}" stroke-width="6"/>
        <rect x="22" y="22" width="750" height="1079" rx="18" fill="none" stroke="${theme.border}" stroke-width="1.2"/>
      </svg>
      ${ministryLogo}
      <main data-cover-content="true" style="position:absolute;top:164px;left:82px;right:82px;box-sizing:border-box;text-align:center">
        <div style="display:inline-flex;align-items:center;gap:10px;padding:7px 22px;border-radius:999px;background:${theme.accentSoft};border:1px solid ${theme.accent};color:${theme.accentText};font-size:14px;font-weight:700">ملف توثيق الأداء المهني</div>
        <div style="margin:18px auto 0;color:${theme.primary};font-size:46px;font-weight:800;line-height:1.2">ملف</div>
        <h1 style="margin:0 auto;color:${theme.primary};font-size:48px;font-weight:800;line-height:1.4;letter-spacing:-.02em;white-space:nowrap">شواهد الأداء الوظيفي</h1>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:10px auto 0">
          <span aria-hidden="true" style="width:86px;height:3px;border-radius:2px;background:${theme.accent}"></span>
          <span style="padding:6px 26px;border-radius:999px;background:${theme.primary};color:#FFFFFF;font-size:19px;font-weight:700">إنجازي للمعلم</span>
          <span aria-hidden="true" style="width:86px;height:3px;border-radius:2px;background:${theme.accent}"></span>
        </div>
        ${input.subtitle ? `<p style="margin:10px auto 0;color:${theme.muted};font-size:14px;line-height:1.5;overflow-wrap:anywhere">${escapeHtml(input.subtitle)}</p>` : ""}
        <div data-teacher-table="true" dir="rtl" style="width:100%;margin:30px auto 0;border:1.5px solid ${theme.border};border-top:4px solid ${theme.accent};border-radius:22px;background:#FFFFFF;box-sizing:border-box;text-align:right;overflow:hidden;box-shadow:0 14px 32px rgba(27,42,74,.07)">
          ${rows}
        </div>
      </main>
      <span style="position:absolute;left:180px;right:180px;bottom:42px;color:#FFFFFF;font-size:9.5px;line-height:1.4;text-align:center;white-space:nowrap;opacity:.9">منصة إنجازي مستقلة ولا تمثل وزارة التعليم</span>
      <span dir="ltr" style="position:absolute;right:46px;bottom:34px;color:#FFFFFF;font-family:system-ui,sans-serif;font-size:10.5px;letter-spacing:.04em">${escapeHtml(input.date)}</span>
    </section>`;
  }

  if (template === "rose") {
    return `
    <section data-royal-page="true" data-royal-layout="rose" data-royal-accent="gold" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:${theme.bg};color:${theme.ink};direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <defs>
          <pattern id="rose-lattice" width="38" height="38" patternUnits="userSpaceOnUse">
            <path d="M19 2 36 19 19 36 2 19Z" fill="none" stroke="${theme.accent}" stroke-width=".6" opacity=".28"/>
            <circle cx="19" cy="19" r="1.4" fill="${theme.primary}" opacity=".2"/>
          </pattern>
        </defs>
        <rect width="794" height="1123" fill="url(#rose-lattice)" opacity=".28"/>
        <path d="M0 0H390C305 52 215 120 130 212C76 270 30 330 0 385Z" fill="${theme.primary}"/>
        <path d="M0 0H312C236 52 156 112 85 186C44 228 16 266 0 298" fill="none" stroke="${theme.accent}" stroke-width="5"/>
        <circle cx="176" cy="242" r="16" fill="${theme.accent}" opacity=".85"/>
        <circle cx="212" cy="212" r="7" fill="${theme.primaryMid}" opacity=".7"/>
        <path d="M0 915 C160 870 310 970 500 975 C635 979 725 948 794 918 V1123 H0Z" fill="${theme.primary}"/>
        <path d="M0 915 C160 870 310 970 500 975 C635 979 725 948 794 918" fill="none" stroke="${theme.accent}" stroke-width="6"/>
        <rect x="24" y="24" width="746" height="1075" rx="22" fill="none" stroke="${theme.accent}" stroke-width="1" opacity=".7"/>
      </svg>
      ${ministryLogo}
      <main data-cover-content="true" style="position:absolute;top:154px;left:86px;right:86px;box-sizing:border-box;text-align:center">
        <div style="width:166px;height:86px;margin:0 auto 6px">
          <svg aria-hidden="true" width="166" height="86" viewBox="-5 0 142 77" style="display:block;width:166px;height:86px">${bookMotif()}</svg>
        </div>
        <div style="margin:0 auto;color:${theme.primary};font-size:46px;font-weight:800;line-height:1.18">ملف</div>
        <h1 style="margin:0 auto;color:${theme.primary};font-size:48px;font-weight:800;line-height:1.42;letter-spacing:-.02em;white-space:nowrap">شواهد الأداء الوظيفي</h1>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:6px auto 0">
          <span aria-hidden="true" style="width:88px;height:2px;background:${theme.accent}"></span>
          <span style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:4px 30px;border:1px solid ${theme.accent};border-radius:999px;background:${theme.accentSoft};color:${theme.primary};font-size:21px;font-weight:800">إنجازي للمعلم</span>
          <span aria-hidden="true" style="width:88px;height:2px;background:${theme.accent}"></span>
        </div>
        ${input.subtitle ? `<p style="margin:8px auto 0;color:${theme.muted};font-size:13.5px;line-height:1.5;overflow-wrap:anywhere">${escapeHtml(input.subtitle)}</p>` : ""}
        <div data-teacher-table="true" dir="rtl" style="width:100%;margin:28px auto 0;border:1.5px solid ${theme.border};border-radius:26px;background:rgba(255,255,255,.95);box-sizing:border-box;text-align:right;overflow:hidden;box-shadow:0 12px 28px rgba(122,46,77,.07)">
          ${rows}
        </div>
      </main>
      <span style="position:absolute;left:180px;right:180px;bottom:42px;color:#FFFFFF;font-size:9.5px;line-height:1.4;text-align:center;white-space:nowrap">منصة إنجازي مستقلة ولا تمثل وزارة التعليم</span>
      <span dir="ltr" style="position:absolute;right:46px;bottom:34px;color:#FFFFFF;font-family:system-ui,sans-serif;font-size:10.5px;letter-spacing:.04em">${escapeHtml(input.date)}</span>
    </section>`;
  }

  if (template === "classic") {
    return `
    <section data-royal-page="true" data-royal-layout="classic" data-royal-accent="gold" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:${theme.bg};color:${theme.ink};direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <rect x="0" y="0" width="794" height="18" fill="${theme.primary}"/>
        <rect x="0" y="18" width="794" height="4" fill="${theme.accent}"/>
        <rect x="28" y="36" width="738" height="1051" fill="none" stroke="${theme.accent}" stroke-width="1.8"/>
        <rect x="38" y="46" width="718" height="1031" fill="none" stroke="${theme.primary}" stroke-width=".9" opacity=".55"/>
        <path d="M28 74H66V36M766 74H728V36M28 1049H66V1087M766 1049H728V1087" fill="none" stroke="${theme.primary}" stroke-width="2.2"/>
        <rect x="0" y="1028" width="794" height="95" fill="${theme.primary}"/>
        <rect x="0" y="1024" width="794" height="4" fill="${theme.accent}"/>
      </svg>
      ${ministryLogo}
      <div style="position:absolute;top:62px;left:64px;padding:6px 16px;border:1px solid ${theme.accent};border-radius:8px;background:${theme.surface};color:${theme.primary};font-size:12px;font-weight:700">ملف الإنجاز الرسمي</div>
      <main data-cover-content="true" style="position:absolute;top:178px;left:84px;right:84px;box-sizing:border-box;text-align:center">
        <div style="width:166px;height:86px;margin:0 auto 10px">
          <svg aria-hidden="true" width="166" height="86" viewBox="-5 0 142 77" style="display:block;width:166px;height:86px">${bookMotif()}</svg>
        </div>
        <div style="margin:0 auto;color:${theme.primary};font-size:46px;font-weight:800;line-height:1.18">ملف</div>
        <h1 style="margin:0 auto;color:${theme.primary};font-size:48px;font-weight:800;line-height:1.42;letter-spacing:-.02em;white-space:nowrap">شواهد الأداء الوظيفي</h1>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:10px auto 0">
          <span aria-hidden="true" style="width:94px;height:1.5px;background:${theme.accent}"></span>
          <span style="padding:5px 28px;border:1.5px solid ${theme.accent};border-radius:8px;background:${theme.accentSoft};color:${theme.accentText};font-size:21px;font-weight:800">إنجازي للمعلم</span>
          <span aria-hidden="true" style="width:94px;height:1.5px;background:${theme.accent}"></span>
        </div>
        ${input.subtitle ? `<p style="margin:8px auto 0;color:${theme.muted};font-size:13.5px;line-height:1.5;overflow-wrap:anywhere">${escapeHtml(input.subtitle)}</p>` : ""}
        <div data-teacher-table="true" dir="rtl" style="width:100%;margin:30px auto 0;border:1.5px solid ${theme.accent};border-radius:14px;background:#FFFFFF;box-sizing:border-box;text-align:right;overflow:hidden;box-shadow:0 10px 26px rgba(30,77,69,.05)">
          <div style="padding:10px 20px;background:${theme.primary};color:#FFFFFF;font-size:14px;font-weight:700">البيانات الأساسية للمعلم</div>
          ${rows}
        </div>
      </main>
      <span style="position:absolute;left:180px;right:180px;bottom:42px;color:${theme.bg};font-size:9.5px;line-height:1.4;text-align:center;white-space:nowrap">منصة إنجازي مستقلة ولا تمثل وزارة التعليم</span>
      <span dir="ltr" style="position:absolute;right:56px;bottom:34px;color:${theme.bg};font-family:system-ui,sans-serif;font-size:10.5px;letter-spacing:.04em">${escapeHtml(input.date)}</span>
    </section>`;
  }

  // القالب الأول: زمردي وزاري
  const ministerialCoverImageSrc = "/images/ministerial-cover.jpeg";

  return `
    <section data-royal-page="true" data-royal-layout="${escapeHtml(input.layout ?? "royal")}" data-royal-accent="${escapeHtml(input.accent ?? "gold")}" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:${IVORY};color:${INK};direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <img
        data-ministerial-cover-image="true"
        src="${ministerialCoverImageSrc}"
        alt="غلاف شواهد الأداء الوظيفي"
        onerror="this.style.display='none'"
        style="position:absolute;top:0;left:0;width:794px;height:1123px;object-fit:cover;object-position:center;pointer-events:none"
      >

      ${ministryLogo}

      <main data-cover-content="true" style="position:absolute;top:144px;left:92px;right:92px;box-sizing:border-box;text-align:center">
        <div style="width:178px;height:94px;margin:0 auto 7px"></div>
        <div style="margin:0 auto;color:${EMERALD};font-size:50px;font-weight:800;line-height:1.18">ملف</div>
        <h1 style="margin:0 auto;color:${EMERALD};font-size:50px;font-weight:800;line-height:1.42;letter-spacing:-.025em;white-space:nowrap">شواهد الأداء الوظيفي</h1>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:4px auto 0">
          <span aria-hidden="true" style="width:92px;height:2px;background:${GOLD}"></span>
          <span style="display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:5px 32px;box-sizing:border-box;border:1px solid rgba(197,164,109,.65);border-radius:26px;background:#F1E5C9;color:#80643A;font-size:23px;font-weight:800;line-height:1.4;white-space:nowrap;box-shadow:0 5px 16px rgba(151,119,60,.08)">إنجازي للمعلم</span>
          <span aria-hidden="true" style="width:92px;height:2px;background:${GOLD}"></span>
        </div>
        ${input.subtitle ? `<p style="margin:8px auto 0;color:${MUTED};font-size:13px;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap">${escapeHtml(input.subtitle)}</p>` : ""}

        <div data-teacher-table="true" dir="rtl" style="width:100%;margin:28px auto 0;border:1.5px solid rgba(7,88,79,.5);border-radius:27px;background:rgba(255,253,248,.96);box-sizing:border-box;text-align:right;overflow:hidden;box-shadow:0 12px 30px rgba(37,53,46,.055)">
          <div dir="rtl" style="width:100%">
            ${rows}
          </div>
        </div>
      </main>

      ${saudiEmblem("#E5CF9E")}

      <span style="position:absolute;left:204px;right:204px;bottom:42px;color:${IVORY};font-size:9px;line-height:1.4;text-align:center;white-space:nowrap">منصة إنجازي مستقلة ولا تمثل وزارة التعليم</span>
      <span dir="ltr" style="position:absolute;right:42px;bottom:34px;color:${IVORY};font-family:system-ui,sans-serif;font-size:10px;letter-spacing:.04em">${escapeHtml(input.date)}</span>
    </section>`;
}

function cvSectionHeading(title: string, index: string): string {
  return `
    <div style="display:flex;align-items:center;gap:10px;margin:18px 0 9px;padding-bottom:7px;border-bottom:1px solid #D9CFBA">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border:1px solid ${GOLD};border-radius:50%;color:#846C40;font-family:Georgia,serif;font-size:10px">${index}</span>
      <h2 style="margin:0;color:${EMERALD};font-size:14px;line-height:1.5;font-weight:700">${title}</h2>
    </div>`;
}

function cvRow(label: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `
    <div style="min-width:0;padding:9px 12px;border-right:2px solid ${GOLD};background:${IVORY};box-sizing:border-box">
      <div style="color:${MUTED};font-size:10px;line-height:1.5">${label}</div>
      <div style="margin-top:3px;color:${INK};font-size:13px;font-weight:600;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap">${escapeHtml(value)}</div>
    </div>`;
}

export function buildEducationalCv(input: EducationalCvInput): string {
  const profile = input.profile;
  const pageIndex = Math.max(0, Math.floor(input.pageIndex));
  const bio = input.bio ?? "";

  if (pageIndex > 0) {
    return `
      <div dir="rtl" style="margin-top:5px;color:${INK};font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #D9CFBA;padding:0 0 10px">
          <div style="color:${EMERALD};font-size:17px;font-weight:700;line-height:1.6">السيرة المهنية</div>
          <div style="color:#8C7146;font-size:11px">تكملة ${escapeHtml(pageIndex + 1)} من ${escapeHtml(input.pageCount)}</div>
        </div>
        ${bio ? `<section style="margin-top:19px;padding:17px 18px;background:${PALE};border-right:3px solid ${GOLD};box-sizing:border-box">
          <div style="color:#765F35;font-size:11px;font-weight:700;line-height:1.6">نبذة مهنية · متابعة</div>
          <div style="margin-top:8px;color:#40514E;font-size:14px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(bio)}</div>
        </section>` : ""}
      </div>`;
  }

  const hasIdentity = Boolean(profile?.full_name || profile?.subject || profile?.stage);
  const nameBlock = profile?.full_name
    ? `<div style="padding:1px 0 13px;border-bottom:1px solid #D9CFBA">
        <div style="color:#8C7146;font-size:10px;line-height:1.5;letter-spacing:.025em">البيانات الشخصية والمهنية</div>
        <h1 style="margin:4px 0 0;color:${EMERALD};font-size:24px;line-height:1.5;font-weight:700;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(profile.full_name)}</h1>
      </div>`
    : `<div style="padding:1px 0 13px;border-bottom:1px solid #D9CFBA;color:${EMERALD};font-size:17px;font-weight:700">البيانات الشخصية والمهنية</div>`;
  const specialization = [
    cvRow("التخصص", profile?.subject),
    cvRow("المرحلة الدراسية", profile?.stage),
  ].filter(Boolean).join("");
  const career = [
    cvRow("المسمى الوظيفي", profile?.job_title),
    cvRow("جهة العمل · المدرسة", profile?.school),
    cvRow("إدارة التعليم", profile?.education_office),
    cvRow("العام الدراسي", profile?.academic_year),
    profile?.years_experience !== null && profile?.years_experience !== undefined
      ? cvRow("سنوات الخبرة", `${profile.years_experience} سنة`)
      : "",
  ].filter(Boolean).join("");

  return `
    <div dir="rtl" style="margin-top:5px;color:${INK};font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      ${nameBlock}
      ${specialization ? `${cvSectionHeading("التخصص والمرحلة", "١")}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${specialization}</div>` : ""}
      ${career ? `${cvSectionHeading("المسار المهني", "٢")}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${career}</div>` : ""}
      ${bio ? `${cvSectionHeading("نبذة مهنية", career || specialization ? "٣" : "١")}<div style="padding:13px 15px;background:${PALE};border-right:2px solid ${GOLD};color:#40514E;font-size:13px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(bio)}</div>` : ""}
      ${!hasIdentity && !career && !bio ? `<div style="margin-top:16px;padding:13px 15px;background:${IVORY};border-right:2px solid ${GOLD};color:${MUTED};font-size:12px;line-height:1.7">لا تتوفر بيانات شخصية أو مهنية في الملف الشخصي.</div>` : ""}
    </div>`;
}
