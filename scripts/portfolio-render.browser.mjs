import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { createServer as createViteServer } from "vite";

async function getUnusedPort() {
  const socket = createNetServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a browser debug port.");
  await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForDevTools(port, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Chromium exited early with ${child.exitCode}.`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      // Chromium is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for Chromium's local debugging endpoint.");
}

function connectDevTools(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    socket,
    ready,
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
  };
}

const projectRoot = process.cwd();
const testRoot = await mkdtemp(join(tmpdir(), "portfolio-pdf-vite-"));
const profile = await mkdtemp(join(tmpdir(), "portfolio-pdf-chromium-"));
const vitePort = await getUnusedPort();
const moduleUrl = `/@fs${join(projectRoot, "src/lib/portfolio-page-renderer.ts")}`;
const pdfRenderUrl = moduleUrl.replace("portfolio-page-renderer.ts", "pdf-render.ts");
const exportBundlePath = join(testRoot, "portfolio-export.bundle.js");
const previewBundlePath = join(testRoot, "portfolio-preview.bundle.js");
await build({
  entryPoints: [join(projectRoot, "src/lib/portfolio-export.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: exportBundlePath,
});
await build({
  stdin: {
    contents: 'export { toPng } from "html-to-image";',
    resolveDir: projectRoot,
    sourcefile: "portfolio-preview.ts",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: previewBundlePath,
});
const indexHtml = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body>Local PDF rendering test</body></html>`;
await writeFile(join(testRoot, "index.html"), indexHtml);

const server = await createViteServer({
  configFile: false,
  root: testRoot,
  publicDir: join(projectRoot, "public"),
  appType: "mpa",
  logLevel: "silent",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: {
    host: "127.0.0.1",
    port: vitePort,
    strictPort: true,
    fs: { allow: [projectRoot, testRoot] },
  },
});
let browserProcess;
let browserClosed;
let devTools;

try {
  await server.listen();
  const viteAddress = server.httpServer?.address();
  if (!viteAddress || typeof viteAddress === "string") throw new Error("The local test server did not open a port.");

  const browser = process.env["CHROMIUM_PATH"] || "/repl/tools/bin/chromium";
  const debugPort = await getUnusedPort();
  browserProcess = spawn(
    browser,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--no-first-run",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { env: process.env, stdio: ["ignore", "ignore", "pipe"] },
  );
  browserClosed = new Promise((resolve) => browserProcess.once("close", resolve));
  let browserErrors = "";
  browserProcess.stderr.setEncoding("utf8");
  browserProcess.stderr.on("data", (chunk) => {
    browserErrors += chunk;
  });

  devTools = connectDevTools(await waitForDevTools(debugPort, browserProcess));
  await devTools.ready;
  const { targetId } = await devTools.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await devTools.send("Target.attachToTarget", { targetId, flatten: true });
  await devTools.send("Page.enable", {}, sessionId);
  await devTools.send("Runtime.enable", {}, sessionId);
  await devTools.send("Emulation.setDeviceMetricsOverride", {
    width: 794,
    height: 1123,
    deviceScaleFactor: 1,
    mobile: false,
  }, sessionId);

  const pageUrl = `http://127.0.0.1:${viteAddress.port}/index.html`;
  await devTools.send("Page.navigate", { url: pageUrl }, sessionId);

  const expression = `(async () => {
    const { renderPortfolioPage } = await import(${JSON.stringify(moduleUrl)});
    const { validatePortfolioRaster } = await import(${JSON.stringify(moduleUrl.replace("portfolio-page-renderer.ts", "portfolio-raster-quality.ts"))});
    let rejectedCaptures = 0;
    for (const [width, height, fill] of [
      [1, 1, "#000000"], [794, 1123, "#000000"], [794, 1123, "#FFFFFF"],
      [794, 1123, "#F8F5EC"], [794, 1123, null]
    ]) {
      const invalid = document.createElement("canvas");
      invalid.width = width; invalid.height = height;
      if (fill) {
        const context = invalid.getContext("2d"); context.fillStyle = fill;
        context.fillRect(0, 0, width, height);
      }
      try { await validatePortfolioRaster(invalid.toDataURL("image/png")); }
      catch { rejectedCaptures++; }
      invalid.width = 0; invalid.height = 0;
    }
    const png = await renderPortfolioPage(
      '<section style="margin-top:60px"><h2 style="font-size:42px;color:#0c4b49">Synthetic Teacher Portfolio</h2><p style="font-size:28px">ملخص الإنجاز وتغطية الشواهد</p><p style="font-size:24px">المعيار الأول · مكتمل يدويًا</p></section>',
      "Synthetic portfolio cover"
    );
    const image = new Image();
    image.src = URL.createObjectURL(new Blob([png], { type: "image/png" }));
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    let contentPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const pixel = index / 4;
      const y = Math.floor(pixel / canvas.width);
      // Exclude ivory background: a coloured but otherwise blank page must fail.
      const hasInk = pixels[index] < 150 && pixels[index + 1] < 180 && pixels[index + 2] < 180;
      if (hasInk) {
        visiblePixels++;
        if (y > canvas.height * 0.2 && y < canvas.height * 0.85) contentPixels++;
      }
    }
    return { width: image.naturalWidth, height: image.naturalHeight, visiblePixels, contentPixels, rejectedCaptures };
  })()`;

  const evaluation = await devTools.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || "The browser render evaluation failed.");
  }
  const result = evaluation.result?.value;
  assert.ok(result, `Chromium returned no render result. ${browserErrors.slice(-2000)}`);
  assert.ok(result.width > 2000, `Unexpected rendered page width: ${result.width}`);
  assert.ok(result.height > 3000, `Unexpected rendered page height: ${result.height}`);
  assert.ok(result.visiblePixels > 5000, `Rendered portfolio page is blank (${result.visiblePixels} visible pixels).`);
  assert.ok(result.contentPixels > 1000, "Generated portfolio content area is blank.");
  assert.equal(result.rejectedCaptures, 5, "Collapsed, black, white, ivory and transparent captures must all be rejected in a real browser.");
  console.log(
    `Portfolio page rasterized with visible content (${result.visiblePixels} non-white pixels; ${result.contentPixels} in its content area).`,
  );

  const coverExpression = `(async () => {
    const { planPortfolioPages, createPortfolioPdf } = await import("/portfolio-export.bundle.js");
    const { portfolioPageMarkup, fitStandardCover } = await import(${JSON.stringify(moduleUrl)});
    const { openPdf, renderPdfPage } = await import(${JSON.stringify(pdfRenderUrl)});
    const input = {
      profile: {
        full_name: "معلم تجريبي",
        school: "مدرسة تجريبية",
        education_office: "إدارة تعليمية",
        job_title: "معلم",
        academic_year: "1448 هـ",
      },
      standards: [],
      progress: [],
      attachments: [],
      cover: { layout: "royal", accent: "gold", title: "ملف الإنجاز الوظيفي" },
      generatedAt: new Date("2026-11-17T00:00:00.000Z"),
    };
    const plan = await planPortfolioPages(input);
    const firstPage = plan.pages[0];
    if (!firstPage || firstPage.kind !== "generated") throw new Error("The teacher cover was not generated as the first page.");
    const preview = document.createElement("div");
    preview.lang = "ar";
    preview.dir = "rtl";
    preview.style.cssText = "position:relative;width:794px;height:1123px;overflow:hidden;box-sizing:border-box;background:#F8F5EC;color:#252A28;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;font-size:18px;line-height:1.75";
    preview.innerHTML = portfolioPageMarkup(firstPage.content, firstPage.heading, firstPage.frame);
    document.body.style.margin = "0";
    document.body.replaceChildren(preview);
    await document.fonts.ready;
    await Promise.all(Array.from(preview.querySelectorAll("img"), (image) => image.decode()));
    fitStandardCover(preview);
    const { toPng } = await import("/portfolio-preview.bundle.js");
    const previewPng = await toPng(preview, {
      pixelRatio: 3,
      width: 794,
      height: 1123,
      canvasWidth: 794,
      canvasHeight: 1123,
      backgroundColor: "#F8F5EC",
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
    const textRects = [];
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      if (!text.textContent.trim() || text.parentElement.closest("svg,[aria-hidden='true']")) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        textRects.push({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          coverContent: Boolean(text.parentElement.closest("[data-cover-content]")),
        });
      }
    }
    const pdf = await createPortfolioPdf(input);
    const documentPdf = await openPdf(pdf.bytes.slice().buffer);
    const pdfPage = await documentPdf.getPage(1);
    const size = pdfPage.getViewport({ scale: 1 });
    const rendered = await renderPdfPage(documentPdf, 1, 794);
    await documentPdf.destroy();
    let binary = "";
    for (const byte of pdf.bytes) binary += String.fromCharCode(byte);
    return {
      pdfBase64: btoa(binary),
      pageCount: pdf.pageCount,
      pdfPageCount: documentPdf.numPages,
      previewPngBase64: previewPng.split(",")[1],
      pdfWidth: size.width,
      pdfHeight: size.height,
      imageWidth: rendered.width,
      imageHeight: rendered.height,
      pdfImage: rendered.dataUrl,
      rowCount: preview.querySelectorAll("[data-teacher-field]").length,
      title: preview.querySelector("h1")?.textContent,
      coverLabel: preview.querySelector("[data-cover-content] > div:nth-of-type(2)")?.textContent,
      ministryLogoLoaded: preview.querySelector("[data-ministry-logo]")?.naturalWidth > 0,
      values: ["معلم تجريبي", "مدرسة تجريبية", "إدارة تعليمية", "معلم", "1448 هـ"]
        .map((value) => preview.textContent.includes(value)),
      textWithinPage: textRects.every((rect) =>
        rect.left >= -1 && rect.right <= 795 && rect.top >= -1 && rect.bottom <= 1124),
      maxCoverContentBottom: Math.max(...textRects.filter((rect) => rect.coverContent).map((rect) => rect.bottom)),
    };
  })()`;
  const coverEvaluation = await devTools.send(
    "Runtime.evaluate",
    { expression: coverExpression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (coverEvaluation.exceptionDetails) {
    throw new Error(coverEvaluation.exceptionDetails.exception?.description || "The teacher cover render failed.");
  }
  const coverResult = coverEvaluation.result?.value;
  assert.ok(coverResult, "Chromium returned no cover result.");
  assert.equal(coverResult.rowCount, 5, "The preview should contain exactly five dynamic teacher rows.");
  assert.equal(coverResult.title, "شواهد الأداء الوظيفي");
  assert.equal(coverResult.coverLabel, "ملف");
  assert.ok(coverResult.ministryLogoLoaded, "The official Ministry logo should load from the local SVG asset.");
  assert.deepEqual(coverResult.values, [true, true, true, true, true], "The cover should contain the real profile values.");
  assert.ok(coverResult.textWithinPage, "Cover text extends beyond the A4 page.");
  assert.ok(coverResult.maxCoverContentBottom < 874, `Cover content overlaps the bottom decoration (${coverResult.maxCoverContentBottom}px).`);
  assert.equal(coverResult.pdfPageCount, coverResult.pageCount, "The final PDF page count does not match the export result.");
  assert.ok(coverResult.pageCount > 0, "The PDF export contains no pages.");
  assert.ok(Math.abs(coverResult.pdfWidth / coverResult.pdfHeight - 794 / 1123) < 0.002, "Exported PDF page is not portrait A4.");
  assert.equal(coverResult.imageWidth, 794);
  assert.equal(coverResult.imageHeight, 1123);
  const pdfCoverPath = join(tmpdir(), `portfolio-cover-pdf-${process.pid}.jpg`);
  const coverPreviewPath = join(tmpdir(), `portfolio-cover-preview-${process.pid}.png`);
  const exportedPdfPath = join(tmpdir(), `portfolio-cover-export-${process.pid}.pdf`);
  await writeFile(exportedPdfPath, Buffer.from(coverResult.pdfBase64, "base64"));
  await writeFile(coverPreviewPath, Buffer.from(coverResult.previewPngBase64, "base64"));
  await writeFile(pdfCoverPath, Buffer.from(coverResult.pdfImage.split(",")[1], "base64"));
  console.log(`A4 cover preview and exported PDF (${coverResult.pageCount} pages) rendered with five teacher fields; files: ${coverPreviewPath}, ${exportedPdfPath}, ${pdfCoverPath}.`);
} finally {
  try {
    await devTools?.send("Browser.close");
  } catch {
    // Chromium may already have exited after a failed render.
  }
  devTools?.socket.close();
  if (browserProcess && browserProcess.exitCode === null) browserProcess.kill("SIGKILL");
  if (browserClosed) {
    await Promise.race([browserClosed, new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
  await server.close();
  await rm(profile, { recursive: true, force: true });
  await rm(testRoot, { recursive: true, force: true });
}
