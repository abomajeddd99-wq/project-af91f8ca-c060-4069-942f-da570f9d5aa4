export interface StandardCoverContent {
  number: number;
  code: string;
  title: string;
  description: string | null;
  indicators: string[];
  notes: string | null;
  status?: string;
  weight?: number | string | null;
  evidenceCount?: number;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatStandardNumber(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.trunc(value) : 0;
  return String(Math.max(0, safeValue)).padStart(2, "0");
}

export function buildStandardCover(input: StandardCoverContent): string {
  const number = formatStandardNumber(input.number);
  const dense =
    input.indicators.length > 7 ||
    (input.description?.length ?? 0) > 650 ||
    (input.notes?.length ?? 0) > 320;

  const metaPills: string[] = [];
  if (input.weight !== null && input.weight !== undefined && String(input.weight).trim() !== "") {
    metaPills.push(`الوزن النسبي: ${escapeHtml(input.weight)}%`);
  }
  if (typeof input.evidenceCount === "number") {
    metaPills.push(`الشواهد المرفقة: ${input.evidenceCount}`);
  }
  if (input.status) {
    metaPills.push(`الحالة: ${escapeHtml(input.status)}`);
  }

  const pillsMarkup = metaPills.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">${metaPills
        .map(
          (pill) =>
            `<span style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;border:1px solid rgba(197,164,109,.55);background:#F0ECE2;color:#07584F;font-size:12px;font-weight:600;line-height:1.5">${pill}</span>`,
        )
        .join("")}</div>`
    : "";

  const indicatorMarkup = input.indicators
    .map(
      (indicator, idx) => `
        <li style="display:flex;align-items:flex-start;gap:12px;margin:0;padding:${dense ? "8px 12px" : "10px 14px"};border-radius:12px;border:1px solid rgba(7,88,79,.12);border-right:3px solid #C5A46D;background:rgba(255,255,255,.78);color:#344A45;font-size:${dense ? "14.5px" : "15.5px"};line-height:1.68;overflow-wrap:anywhere;word-break:break-word">
          <span aria-hidden="true" dir="ltr" style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-top:2px;border-radius:8px;background:#F1E5C9;color:#80643A;font-size:11px;font-weight:700">${String(idx + 1).padStart(2, "0")}</span>
          <span style="white-space:pre-wrap;flex:1">${escapeHtml(indicator)}</span>
        </li>`,
    )
    .join("");

  const descriptionMarkup = input.description
    ? `<p style="margin:12px 0 0;color:#53635C;font-size:15px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.description)}</p>`
    : "";

  const notesMarkup = input.notes
    ? `<section aria-label="ملاحظات" style="margin-top:16px;padding:12px 16px;border-radius:12px;border:1px solid rgba(197,164,109,.45);border-right:3px solid #C5A46D;background:rgba(237,231,217,.68)">
        <div style="margin-bottom:4px;color:#8A7041;font-size:12px;font-weight:700;letter-spacing:.03em">ملاحظات المعلم</div>
        <div style="color:#465650;font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.notes)}</div>
      </section>`
    : "";

  return `
    <section data-standard-cover="true" data-standard-number="${escapeHtml(number)}" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:#F8F5EC;color:#252A28;direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <defs>
          <pattern id="standard-geometry" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M21 1 41 21 21 41 1 21Z M21 11 31 21 21 31 11 21Z" fill="none" stroke="#07584F" stroke-width=".65" opacity=".14"/>
            <circle cx="21" cy="21" r="1.8" fill="#C5A46D" opacity=".28"/>
          </pattern>
          <linearGradient id="standard-wave-gold" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#C5A46D" stop-opacity=".45"/>
            <stop offset=".5" stop-color="#E0C98F" stop-opacity=".82"/>
            <stop offset="1" stop-color="#C5A46D" stop-opacity=".4"/>
          </linearGradient>
        </defs>
        <path d="M0 0H794V248H0Z" fill="url(#standard-geometry)" opacity=".45"/>
        <path d="M0 0H794V12H0Z" fill="#07584F"/>
        <path d="M0 12H794V16H0Z" fill="#C5A46D" opacity=".85"/>
        <path d="M24 26H770V1097H24Z" fill="none" stroke="#C5A46D" stroke-width="1"/>
        <path d="M32 34H762V1089H32Z" fill="none" stroke="#07584F" stroke-width=".55" opacity=".28"/>
        <path d="M0 1052 C139 1009 234 1087 378 1051 C525 1014 629 1028 794 986 V1123 H0Z" fill="#07584F"/>
        <path d="M0 1040 C139 997 234 1075 378 1039 C525 1002 629 1016 794 974" fill="none" stroke="url(#standard-wave-gold)" stroke-width="4"/>
        <path d="M0 1061 C148 1025 246 1098 389 1061 C540 1023 648 1042 794 1002" fill="none" stroke="#F8F5EC" stroke-width="1" opacity=".42"/>
      </svg>

      <div aria-hidden="true" style="position:absolute;top:48px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;color:#07584F">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:#07584F;color:#F8F5EC;font-size:13px;font-weight:700">إ</span>
          <span style="color:#07584F;font-size:13px;font-weight:700">منصة إنجازي · بطاقة المعيار</span>
        </div>
        <span dir="ltr" style="padding:3px 12px;border-radius:999px;border:1px solid #C5A46D;background:rgba(255,255,255,.85);font-family:Georgia,serif;font-size:12px;letter-spacing:.12em;color:#8A7041;font-weight:700">STD ${escapeHtml(input.code)}</span>
      </div>

      <div aria-hidden="true" dir="ltr" style="position:absolute;top:82px;left:54px;color:rgba(7,88,79,.08);font-family:Georgia,'Times New Roman',serif;font-size:195px;font-weight:700;line-height:1;letter-spacing:-.06em">${escapeHtml(number)}</div>

      <div data-standard-viewport="true" style="position:absolute;top:172px;bottom:142px;left:64px;right:64px;box-sizing:border-box;display:flex;align-items:flex-start;justify-content:center">
        <div data-standard-body="true" data-standard-density="${dense ? "dense" : "standard"}" style="position:relative;box-sizing:border-box;width:100%;height:auto;padding:0 0 2px;display:flex;flex-direction:column">
          <div style="padding:20px 24px;border-radius:18px;border:1px solid rgba(7,88,79,.16);background:rgba(255,255,255,.86);box-shadow:0 8px 24px rgba(7,88,79,.04)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;color:#8A7041;font-size:12px;font-weight:700;line-height:1.5">
              <span aria-hidden="true" style="width:6px;height:18px;border-radius:3px;background:#07584F"></span>
              <span>المعيار رقم ${escapeHtml(number)} · عناصر التقييم المهني</span>
              <span aria-hidden="true" style="flex:1;height:1px;background:rgba(197,164,109,.6)"></span>
            </div>
            <h1 style="margin:0;color:#07584F;font-size:${dense ? "28px" : "32px"};font-weight:800;line-height:1.48;letter-spacing:-.02em;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap">${escapeHtml(input.title)}</h1>
            ${descriptionMarkup}
            ${pillsMarkup}
          </div>

          ${
            input.indicators.length
              ? `
            <section aria-label="المؤشرات" style="margin-top:20px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                <span aria-hidden="true" style="width:5px;height:17px;border-radius:3px;background:#C5A46D"></span>
                <h2 style="margin:0;color:#07584F;font-size:15px;font-weight:700">مؤشرات وبنود التحقق (${input.indicators.length})</h2>
                <span aria-hidden="true" style="flex:1;height:1px;background:rgba(7,88,79,.16)"></span>
              </div>
              <ol style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:${dense ? "7px" : "9px"}">${indicatorMarkup}</ol>
            </section>
          `
              : ""
          }

          ${notesMarkup}
        </div>
      </div>
    </section>
  `;
}
