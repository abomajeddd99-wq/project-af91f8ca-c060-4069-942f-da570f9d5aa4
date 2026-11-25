import { toPng } from "html-to-image";
import { validatePortfolioRaster } from "./portfolio-raster-quality";
import { applyPortfolioPalette, getPortfolioTheme, type PortfolioTemplateId } from "./portfolio-theme";

interface PortfolioPageFrame {
  pageNumber: number;
  totalPages: number;
}

export function portfolioPageMarkup(
  content: string,
  heading?: string,
  frame?: PortfolioPageFrame,
  template: PortfolioTemplateId = "ministerial",
): string {
  return applyPortfolioPalette(pageMarkup(content, heading, frame), template);
}

function pageMarkup(content: string, heading?: string, frame?: PortfolioPageFrame): string {
  if (content.includes('data-standard-cover="true"') || content.includes('data-royal-page="true"')) {
    const educationalCover = content.includes('data-cover-content="true"');
    return `<div style="height:100%;position:relative;background:#F8F5EC">${content}
      ${frame && !educationalCover ? `<span dir="ltr" style="position:absolute;bottom:42px;left:64px;font-family:monospace;background:#07584F;padding:3px 10px;border-radius:999px;border:1px solid #C5A46D;color:#F8F5EC;font-size:11px;letter-spacing:.04em">${frame.pageNumber} / ${frame.totalPages}</span>` : ""}
    </div>`;
  }
  const headingMarkup = heading
    ? `<div style="margin:14px 0 18px;display:flex;align-items:center;gap:12px">
        <span style="display:block;width:4px;height:30px;border-radius:3px;background:#C5A15B;flex-shrink:0"></span>
        <h1 style="margin:0;color:#07594F;font-size:24px;line-height:1.4;font-weight:800;overflow-wrap:anywhere">${escapeHtml(heading)}</h1>
      </div>`
    : "";
  const pageNumber = frame
    ? `<span dir="ltr" style="font-family:monospace;background:#F0ECE2;border:1px solid #D8C9AA;border-radius:999px;padding:1px 9px;color:#07594F;font-size:10px;font-weight:700;letter-spacing:.04em">${frame.pageNumber} / ${frame.totalPages}</span>`
    : "";
  return `
    <div style="height:100%;box-sizing:border-box;display:flex;flex-direction:column;background:#F8F5EC;padding:48px 52px;position:relative">
      <span aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:6px;background:#07584F"></span>
      <span aria-hidden="true" style="position:absolute;top:6px;left:0;right:0;height:2px;background:#C5A46D"></span>
      <span aria-hidden="true" style="position:absolute;inset:22px;border:1px solid #C5A46D;border-radius:10px;opacity:.45;pointer-events:none"></span>
      <span aria-hidden="true" style="position:absolute;top:16px;right:16px;width:22px;height:22px;border-top:2px solid #C5A15B;border-right:2px solid #C5A15B;border-top-right-radius:6px"></span>
      <span aria-hidden="true" style="position:absolute;bottom:16px;left:16px;width:22px;height:22px;border-bottom:2px solid #C5A15B;border-left:2px solid #C5A15B;border-bottom-left-radius:6px"></span>
      <header style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #D8C9AA;padding:0 0 9px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:8px;font-family:'Readex Pro','IBM Plex Sans Arabic',sans-serif;font-size:15px;font-weight:700;color:#07594F">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#07584F;border-radius:7px;font-size:12px;color:#F8F5EC">إ</span>
          منصة إنجازي
        </div>
        <div style="font-size:11px;font-weight:600;color:#586A66;padding:2px 10px;border-radius:999px;background:#F0ECE2">ملف شواهد الأداء الوظيفي</div>
      </header>
      ${headingMarkup}
      <main style="flex:1;min-height:0;overflow:visible;box-sizing:border-box;color:#202B2A">${content}</main>
      <footer style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #D8C9AA;margin-top:11px;padding-top:8px;color:#697773;font-size:9.5px;line-height:1.4;flex-shrink:0">
        <span>منصة إنجازي · ملف مهني موثق للعرض والمراجعة</span>${pageNumber}
      </footer>
    </div>
  `;
}

