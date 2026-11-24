export interface StandardCoverContent {
  number: number;
  code: string;
  title: string;
  description: string | null;
  indicators: string[];
  notes: string | null;
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
  const indicatorMarkup = input.indicators
    .map(
      (indicator) => `
        <li style="position:relative;margin:0;padding:11px 21px 11px 5px;border-bottom:1px solid rgba(7,88,79,.13);color:#344A45;font-size:16px;line-height:1.78;overflow-wrap:anywhere;word-break:break-word">
          <span aria-hidden="true" style="position:absolute;right:0;top:22px;width:7px;height:7px;transform:rotate(45deg);border:1px solid #C5A46D;box-sizing:border-box"></span>
          <span style="white-space:pre-wrap">${escapeHtml(indicator)}</span>
        </li>`,
    )
    .join("");
  const descriptionMarkup = input.description
    ? `<p style="margin:14px 0 0;color:#53635C;font-size:16px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.description)}</p>`
    : "";
  const notesMarkup = input.notes
    ? `<section aria-label="ملاحظات" style="margin-top:21px;padding:13px 16px 14px;border-right:2px solid #C5A46D;background:rgba(237,231,217,.68)">
        <div style="margin-bottom:5px;color:#8A7041;font-size:12px;letter-spacing:.04em">ملاحظات</div>
        <div style="color:#465650;font-size:14px;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.notes)}</div>
      </section>`
    : "";
  return `
    <section data-standard-cover="true" data-standard-number="${escapeHtml(number)}" style="position:absolute;inset:0;box-sizing:border-box;width:794px;height:1123px;overflow:hidden;background:#F8F5EC;color:#252A28;direction:rtl;text-align:right;font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif">
      <svg aria-hidden="true" width="794" height="1123" viewBox="0 0 794 1123" style="position:absolute;inset:0;width:794px;height:1123px;pointer-events:none">
        <defs>
          <pattern id="standard-geometry" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M21 1 41 21 21 41 1 21Z M21 11 31 21 21 31 11 21Z" fill="none" stroke="#07584F" stroke-width=".65" opacity=".16"/>
            <circle cx="21" cy="21" r="2" fill="#C5A46D" opacity=".31"/>
          </pattern>
          <linearGradient id="standard-wave-gold" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#C5A46D" stop-opacity=".42"/>
            <stop offset=".48" stop-color="#E0C98F" stop-opacity=".78"/>
            <stop offset="1" stop-color="#C5A46D" stop-opacity=".36"/>
          </linearGradient>
        </defs>
        <path d="M0 0H794V270H0Z" fill="url(#standard-geometry)" opacity=".43"/>
        <path d="M0 0H794V11H0Z" fill="#07584F"/>
        <path d="M24 24H770V1099H24Z" fill="none" stroke="#C5A46D" stroke-width="1"/>
        <path d="M32 32H762V1091H32Z" fill="none" stroke="#07584F" stroke-width=".55" opacity=".3"/>
        <path d="M0 1052 C139 1009 234 1087 378 1051 C525 1014 629 1028 794 986 V1123 H0Z" fill="#07584F"/>
        <path d="M0 1040 C139 997 234 1075 378 1039 C525 1002 629 1016 794 974" fill="none" stroke="url(#standard-wave-gold)" stroke-width="4"/>
        <path d="M0 1061 C148 1025 246 1098 389 1061 C540 1023 648 1042 794 1002" fill="none" stroke="#F8F5EC" stroke-width="1" opacity=".42"/>
        <path d="M0 1090 C158 1057 259 1120 405 1089 C548 1059 650 1070 794 1041" fill="none" stroke="#C5A46D" stroke-width="1" opacity=".6"/>
        <path d="M39 42h31M54 27v31M724 42h31M739 27v31M39 1081h31M54 1066v31M724 1081h31M739 1066v31" fill="none" stroke="#C5A46D" stroke-width="1"/>
      </svg>

      <div aria-hidden="true" style="position:absolute;top:50px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;color:#07584F">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-block;width:22px;height:22px;box-sizing:border-box;border:1px solid #C5A46D;transform:rotate(45deg)"></span>
          <span style="display:inline-block;width:7px;height:7px;margin-right:-19px;background:#07584F;border:1px solid #F8F5EC;border-radius:50%"></span>
          <span style="margin-right:9px;color:#8A7041;font-size:11px;letter-spacing:.16em">ENJAZI</span>
        </div>
        <span dir="ltr" style="font-family:Georgia,serif;font-size:12px;letter-spacing:.17em;color:#8A7041">${escapeHtml(input.code)}</span>
      </div>

      <div aria-hidden="true" dir="ltr" style="position:absolute;top:91px;left:54px;color:rgba(7,88,79,.075);font-family:Georgia,'Times New Roman',serif;font-size:210px;font-weight:400;line-height:1;letter-spacing:-.085em">${escapeHtml(number)}</div>
      <div aria-hidden="true" style="position:absolute;top:118px;left:64px;width:238px;height:1px;background:linear-gradient(to right,rgba(197,164,109,0),rgba(197,164,109,.72),rgba(197,164,109,0))"></div>
      <div aria-hidden="true" style="position:absolute;top:241px;left:64px;width:34px;height:1px;background:#C5A46D"></div>

      <div data-standard-viewport="true" style="position:absolute;top:273px;bottom:153px;left:64px;right:64px;box-sizing:border-box;display:flex;align-items:flex-start;justify-content:center">
        <div data-standard-body="true" data-standard-density="${input.indicators.length > 7 || (input.description?.length ?? 0) > 700 || (input.notes?.length ?? 0) > 350 ? "dense" : "standard"}" style="position:relative;box-sizing:border-box;width:100%;height:auto;min-height:548px;padding:0 0 2px;display:flex;flex-direction:column">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;color:#8A7041;font-size:12px;line-height:1.6">
              <span aria-hidden="true" style="width:5px;height:18px;background:#07584F"></span>
              <span>المعايير المهنية</span>
              <span aria-hidden="true" style="flex:1;height:1px;background:rgba(197,164,109,.72)"></span>
            </div>
            <h1 style="margin:0;color:#07584F;font-size:36px;font-weight:700;line-height:1.55;letter-spacing:-.025em;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap">${escapeHtml(input.title)}</h1>
            ${descriptionMarkup}

            ${
              input.indicators.length
                ? `
              <section aria-label="المؤشرات" style="margin-top:23px">
                <div style="display:flex;align-items:center;gap:10px;padding-bottom:8px;border-bottom:1px solid #C5A46D">
                  <span aria-hidden="true" style="width:5px;height:17px;background:#07584F"></span>
                  <h2 style="margin:0;color:#07584F;font-size:15px;font-weight:600;letter-spacing:.015em">المؤشرات</h2>
                  <span aria-hidden="true" style="flex:1;height:1px;background:rgba(7,88,79,.13)"></span>
                </div>
                <ol style="list-style:none;margin:0;padding:0">${indicatorMarkup}</ol>
              </section>
            `
                : ""
            }

            ${notesMarkup}
          </div>

      </div>
      </div>
    </section>
  `;
}
