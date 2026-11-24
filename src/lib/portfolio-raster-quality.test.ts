import { describe, expect, it } from "vitest";
import { assertPortfolioRasterVisible } from "./portfolio-raster-quality";
import { applyPortfolioPalette } from "./portfolio-theme";

function pixels(color: number[]) {
  return new Uint8ClampedArray(Array.from({ length: 10000 }, () => color).flat());
}

describe("generated portfolio raster quality", () => {
  it("applies the royal paint palette without rewriting source text", () => {
    expect(applyPortfolioPalette('<p style="color:#07594F;background:#F7F3EA">المعلم #07594F</p>'))
      .toBe('<p style="color:#07584F;background:#F8F5EC">المعلم #07594F</p>');
  });
  it.each([[0, 0, 0, 255], [10, 10, 10, 255]])("rejects solid black captures without removing pages: %j", (...color) => {
    expect(() => assertPortfolioRasterVisible(pixels(color))).toThrow("سوداء");
  });
  it.each([[255, 255, 255, 255], [248, 245, 236, 255], [0, 0, 0, 0]])("rejects empty white, ivory or transparent captures: %j", (...color) => {
    expect(() => assertPortfolioRasterVisible(pixels(color))).toThrow();
  });
  it("accepts readable emerald content on ivory and legitimate emerald backgrounds", () => {
    const content = pixels([248, 245, 236, 255]);
    for (let offset = 2000; offset < 2400; offset += 4) content.set([7, 88, 79, 255], offset);
    expect(() => assertPortfolioRasterVisible(content)).not.toThrow();
    expect(() => assertPortfolioRasterVisible(pixels([7, 88, 79, 255]))).not.toThrow();
  });
});
