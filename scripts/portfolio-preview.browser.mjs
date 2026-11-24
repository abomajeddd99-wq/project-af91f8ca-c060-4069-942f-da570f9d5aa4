// Synthetic-only UI regression. Requires the existing application workflow on port 5000.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, degrees } from "pdf-lib";

const profile = await mkdtemp(join(tmpdir(), "injazi-layout-ui-"));
const browser = spawn(process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let socket;
let rootError;
try {
  let port;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); } catch {}
    if (port) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(port, "Chromium did not start.");
  const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send("Target.createTarget", { url: "http://127.0.0.1:5000/" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const source = await PDFDocument.create();
  source.addPage([720, 420]).drawText("SYNTHETIC ORIGINAL ONE");
  source.addPage([400, 600]).setRotation(degrees(90));
  source.getPage(1).drawText("SYNTHETIC ORIGINAL TWO");
  const original = Buffer.from(await source.save()).toString("base64");
  const expression = `(async () => {
    const moduleSource = await (await fetch("/src/components/portfolio/PortfolioA4Preview.tsx")).text();
    const reactUrl = moduleSource.match(/"([^"]*\\/react\\.js\\?v=[^"]+)"/)?.[1];
    if (!reactUrl) throw new Error("Could not resolve the running app's optimized React module.");
    const { default: React } = await import(reactUrl);
    const { default: { createRoot } } = await import(reactUrl.replace("/react.js", "/react-dom_client.js"));
    const { PortfolioA4Preview } = await import("/src/components/portfolio/PortfolioA4Preview.tsx");
    const { EvidenceLayoutControls } = await import("/src/components/portfolio/EvidenceLayoutControls.tsx");
    const { planPortfolioPages } = await import("/src/lib/portfolio-export.ts");
    const h = React.createElement;
    const check = (test, message) => { if (!test) throw new Error(message); };
    const wait = async (predicate) => {
      const deadline = Date.now() + 15000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error("Preview did not settle: " + host.innerText.slice(-1000));
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    };
    const images = [];
    for (let index = 0; index < 4; index++) {
      const canvas = document.createElement("canvas");
      canvas.width = index % 2 ? 800 : 1200;
      canvas.height = index % 2 ? 1200 : 800;
      const context = canvas.getContext("2d");
      context.fillStyle = "#07584F"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#C5A46D"; context.font = "bold 50px sans-serif";
      context.fillText("LOCAL EVIDENCE " + (index + 1), 45, 100);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      images.push({ evidence: { id: "ui-evidence-" + index, standard_id: "s1", title: "شاهد تعليمي " + (index + 1),
        description: "وصف موجز للمراجعة.", file_name: "PRIVATE-ID.png", mime_type: "image/png", file_size: blob.size,
        evidence_date: null, created_at: "2026-11-16T00:00:00Z" }, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
    const standards = ["s1", "s2"].map((id, index) => ({ id, code: String(index + 1), title: "معيار اصطناعي " + (index + 1),
      description: "اختبار محلي فقط.", indicators: ["مؤشر اصطناعي"], weight: 50, is_placeholder: false }));
    const pdfBytes = Uint8Array.from(atob(${JSON.stringify(original)}), character => character.charCodeAt(0));
    const attachments = [...images, { ...images[0], evidence: { ...images[0].evidence, id: "other", standard_id: "s2" } },
      { evidence: { ...images[0].evidence, id: "pdf", standard_id: "s2", title: "مرفق أصلي", mime_type: "application/pdf" }, bytes: pdfBytes }];
    const base = { profile: { full_name: "معلم افتراضي" }, standards, progress: [], attachments, generatedAt: new Date("2026-11-16T00:00:00Z") };
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0;z-index:99999;background:#E7EFEB;padding:24px;overflow:auto;min-height:1100px";
    document.body.append(host);
    let currentPreferences;
    function Harness() {
      const [preferences, setPreferences] = React.useState({ defaultItemsPerPage: 2, byStandard: {} });
      currentPreferences = preferences;
      const input = React.useMemo(() => ({ ...base, evidenceLayout: preferences }), [preferences]);
      return h("div", { dir: "rtl", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" } },
        h(EvidenceLayoutControls, { preferences, onChange: setPreferences, standards }),
        h(PortfolioA4Preview, { input }));
    }
    const root = createRoot(host); root.render(h(Harness));
    const labels = ["عنصر واحد", "عنصران", "ثلاثة عناصر", "أربعة عناصر"];
    const reports = [];
    for (const target of [1,2,3,4]) {
      await wait(() => host.querySelector('button[aria-pressed]'));
      const button = Array.from(host.querySelectorAll("button")).find(button => button.textContent.includes(labels[target - 1]));
      button.click();
      await wait(() => button.getAttribute("aria-pressed") === "true" && currentPreferences.defaultItemsPerPage === target);
      const plan = await planPortfolioPages({ ...base, evidenceLayout: currentPreferences });
      await wait(() => host.querySelector('[aria-busy="false"]') && host.querySelector('[aria-label="صفحة المعاينة"]')?.options.length === plan.pages.length);
      const imageIndex = plan.pages.findIndex(page => page.kind === "generated" && page.images.length);
      const select = host.querySelector('[aria-label="صفحة المعاينة"]');
      select.value = String(imageIndex);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const expected = plan.pages[imageIndex];
      await wait(() => host.querySelectorAll("[data-a4-preview-page] [data-evidence-image-slot]").length === expected.images.length);
      const surface = host.querySelector("[data-a4-preview-page]");
      const bounds = surface.getBoundingClientRect();
      const scale = bounds.width / 794;
      const slots = Array.from(surface.querySelectorAll("[data-evidence-image-slot]"));
      for (const [index, slot] of slots.entries()) {
        const actual = slot.getBoundingClientRect();
        const layout = expected.images[index].layout;
        check(Math.abs(actual.width / scale - layout.width * 794 / 595.28) < 1, "Preview image width differs from export");
        check(Math.abs((actual.top - bounds.top) / scale - layout.imageTop * 794 / 595.28) < 1, "Preview page placement differs from export");
        const caption = slot.parentElement.querySelector("[data-evidence-caption]").getBoundingClientRect();
        check(caption.top >= actual.bottom + 8 * scale && caption.bottom <= bounds.bottom - 50 * scale, "Preview captions clipped or overlapping");
      }
      check(expected.images.length === target, "Suitable images did not reach selected maximum " + target);
      check(!surface.innerText.includes("PRIVATE-ID"), "Filename leaked into preview");
      reports.push({ target, pages: plan.pages.length, items: slots.length });
    }
    // Independent override and inheritance update the real component without touching any backend.
    const override = host.querySelectorAll("select")[0];
    override.value = "1"; override.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(() => currentPreferences.byStandard.s1 === 1);
    override.value = "inherit"; override.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(() => !Object.hasOwn(currentPreferences.byStandard, "s1"));
    // Verify original landscape/rotated page preview, then leave the 2x2 page visible for review.
    const plan = await planPortfolioPages({ ...base, evidenceLayout: currentPreferences });
    const originalIndex = plan.pages.findIndex(page => page.kind === "original");
    await wait(() => host.querySelector('[aria-busy="false"]'));
    const select = host.querySelector('[aria-label="صفحة المعاينة"]');
    select.value = String(originalIndex); select.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(() => host.querySelector('img[alt="مرفق أصلي — صفحة 1"]')?.complete);
    const sourceImage = host.querySelector('img[alt="مرفق أصلي — صفحة 1"]');
    await sourceImage.decode();
    check(Math.abs(sourceImage.naturalWidth / sourceImage.naturalHeight - 720 / 420) < .01, "Original landscape dimensions changed in preview");
    select.value = String(originalIndex + 1); select.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(() => host.querySelector('img[alt="مرفق أصلي — صفحة 2"]')?.complete);
    const rotated = host.querySelector('img[alt="مرفق أصلي — صفحة 2"]');
    await rotated.decode();
    check(Math.abs(rotated.naturalWidth / rotated.naturalHeight - 600 / 400) < .01,
      "Original rotation changed in preview: " + rotated.naturalWidth + "x" + rotated.naturalHeight);
    select.value = String(plan.pages.findIndex(page => page.kind === "generated" && page.images.length === 4));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(() => host.querySelectorAll("[data-a4-preview-page] img").length === 4);
    await Promise.all(Array.from(host.querySelectorAll("[data-a4-preview-page] img"), image => image.decode()));
    return reports;
  })()`;
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "Preview browser test failed.");
  console.log("Verified live controls, all four preview layouts, overrides, inheritance, image geometry, and original PDF orientation:", result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 }, sessionId);
  await writeFile("generated-artifacts/injazi-layout-preview.jpg", Buffer.from(shot.data, "base64"));
  await send("Browser.close");
} catch (error) {
  rootError = error;
} finally {
  socket?.close();
  if (browser.exitCode === null) browser.kill("SIGTERM");
  await new Promise((resolve) => browser.exitCode !== null ? resolve() : browser.once("close", resolve));
  await rm(profile, { recursive: true, force: true });
}
if (rootError) throw rootError;
