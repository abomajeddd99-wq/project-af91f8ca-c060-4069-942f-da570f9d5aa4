export interface RoyalCoverInput {
  name: string;
  school?: string;
  year?: string;
  details: string[];
  subtitle: string;
  date: string;
  layout: "royal" | "classic";
  accent: "gold" | "emerald";
}

const EMERALD = "#07584F";
const GOLD = "#C5A46D";
const IVORY = "#F8F5EC";
const CHARCOAL = "#252A28";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function detailMarkup(details: string[]): string {
  return details
    .filter((detail) => detail !== "")
    .map(
      (detail) => `
        <div style="position:relative;padding:8px 18px 8px 0;border-bottom:1px solid rgba(7,88,79,.14);color:#4E5B56;font-size:15px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word">
          <span aria-hidden="true" style="position:absolute;right:1px;top:19px;width:6px;height:6px;border:1px solid ${GOLD};transform:rotate(45deg);box-sizing:border-box"></span>
          <span style="white-space:pre-wrap">${escapeHtml(detail)}</span>
        </div>`,
    )
    .join("");
}

export function buildRoyalCover(input: RoyalCoverInput): string {
  const accent = input.accent === "emerald" ? EMERALD : GOLD;
  const isClassic = input.layout === "classic";
  const school = input.school
    ? `<div style="margin-top:9px;color:#4E5B56;font-size:17px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.school)}</div>`
    : "";
  const year = input.year
    ? `<div style="display:inline-block;max-width:100%;box-sizing:border-box;margin-top:14px;padding:7px 14px;border:1px solid ${accent};color:${EMERALD};font-size:13px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.year)}</div>`
    : "";
  const details = input.details.length
    ? `<div style="margin-top:18px">${detailMarkup(input.details)}</div>`
    : "";

  return `
    <section data-royal-page="true" data-royal-layout="${input.layout}" data-royal-accent="${input.accent}" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:${IVORY};color:${CHARCOAL};direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <defs>
          <pattern id="royal-cover-geometry" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M24 2 46 24 24 46 2 24Z M24 12 36 24 24 36 12 24Z" fill="none" stroke="${EMERALD}" stroke-width=".65" opacity=".14"/>
            <circle cx="24" cy="24" r="1.8" fill="${GOLD}" opacity=".34"/>
          </pattern>
          <linearGradient id="royal-cover-rule" x1="0" x2="1">
            <stop offset="0" stop-color="${GOLD}" stop-opacity=".12"/>
            <stop offset=".5" stop-color="${GOLD}" stop-opacity=".88"/>
            <stop offset="1" stop-color="${GOLD}" stop-opacity=".12"/>
          </linearGradient>
        </defs>
        <path d="M0 0H794V252H0Z" fill="url(#royal-cover-geometry)" opacity=".52"/>
        ${isClassic
          ? `<path d="M28 28H766V1095H28Z" fill="none" stroke="${accent}" stroke-width="1.2"/>
             <path d="M38 38H756V1085H38Z" fill="none" stroke="${EMERALD}" stroke-width=".55" opacity=".36"/>
             <path d="M28 28h38M28 28v38M766 28h-38M766 28v38M28 1095h38M28 1095v-38M766 1095h-38M766 1095v-38" fill="none" stroke="${GOLD}" stroke-width="2"/>`
          : `<path d="M0 0H794V10H0Z" fill="${EMERALD}"/>
             <path d="M0 10H794V12H0Z" fill="${GOLD}" opacity=".9"/>
             <path d="M0 858C154 833 250 878 387 855C532 831 653 850 794 817V1123H0Z" fill="${EMERALD}"/>
             <path d="M0 846C155 821 249 866 387 843C533 819 653 838 794 805" fill="none" stroke="url(#royal-cover-rule)" stroke-width="3"/>
             <path d="M0 869C156 847 257 891 394 868C535 845 659 863 794 834" fill="none" stroke="${IVORY}" stroke-width="1" opacity=".38"/>`}
      </svg>

      <div aria-hidden="true" style="position:absolute;top:53px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px;color:${EMERALD}">
          <span style="width:25px;height:25px;border:1px solid ${GOLD};transform:rotate(45deg);box-sizing:border-box"></span>
          <span style="margin-right:-25px;width:7px;height:7px;border-radius:50%;background:${EMERALD};border:1px solid ${IVORY};box-sizing:border-box"></span>
          <span style="margin-right:8px;font-family:Georgia,serif;font-size:12px;letter-spacing:.2em;color:#8C7146">ENJAZI</span>
        </div>
        <span style="font-size:11px;letter-spacing:.08em;color:#8C7146">إنجازي للمعلم</span>
      </div>

      <div aria-hidden="true" style="position:absolute;top:124px;left:64px;width:120px;height:1px;background:${GOLD};opacity:.72"></div>
      <div style="position:absolute;top:166px;left:64px;right:64px;max-width:666px;box-sizing:border-box">
        <div style="display:flex;align-items:center;gap:11px;color:#8C7146;font-size:12px;line-height:1.7;letter-spacing:.08em">
          <span aria-hidden="true" style="display:inline-block;width:24px;height:1px;background:${accent}"></span>
          <span>ملف مهني للعرض والمراجعة</span>
        </div>
        <h1 style="max-width:620px;margin:18px 0 0;color:${EMERALD};font-size:43px;font-weight:700;line-height:1.55;letter-spacing:-.025em;overflow-wrap:anywhere;word-break:break-word">ملف الإنجاز الوظيفي</h1>
        <div style="display:flex;align-items:center;gap:9px;margin-top:14px">
          <span style="width:54px;height:2px;background:${accent}"></span>
          <span style="width:20px;height:1px;background:#D9C9A9"></span>
        </div>
        <p style="max-width:610px;margin:21px 0 0;color:#53615B;font-size:17px;line-height:1.9;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap">${escapeHtml(input.subtitle)}</p>

        <div style="margin-top:35px;padding:18px 21px 20px;border-right:3px solid ${accent};background:rgba(255,255,255,.66);box-shadow:0 8px 22px rgba(37,42,40,.045);box-sizing:border-box">
          <div style="color:#8C7146;font-size:11px;letter-spacing:.04em">صاحب الملف</div>
          <div style="margin-top:5px;color:${CHARCOAL};font-size:27px;font-weight:700;line-height:1.6;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.name)}</div>
          ${school}
          ${year}
          ${details}
        </div>
      </div>

      ${isClassic
        ? `<div style="position:absolute;bottom:91px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-top:1px solid rgba(197,164,109,.7);padding-top:13px;color:#6A746E;font-size:11px;line-height:1.7">
             <span>إنجازي · ملف الإنجاز الوظيفي</span><span style="overflow-wrap:anywhere">${escapeHtml(input.date)}</span>
           </div>`
        : `<div style="position:absolute;bottom:94px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;gap:24px;color:${IVORY};font-size:11px;line-height:1.7">
             <span style="letter-spacing:.1em;color:#E4D5B6">ENJAZI · TEACHER PORTFOLIO</span><span style="overflow-wrap:anywhere;text-align:left">${escapeHtml(input.date)}</span>
           </div>`}
    </section>`;
}

