import { describe, expect, it } from "vitest";
import { buildEducationalCover, buildEducationalCv } from "./portfolio-educational-design";
import { buildEducationalObjectives, SAUDI_EDUCATIONAL_AIM, SAUDI_EDUCATIONAL_OBJECTIVES } from "./portfolio-educational-objectives";
import { planPortfolioPages } from "./portfolio-export";
import { portfolioPageMarkup } from "./portfolio-page-renderer";

describe("reference-based educational portfolio", () => {
  it.each(["royal", "classic"] as const)("uses a safe, editable %s educational cover, not a flattened reference", (layout) => {
    const cover = buildEducationalCover({
      name: "<اسم تجريبي>", school: "مدرسة & تجربة", year: "1448 هـ",
      educationOffice: "إدارة تجريبية", subject: "العربية", jobTitle: "معلم",
      subtitle: "نص <مخصص>", date: "2026", layout, accent: "emerald",
    });
    const root = document.createElement("div");
    root.innerHTML = cover;
    expect(root.querySelector('[data-royal-page="true"]')?.getAttribute("style")).toContain("height:1123px");
    expect(root.querySelector("h1")?.textContent).toBe("شواهد الأداء الوظيفي");
    expect(cover).toContain(`data-royal-layout="${layout}"`);
    expect(cover).toContain('data-royal-accent="emerald"');
    expect(root.querySelectorAll("img")).toHaveLength(1);
    expect(root.querySelectorAll("script")).toHaveLength(0);
    expect(root.querySelector("[data-ministry-logo]")?.getAttribute("src")).toBe("/ministry-of-education-logo-white.svg");
    expect(cover).toContain("&lt;اسم تجريبي&gt;");
    expect(cover).toContain("مدرسة &amp; تجربة");
    expect(cover).toContain("إدارة تجريبية");
    expect(cover).not.toContain("Abdulrahman");
    expect(cover).toContain("منصة إنجازي مستقلة ولا تمثل وزارة التعليم");
  });

  it("builds the reference-inspired five-row RTL cover from supplied teacher data", () => {
    const root = document.createElement("div");
    root.innerHTML = buildEducationalCover({
      name: "اسم المعلم",
      school: "مدرسة تجريبية",
      educationOffice: "إدارة تعليمية",
      jobTitle: "معلم",
      year: "1448 هـ",
      subtitle: "ملف مهني",
      date: "2026",
      layout: "royal",
      accent: "gold",
    });

    const cover = root.querySelector('[data-royal-page="true"]');
    const title = root.querySelector("h1");
    const rows = [...root.querySelectorAll("[data-teacher-field]")];
    expect(cover?.getAttribute("style")).toContain("width:794px");
    expect(cover?.getAttribute("style")).toContain("height:1123px");
    expect(cover?.getAttribute("style")).toContain("direction:rtl");
    expect(title?.style.whiteSpace).toBe("nowrap");
    expect(rows.map((row) => row.getAttribute("data-teacher-field"))).toEqual([
      "person", "school", "office", "work", "calendar",
    ]);
    expect(root.textContent).toContain("اسم المعلم");
    expect(root.textContent).toContain("مدرسة تجريبية");
    expect(root.textContent).toContain("إدارة تعليمية");
    expect(root.textContent).toContain("معلم");
    expect(root.textContent).toContain("1448 هـ");
    expect(root.querySelectorAll("main svg").length).toBeGreaterThanOrEqual(1);
    expect(root.querySelector("[data-ministry-logo]")?.getAttribute("alt")).toBe("وزارة التعليم");
    expect(root.textContent).toContain("منصة إنجازي مستقلة ولا تمثل وزارة التعليم");
  });

  it("uses the cover artwork in the shared preview/export markup without a colliding page badge", () => {
    const cover = buildEducationalCover({
      name: "اسم المعلم",
      subtitle: "",
      date: "2026",
      layout: "royal",
      accent: "gold",
    });
    const markup = portfolioPageMarkup(cover, undefined, { pageNumber: 1, totalPages: 12 });
    expect(markup).toContain('data-royal-page="true"');
    expect(markup).not.toContain(">1 / 12</span>");
  });

  it("omits unavailable teacher fields and preserves real zero years of experience", () => {
    const cv = buildEducationalCv({ profile: { full_name: "اسم اختباري", years_experience: 0 },
      bio: "نبذة <اختبار>", pageIndex: 0, pageCount: 1 });
    expect(cv).toContain("اسم اختباري");
    expect(cv).toContain("0 سنة");
    expect(cv).toContain("نبذة &lt;اختبار&gt;");
    expect(cv).not.toContain("الدورات التدريبية");
    expect(cv).not.toContain("الجامعة");
    expect(cv).not.toContain("رقم الجوال");
    expect(cv).not.toContain("undefined");
  });

  it("does not split or discard an already paginated biography continuation", () => {
    const bio = `${"نبذة عربية تجريبية ".repeat(46)}نهاية أصلية`;
    const html = buildEducationalCv({ profile: { full_name: "لا يكرر الاسم" }, bio, pageIndex: 3, pageCount: 4 });
    const root = document.createElement("div");
    root.innerHTML = html;
    expect(root.textContent).toContain(bio);
    expect(root.textContent).not.toContain("لا يكرر الاسم");
    expect(root.textContent).toContain("4 من 4");
  });

  it("includes each of the twelve supplied objectives once in RTL reading order", () => {
    const root = document.createElement("div");
    root.innerHTML = buildEducationalObjectives();
    const objectives = [...root.querySelectorAll("[data-educational-objective]")];
    expect(objectives).toHaveLength(12);
    expect(objectives.map((item) => item.getAttribute("data-educational-objective"))).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 1)),
    );
    objectives.forEach((item, index) => expect(item.textContent).toContain(SAUDI_EDUCATIONAL_OBJECTIVES[index]));
    expect(root.textContent).toContain(SAUDI_EDUCATIONAL_AIM);
    expect(root.querySelector("section")?.style.direction).toBe("rtl");
  });

  it("numbers the objectives, summary, index and all 11 unmodified standards consistently", async () => {
    const standards = Array.from({ length: 11 }, (_, index) => ({
      id: `s${index}`, code: String(index + 1), title: `معيار أصلي ${index + 1}`,
      description: "وصف أصلي", indicators: ["مؤشر أصلي"], weight: 9, is_placeholder: false,
    }));
    const before = structuredClone(standards);
    const plan = await planPortfolioPages({ profile: null, standards, progress: [], attachments: [] });
    expect(standards).toEqual(before);
    expect(plan.pages).toHaveLength(18);
    const generated = plan.pages.filter((page) => page.kind === "generated");
    expect(generated[1]?.heading).toBe("السيرة الذاتية");
    expect(generated[3]?.heading).toBe("أهداف التعليم في المملكة");
    expect(generated[4]?.heading).toBe("ملخص الإنجاز");
    expect(generated[5]?.heading).toBe("فهرس المعايير");
    const covers = generated.filter((page) => page.content.includes('data-standard-cover="true"'));
    expect(covers).toHaveLength(11);
    covers.forEach((page, index) => {
      expect(page.content).toContain(standards[index]!.title);
      expect(page.frame.pageNumber).toBe(7 + index);
    });
    generated.forEach((page, index) => expect(page.frame).toEqual({ pageNumber: index + 1, totalPages: 18 }));
  });
});
