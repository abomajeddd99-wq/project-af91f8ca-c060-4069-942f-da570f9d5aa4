/** Only generated pages are inspected. Original evidence pages must remain untouched. */
export function assertPortfolioRasterVisible(pixels: Uint8ClampedArray): void {
  const count = pixels.length / 4;
  if (!count) throw new Error("تعذر قراءة صورة صفحة ملف الإنجاز.");
  let black = 0;
  let ink = 0;
  let transparent = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index]!;
    const g = pixels[index + 1]!;
    const b = pixels[index + 2]!;
    if (pixels[index + 3]! < 250) transparent++;
    if (r < 18 && g < 18 && b < 18) black++;
    if (r < 175 && g < 190 && b < 190) ink++;
  }
  if (black / count > 0.98) throw new Error("ظهرت صفحة مولدة سوداء أثناء التصدير. لم يُحذف أي شاهد؛ يرجى إعادة المحاولة.");
  if (transparent / count > 0.02 || ink < Math.max(12, count * 0.0001)) {
    throw new Error("ظهرت صفحة مولدة فارغة أثناء التصدير. لم يُحذف أي شاهد؛ يرجى إعادة المحاولة.");
  }
}

export async function validatePortfolioRaster(dataUrl: string): Promise<void> {
  // jsdom has no canvas renderer; browser regression tests exercise this path.
  if (typeof CanvasRenderingContext2D === "undefined") return;
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  if (image.naturalWidth < 794 || image.naturalHeight < 1123) {
    throw new Error("تعذر التقاط صفحة ملف الإنجاز بالمقاس الصحيح. لم يُحذف أي محتوى؛ يرجى إعادة المحاولة.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = Math.round(400 * image.naturalHeight / image.naturalWidth);
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || !image.naturalWidth) throw new Error("تعذر التحقق من صفحة ملف الإنجاز.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    assertPortfolioRasterVisible(context.getImageData(0, 0, canvas.width, canvas.height).data);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    image.src = "";
  }
}