export function buildRoyalClosing(): string {
  return `
    <section data-royal-page="true" data-royal-layout="closing" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:${IVORY};color:${CHARCOAL};direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <defs>
          <pattern id="royal-closing-geometry" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M24 2 46 24 24 46 2 24Z M24 12 36 24 24 36 12 24Z" fill="none" stroke="${EMERALD}" stroke-width=".65" opacity=".14"/>
            <circle cx="24" cy="24" r="1.8" fill="${GOLD}" opacity=".34"/>
          </pattern>
        </defs>
        <path d="M0 0H794V250H0Z" fill="url(#royal-closing-geometry)" opacity=".5"/>
        <path d="M0 0H794V10H0Z" fill="${EMERALD}"/>
        <path d="M0 10H794V12H0Z" fill="${GOLD}"/>
        <path d="M0 818C150 794 265 841 401 816C539 791 659 812 794 780V1123H0Z" fill="${EMERALD}"/>
        <path d="M0 807C152 783 263 830 401 805C540 780 659 801 794 769" fill="none" stroke="${GOLD}" stroke-width="3"/>
        <path d="M0 836C154 815 271 860 409 835C548 810 661 830 794 801" fill="none" stroke="${IVORY}" stroke-width="1" opacity=".38"/>
        <path d="M28 28H766V1095H28Z" fill="none" stroke="${GOLD}" stroke-width="1"/>
      </svg>
      <div aria-hidden="true" style="position:absolute;top:53px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px;color:${EMERALD}">
          <span style="width:25px;height:25px;border:1px solid ${GOLD};transform:rotate(45deg);box-sizing:border-box"></span>
          <span style="margin-right:-25px;width:7px;height:7px;border-radius:50%;background:${EMERALD};border:1px solid ${IVORY};box-sizing:border-box"></span>
          <span style="margin-right:8px;font-family:Georgia,serif;font-size:12px;letter-spacing:.2em;color:#8C7146">ENJAZI</span>
        </div>
        <span style="font-size:11px;color:#8C7146">ملف الإنجاز الوظيفي</span>
      </div>
      <div style="position:absolute;top:350px;left:76px;right:76px;text-align:center">
        <div aria-hidden="true" style="width:54px;height:54px;margin:0 auto 25px;border:1px solid ${GOLD};transform:rotate(45deg);box-sizing:border-box;position:relative">
          <span style="position:absolute;inset:11px;border:1px solid ${EMERALD}"></span>
        </div>
        <div style="color:#8C7146;font-size:12px;letter-spacing:.12em">ختام الملف</div>
        <h1 style="margin:12px 0 0;color:${EMERALD};font-size:35px;font-weight:700;line-height:1.6">شكرًا لاهتمامكم</h1>
        <div style="width:76px;height:2px;margin:17px auto 18px;background:${GOLD}"></div>
        <p style="max-width:530px;margin:0 auto;color:#53615B;font-size:17px;line-height:1.95;overflow-wrap:anywhere">يوثّق هذا الملف الممارسة المهنية ويهيئ مرجعًا واضحًا للعرض والمراجعة.</p>
      </div>
      <div style="position:absolute;bottom:94px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;color:${IVORY};font-size:11px;letter-spacing:.1em">
        <span>ENJAZI</span><span>ملف مهني للمعلم</span>
      </div>
    </section>`;
}