/** Keep each standard on one page without silently cutting off any supplied text. */
export function fitStandardCover(element: HTMLElement): void {
  const viewport = element.querySelector<HTMLElement>("[data-standard-viewport]");
  const body = element.querySelector<HTMLElement>("[data-standard-body]");
  if (viewport && body) {
    const bounds = { width: viewport.clientWidth, height: viewport.clientHeight };
    if (!bounds.width || !bounds.height) return;
    body.style.transformOrigin = "top right";
    body.style.position = "absolute";
    body.style.top = "0";
    body.style.right = "0";
    body.style.flexShrink = "0";
    for (let percentage = 100; percentage >= 74; percentage -= 2) {
      const scale = percentage / 100;
      body.style.width = `${bounds.width / scale}px`;
      body.style.transform = `scale(${scale})`;
      if (body.offsetHeight * scale <= bounds.height + 0.5) {
        body.dataset["standardScale"] = String(scale);
        return;
      }
    }
    const number = element.querySelector<HTMLElement>("[data-standard-number]")?.dataset["standardNumber"] ?? "";
    throw new Error(`محتوى المعيار ${number} يتجاوز المساحة المقروءة لصفحة واحدة. يُرجى تقليل الملاحظات المطولة قبل التصدير.`);
  }

  const cover = element.querySelector<HTMLElement>("[data-cover-content]");
  if (!cover) return;
  const availableHeight = 860 - cover.offsetTop;
  if (availableHeight <= 0 || !cover.offsetHeight) return;
  cover.style.transformOrigin = "top center";
  for (let percentage = 100; percentage >= 78; percentage -= 2) {
    const scale = percentage / 100;
    cover.style.transform = `scale(${scale})`;
    if (cover.offsetHeight * scale <= availableHeight + 0.5) {
      cover.dataset["coverScale"] = String(scale);
      return;
    }
  }
  throw new Error("يتجاوز المساحة المقروءة لصفحة واحدة: بيانات الغلاف أطول من المساحة المتاحة للطباعة.");
}

/** Fail explicitly rather than exporting text outside the printable content surface. */
function assertGeneratedTextFits(element: HTMLElement): void {
  if (!element.getBoundingClientRect().width) return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (!text.textContent?.trim() || text.parentElement?.closest("svg,[aria-hidden='true']")) continue;
    const range = document.createRange();
    range.selectNodeContents(text);
    for (const bounds of Array.from(range.getClientRects())) {
      if (bounds.left < -1 || bounds.right > 795 || bounds.top < -1 || bounds.bottom > 1091) {
        throw new Error(`يتجاوز نص الصفحة ${element.dataset["portfolioPageNumber"] ?? ""} مساحة الطباعة الآمنة. لم يُقتطع أي نص؛ يُرجى مراجعة طول المحتوى.`);
      }
    }
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function renderPortfolioPage(
  content: string,
  heading?: string,
  frame?: PortfolioPageFrame,
  template: PortfolioTemplateId = "ministerial",
): Promise<Uint8Array> {
  if (typeof document === "undefined") throw new Error("PDF export is only available in a browser.");
  await document.fonts?.ready;
  const theme = getPortfolioTheme(template);
  const element = document.createElement("div");
  element.lang = "ar";
  element.dir = "rtl";
  if (frame) {
    element.dataset["portfolioPageNumber"] = String(frame.pageNumber);
    element.dataset["portfolioTotalPages"] = String(frame.totalPages);
  }
  element.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "z-index:2147483647",
    "opacity:0",
    "pointer-events:none",
    "box-sizing:border-box",
    "width:794px",
    "height:1123px",
    "overflow:hidden",
    `background:${theme.bg}`,
    `color:${theme.ink}`,
    "font-family:'IBM Plex Sans Arabic',system-ui,sans-serif",
    "font-size:18px",
    "line-height:1.75",
    "direction:rtl",
  ].join(";");
  element.innerHTML = portfolioPageMarkup(content, heading, frame, template);
  document.body.appendChild(element);
  try {
    await document.fonts?.ready;
    await Promise.all(Array.from(element.querySelectorAll("img"), (image) =>
      typeof image.decode === "function" ? image.decode() : Promise.resolve(),
    ));
    fitStandardCover(element);
    assertGeneratedTextFits(element);
    let dataUrl = "";
    for (const pixelRatio of [3, 2]) {
      try {
        dataUrl = await toPng(element, {
          pixelRatio,
          width: 794,
          height: 1123,
          canvasWidth: 794,
          canvasHeight: 1123,
          backgroundColor: theme.bg,
          cacheBust: true,
          skipFonts: true,
          style: {
            left: "0px",
            top: "0px",
            position: "fixed",
            zIndex: "2147483647",
            opacity: "1",
            pointerEvents: "none",
          },
        });
        await validatePortfolioRaster(dataUrl);
        break;
      } catch (error) {
        if (pixelRatio === 2) throw error;
      }
    }
    const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const binary = atob(encoded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } finally {
    element.remove();
  }
}
