export interface EducationalCoverInput {
  name: string;
  school?: string;
  year?: string;
  educationOffice?: string;
  subject?: string;
  jobTitle?: string;
  subtitle: string;
  date: string;
  layout: "royal" | "classic";
  accent: "gold" | "emerald";
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

export function buildEducationalCover(input: EducationalCoverInput): string {
  const accent = input.accent === "emerald" ? EMERALD : GOLD;
  const rows = [
    coverRow("اسم المعلم", input.name, "person", 0),
    coverRow("المدرسة", input.school, "school", 1),
    coverRow("الإدارة التعليمية", input.educationOffice, "office", 2),
    coverRow("المسمى الوظيفي", input.jobTitle, "work", 3),
    coverRow("العام الدراسي", input.year, "calendar", 4),
  ].join("");

  return `
    <section data-royal-page="true" data-royal-layout="${escapeHtml(input.layout)}" data-royal-accent="${escapeHtml(input.accent)}" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:${IVORY};color:${INK};direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <defs>
          <pattern id="educational-cover-pattern" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M17 1 33 17 17 33 1 17Z M17 8 26 17 17 26 8 17Z" fill="none" stroke="${GOLD}" stroke-width=".65"/>
            <circle cx="17" cy="17" r="1" fill="${EMERALD}"/>
          </pattern>
          <linearGradient id="educational-cover-wash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#FFFDF8" stop-opacity=".97"/>
            <stop offset="1" stop-color="${IVORY}" stop-opacity=".15"/>
          </linearGradient>
        </defs>
        <path d="M0 0H794V1123H0Z" fill="url(#educational-cover-pattern)" opacity=".025"/>
        <path d="M0 0H456C361 36 263 93 178 165C99 233 39 310 0 398Z" fill="${DEEP_EMERALD}"/>
        <path d="M0 0H391C304 39 219 91 146 157C82 216 31 277 0 344Z" fill="#087064" opacity=".62"/>
        <path d="M0 0H340C251 42 175 91 108 154C55 204 19 252 0 292Z" fill="url(#educational-cover-wash)"/>
        <path d="M0 0H333C241 42 164 92 98 155C47 203 17 247 0 285" fill="none" stroke="${GOLD}" stroke-width="5"/>
        <path d="M0 0H310C221 42 149 90 84 151C39 194 13 232 0 267" fill="none" stroke="${IVORY}" stroke-width="3"/>
        <path d="M0 0H283C199 40 130 87 70 145C32 183 10 216 0 245" fill="none" stroke="${EMERALD}" stroke-width="2"/>
        <path d="M0 870C129 836 224 894 345 936C480 983 639 1029 794 965V1123H0Z" fill="${DEEP_EMERALD}"/>
        <path d="M0 870C129 836 224 894 345 936C480 983 639 1029 794 965" fill="none" stroke="${GOLD}" stroke-width="8"/>
        <path d="M0 882C128 848 225 906 348 948C483 995 641 1041 794 977" fill="none" stroke="${IVORY}" stroke-width="2" opacity=".88"/>
        <path d="M0 1060C141 1021 254 1095 395 1099C544 1102 675 1044 794 1057" fill="none" stroke="#0A655A" stroke-width="2" opacity=".9"/>
        <path d="M0 0H794V1123H0Z" fill="url(#educational-cover-pattern)" opacity=".045"/>
      </svg>

      <img data-ministry-logo="true" src="/ministry-of-education-logo-white.svg" alt="وزارة التعليم" style="position:absolute;top:18px;right:42px;width:192px;height:149px;object-fit:contain;filter:brightness(0) saturate(100%) invert(22%) sepia(28%) saturate(1320%) hue-rotate(122deg) brightness(92%) contrast(96%)">

      <svg aria-hidden="true" viewBox="0 0 132 514" style="position:absolute;left:0;top:325px;width:132px;height:514px;pointer-events:none">
        <defs>
          <linearGradient id="cover-window-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#D8E4D9"/>
            <stop offset="1" stop-color="#AFC6B8"/>
          </linearGradient>
          <linearGradient id="cover-shelf-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#E9E1D2"/>
            <stop offset="1" stop-color="#CFC5B4"/>
          </linearGradient>
        </defs>
        <path d="M0 0H91C71 77 91 157 117 228C133 273 132 378 114 514H0Z" fill="#DDE6DC" opacity=".44"/>
        <path d="M0 38H79C73 103 83 165 101 218H0Z" fill="url(#cover-window-glass)" opacity=".78"/>
        <path d="M9 49H70V210H9ZM38 49V210M9 105H70M9 157H70" fill="none" stroke="#F8F5EC" stroke-width="7" opacity=".9"/>
        <path d="M4 45H76V215H4Z" fill="none" stroke="#7D9B8C" stroke-width="4" opacity=".62"/>
        <path d="M0 337H121L132 355H0Z" fill="url(#cover-shelf-shade)"/>
        <path d="M0 355H132V370H0Z" fill="#B9AD99" opacity=".72"/>
        <path d="M11 322C27 315 47 315 66 322V334H11Z" fill="#E9E3D7" stroke="#C9B997" stroke-width="1.5"/>
        <path d="M8 309C26 302 48 303 68 310V321H8Z" fill="#F6F1E7" stroke="#BDAA83" stroke-width="1.5"/>
        <path d="M12 302H65" stroke="#D6C9AE" stroke-width="2"/>
        <path d="M20 284 15 246M31 284 34 238M42 284 51 248M55 284 62 256" stroke="${EMERALD}" stroke-width="3" stroke-linecap="round"/>
        <path d="M12 282H63L58 310H18Z" fill="#507E70" stroke="#E8DFC9" stroke-width="2"/>
        <path d="M20 290H55M22 297H53" stroke="#D9CBAE" stroke-width="1" opacity=".8"/>
      </svg>

      <main data-cover-content="true" style="position:absolute;top:144px;left:92px;right:92px;box-sizing:border-box;text-align:center">
        <div style="width:178px;height:94px;margin:0 auto 7px">
          <svg aria-hidden="true" width="178" height="94" viewBox="-5 0 142 77" style="display:block;width:178px;height:94px">${bookMotif()}</svg>
        </div>
        <div style="margin:0 auto;color:${EMERALD};font-size:50px;font-weight:800;line-height:1.18">ملف</div>
        <h1 style="margin:0 auto;color:${EMERALD};font-size:50px;font-weight:800;line-height:1.42;letter-spacing:-.025em;white-space:nowrap">شواهد الأداء الوظيفي</h1>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:4px auto 0">
          <span aria-hidden="true" style="width:92px;height:2px;background:${GOLD}"></span>
          <span style="display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:5px 32px;box-sizing:border-box;border:1px solid rgba(197,164,109,.62);border-radius:26px;background:#F1E5C9;color:#80643A;font-size:23px;font-weight:800;line-height:1.4;white-space:nowrap;box-shadow:0 5px 16px rgba(151,119,60,.08)">إنجازي للمعلم</span>
          <span aria-hidden="true" style="width:92px;height:2px;background:${GOLD}"></span>
        </div>
        ${input.subtitle ? `<p style="margin:8px auto 0;color:${MUTED};font-size:13px;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap">${escapeHtml(input.subtitle)}</p>` : ""}

        <div data-teacher-table="true" dir="rtl" style="width:100%;margin:28px auto 0;border:1.5px solid rgba(7,88,79,.5);border-radius:27px;background:rgba(255,253,248,.96);box-sizing:border-box;text-align:right;overflow:hidden;box-shadow:0 12px 30px rgba(37,53,46,.055)">
          <div dir="rtl" style="width:100%">
            ${rows}
          </div>
        </div>
      </main>

      <svg aria-hidden="true" viewBox="0 0 370 160" style="position:absolute;right:34px;bottom:72px;width:420px;height:182px">
        <defs>
          <linearGradient id="cover-book-pages" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#FFFDF8"/>
            <stop offset=".76" stop-color="#EFE6D4"/>
            <stop offset="1" stop-color="#D9C9A8"/>
          </linearGradient>
          <linearGradient id="cover-book-cover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0B6A5D"/>
            <stop offset="1" stop-color="#06463F"/>
          </linearGradient>
        </defs>
        <ellipse cx="187" cy="145" rx="162" ry="8" fill="#273B35" opacity=".14"/>
        <path d="M16 111C60 69 117 60 184 99C251 60 310 69 354 111C291 101 237 116 184 139C131 116 77 101 16 111Z" fill="url(#cover-book-cover)" stroke="${GOLD}" stroke-width="2.5"/>
        <path d="M22 105C63 63 120 54 184 94C248 54 305 63 346 105C288 96 236 108 184 132C132 108 80 96 22 105Z" fill="url(#cover-book-pages)" stroke="#B99A61" stroke-width="1.5"/>
        <path d="M184 94V133M30 101C74 90 126 100 177 128M338 101C294 90 242 100 191 128" fill="none" stroke="#B99A61" stroke-width="1.5"/>
        <path d="M37 92C78 67 126 67 175 97M331 92C290 67 242 67 193 97M50 82C89 65 130 70 174 99M318 82C279 65 238 70 194 99" fill="none" stroke="#D8C69E" stroke-width="1.4"/>
        <path d="M30 108C82 101 128 115 178 136M338 108C286 101 240 115 190 136" fill="none" stroke="#F7F1E4" stroke-width="2"/>
        <path d="M16 111 9 119C70 111 124 128 183 148C242 128 296 111 359 119L354 111M184 139V148" fill="none" stroke="${GOLD}" stroke-width="2"/>
      </svg>

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
