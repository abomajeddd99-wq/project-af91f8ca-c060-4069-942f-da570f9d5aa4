import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { degrees, PDFDict, PDFDocument, PDFName, PDFRawStream, rgb, StandardFonts } from "pdf-lib";

async function getUnusedPort() {
  const socket = createNetServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local browser port.");
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
  throw new Error("Timed out waiting for Chromium's debugging endpoint.");
}

function connectDevTools(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
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

async function createSyntheticEvidencePdf() {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.HelveticaBold);
  const sizes = [];
  const rotations = [];
  for (let index = 1; index <= 5; index++) {
    const size = index === 2 || index === 4 ? [842, 595] : [595, 842];
    const page = source.addPage(size);
    const { width, height } = page.getSize();
    sizes.push(size);
    rotations.push(index === 3 ? 90 : 0);
    page.drawRectangle({
      x: 34,
      y: 34,
      width: width - 68,
      height: height - 68,
      borderWidth: 2,
      borderColor: rgb(0.08, 0.31, 0.29),
    });
    page.drawText(`SYNTHETIC EVIDENCE PAGE ${String(index).padStart(2, "0")}`, {
      x: 54,
      y: height - 90,
      size: 18,
      font,
      color: rgb(0.08, 0.31, 0.29),
    });
    page.drawText("Local test fixture — not a teacher record", {
      x: 54,
      y: height - 120,
      size: 11,
      font,
      color: rgb(0.45, 0.45, 0.4),
    });
    if (index === 3) page.setRotation(degrees(90));
  }
  return {
    bytes: new Uint8Array(await source.save()),
    sizes,
    rotations,
  };
}

const countArgument = process.argv.find((value) => value.startsWith("--image-count="));
if (countArgument && !/^--image-count=[1-4]$/.test(countArgument)) throw new Error("Use --image-count=1, 2, 3, or 4.");
const imageCount = countArgument ? Number(countArgument.split("=")[1]) : null;
const teacherLayouts = process.argv.includes("--teacher-layouts");
const educationalReview = process.argv.includes("--educational-review");
const finalRoyal = process.argv.includes("--final-royal") || teacherLayouts;
const standardCovers = process.argv.includes("--standard-covers") || finalRoyal;
const outputPath = join(process.cwd(), "generated-artifacts", imageCount
  ? `injazi-task11-${imageCount}-image-example.pdf`
  : educationalReview ? "injazi-educational-portfolio-review.pdf"
  : teacherLayouts ? "injazi-teacher-layouts-review.pdf"
  : finalRoyal ? "injazi-final-royal-portfolio-review.pdf"
  : standardCovers ? "injazi-royal-standard-covers-review.pdf"
  : "injazi-task11-complete-portfolio.pdf");
const profileDirectory = await mkdtemp(join(tmpdir(), "injazi-pdf-sample-chromium-"));
const evidencePdf = await createSyntheticEvidencePdf();
const evidencePdfBase64 = Buffer.from(evidencePdf.bytes).toString("base64");
const appUrl = "http://127.0.0.1:5000/";

const response = await fetch(appUrl).catch(() => null);
assert.ok(
  response?.ok,
  "Start the local application workflow first; this generator imports only local source and uses synthetic data.",
);

let browserProcess;
let browserClosed;
let devTools;

try {
  const debugPort = await getUnusedPort();
  const browser = process.env["CHROMIUM_PATH"] || "/repl/tools/bin/chromium";
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
      `--user-data-dir=${profileDirectory}`,
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
  const { targetId } = await devTools.send("Target.createTarget", { url: appUrl });
  const { sessionId } = await devTools.send("Target.attachToTarget", { targetId, flatten: true });
  await devTools.send("Page.enable", {}, sessionId);
  await devTools.send("Runtime.enable", {}, sessionId);

  const standards = Array.from({ length: imageCount ? 1 : 11 }, (_, index) => ({
    id: `synthetic-standard-${index + 1}`,
    code: String(index + 1).padStart(2, "0"),
    title: finalRoyal && index === 4
      ? "المعيار التجريبي الخامس: توثيق الممارسات التعليمية ومتابعة تطور الأداء المهني في البيئة المدرسية"
      : `المعيار التجريبي ${String(index + 1).padStart(2, "0")}`,
    description:
      "وصف تجريبي موسع للمراجعة البصرية. يوضح طريقة عرض المعيار وربط الشواهد به، ولا يمثل وصفًا رسميًا أو تجربة فعلية لمعلم.",
    indicators: [
      "مؤشر تجريبي أول يوضح شكل عرض المحتوى العربي داخل الصفحة.",
      "مؤشر تجريبي ثانٍ للتحقق من وضوح النص عند التفافه على سطرين.",
      "مؤشر تجريبي ثالث لمراجعة المسافات بين عناصر المعيار.",
      "مؤشر تجريبي رابع لفحص سهولة القراءة في نسخة الطباعة.",
    ],
    weight: Math.round(100 / 11),
    is_placeholder: false,
  }));
  const profile = {
    full_name: "معلم افتراضي للمراجعة",
    job_title: "معلم تجريبي",
    subject: "اللغة العربية",
    stage: "المرحلة المتوسطة",
    school: "مدرسة افتراضية",
    education_office: "إدارة تعليم تجريبية",
    academic_year: "1448 هـ",
    years_experience: 0,
    bio: "نبذة افتراضية للمراجعة البصرية. أُعدت هذه البيانات لاختبار وضوح الحقول العربية وتوازنها في ملف الطباعة، ولا تصف معلماً أو إنجازاً حقيقياً.",
  };
  const expression = `(async () => {
    const { createPortfolioPdf } = await import("/src/lib/portfolio-export.ts");
    const pdfBytes = Uint8Array.from(atob(${JSON.stringify(evidencePdfBase64)}), character => character.charCodeAt(0));
    const createSyntheticImage = async (width, height, label) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#F7F3EA";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#07594F";
      context.fillRect(30, 30, width - 60, height - 60);
      context.fillStyle = "#C5A15B";
      context.fillRect(60, 60, width - 120, 8);
      context.fillStyle = "#FFFFFF";
      context.font = "bold 42px sans-serif";
      context.fillText(label, 60, 150);
      context.font = "28px sans-serif";
      context.fillText("SYNTHETIC ONLY · NOT A TEACHER FILE", 60, 205);
      const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      return new Uint8Array(await imageBlob.arrayBuffer());
    };
    const landscapeImageBytes = await createSyntheticImage(1200, 800, "LANDSCAPE IMAGE EVIDENCE");
    const portraitImageBytes = await createSyntheticImage(800, 1200, "PORTRAIT IMAGE EVIDENCE");
    const standardCoverAttachments = [
      {
        evidence: {
          id: "synthetic-source-pdf", standard_id: "synthetic-standard-1",
          title: "مرفق اصطناعي من خمس صفحات", file_name: "synthetic-five-pages.pdf",
          description: "ملف اصطناعي لاختبار الحفاظ على جميع صفحات المرفق ومقاساتها واتجاهاتها الأصلية.",
          evidence_date: "2026-11-15", created_at: "2026-11-15T00:00:00.000Z",
          mime_type: "application/pdf", file_size: pdfBytes.length,
        },
        bytes: pdfBytes,
      },
      ...Array.from({length: 11}, (_, standardIndex) => Array.from(
        {length: ${finalRoyal} && standardIndex === 10 ? 0 : standardIndex < 4 ? (${teacherLayouts} ? (standardIndex + 1) * 2 + 1 : standardIndex + 1) : 1},
        (_, imageIndex) => {
          const bytes = imageIndex % 2 === 0 ? landscapeImageBytes : portraitImageBytes;
          return {
            evidence: {
              id: "cover-image-" + (standardIndex + 1) + "-" + (imageIndex + 1),
              standard_id: "synthetic-standard-" + (standardIndex + 1),
              title: ${finalRoyal} && standardIndex === 8 ? "عنوان شاهد اصطناعي طويل لمراجعة وضوح التفاف النص العربي أسفل الصورة والمحافظة على مساحة القراءة" : "شاهد اصطناعي " + (standardIndex + 1) + " · " + (imageIndex + 1),
              file_name: "synthetic-" + (standardIndex + 1) + "-" + (imageIndex + 1) + ".png",
              description: ${finalRoyal} && standardIndex === 8 ? "وصف عربي اصطناعي طويل لاختبار استمرار النص دون فقدان أو تداخل مع الصورة. ".repeat(30) : ${teacherLayouts} ? "وصف تعليمي اصطناعي موجز." : "وصف اصطناعي موجز لمراجعة وضوح الصورة وارتباطها بالمعيار دون استخدام بيانات حقيقية.",
              evidence_date: imageIndex % 2 === 0 ? "2026-11-15" : null,
              created_at: "2026-11-15T00:00:00.000Z", mime_type: "image/png", file_size: bytes.length,
            },
            bytes,
          };
        }
      )).flat()
    ];
    const imageGeometry = [];
    const imagePageGroups = [];
    const standardGeometry = [];
    const generatedPages = [];
    const indexEntries = [];
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.dataset.portfolioPageNumber) {
          generatedPages.push({
            number: Number(node.dataset.portfolioPageNumber), total: Number(node.dataset.portfolioTotalPages),
            standard: node.querySelector('[data-standard-number]')?.getAttribute("data-standard-number"),
          });
          for (const entry of node.querySelectorAll("[data-toc-page]")) indexEntries.push({
            standard: entry.getAttribute("data-toc-standard"), page: Number(entry.getAttribute("data-toc-page"))
          });
        }
        const standard = node.querySelector('[data-standard-cover]');
        if (standard) {
          const viewport = standard.querySelector('[data-standard-viewport]').getBoundingClientRect();
          const body = standard.querySelector('[data-standard-body]').getBoundingClientRect();
          standardGeometry.push({
            number: standard.getAttribute("data-standard-number"),
            bodyBottom: body.bottom, viewportBottom: viewport.bottom,
            bodyRight: body.right, viewportRight: viewport.right,
          });
        }
        const group = [];
        for (const item of node.querySelectorAll('[data-evidence-item]')) {
          const slot = item.querySelector('[data-evidence-image-slot]');
          const caption = item.querySelector('[data-evidence-caption]');
          const image = slot.getBoundingClientRect();
          const text = caption.getBoundingClientRect();
          const geometry = {
            id: item.getAttribute("data-evidence-item"),
            sourceAspect: Number(item.getAttribute("data-image-aspect")),
            imageTop: image.top, imageBottom: image.bottom,
            imageWidth: image.width, imageHeight: image.height, imageLeft: image.left,
            captionLeft: text.left, captionRight: text.right,
            captionTop: text.top, captionBottom: text.bottom
          };
          group.push(geometry);
          imageGeometry.push(geometry);
        }
        if (group.length) imagePageGroups.push(group);
      }
    });
    observer.observe(document.body, { childList: true });
    const result = await createPortfolioPdf({
      profile: ${JSON.stringify(profile)},
      standards: ${JSON.stringify(standards)},
      summaryStandards: ${JSON.stringify(standards)},
      progress: [
        {
          standard_id: "synthetic-standard-1",
          status: "completed",
          notes: "ملاحظة تجريبية للمراجعة البصرية توضح التفاف النص وتباعده في مساحة الإنجاز.",
        },
        { standard_id: "synthetic-standard-2", status: "in_progress", notes: null }
      ],
      generatedAt: new Date("2026-11-15T00:00:00.000Z"),
      evidenceLayout: ${teacherLayouts ? JSON.stringify({defaultItemsPerPage: 2, byStandard: {"synthetic-standard-1":1,"synthetic-standard-2":2,"synthetic-standard-3":3,"synthetic-standard-4":4}}) : "undefined"},
      cover: {
        layout: "royal",
        accent: "gold",
        title: "ملف الإنجاز الوظيفي",
      },
      attachments: ${standardCovers} ? standardCoverAttachments : ${JSON.stringify(imageCount)} === null ? [
        {
          evidence: {
            id: "synthetic-pdf-evidence",
            standard_id: "synthetic-standard-1",
            title: "مرفق تجريبي متعدد الصفحات",
            file_name: "دليل-تجريبي-خمس-صفحات.pdf",
            description: "ملف اصطناعي من خمس صفحات لاختبار بيانات الشاهد وترتيب الصفحات والحفاظ على المقاس والاتجاه الأصلي.",
            evidence_date: "2026-11-15",
            created_at: "2026-11-15T00:00:00.000Z",
            mime_type: "application/pdf",
            file_size: pdfBytes.length
          },
          bytes: pdfBytes
        },
        {
          evidence: {
            id: "synthetic-image-evidence",
            standard_id: "synthetic-standard-2",
            title: "شاهد بصري تجريبي",
            file_name: "صورة-تجريبية.png",
            description: "صورة اصطناعية لاختبار عرض بيانات الشاهد والحفاظ على تناسب الصورة في نسخة المراجعة.",
            evidence_date: "2026-11-15",
            created_at: "2026-11-15T00:00:00.000Z",
            mime_type: "image/png",
            file_size: landscapeImageBytes.length
          },
          bytes: landscapeImageBytes
        },
        {
          evidence: {
            id: "synthetic-portrait-image-evidence",
            standard_id: "synthetic-standard-3",
            title: "شاهد عمودي تجريبي",
            file_name: "صورة-عمودية-تجريبية.png",
            description: "صورة عمودية اصطناعية للتحقق من التناسب ووضوح العرض دون قص أو تمديد. " + "تفصيل افتراضي طويل يختبر استمرار الوصف على صفحة تالية دون تصغير الصورة أو فقدان أي نص. ".repeat(18) + "نهاية الوصف التجريبي الطويل.",
            evidence_date: null,
            created_at: "2026-11-15T00:00:00.000Z",
            mime_type: "image/png",
            file_size: portraitImageBytes.length
          },
          bytes: portraitImageBytes
        }
      ] : Array.from({length: ${JSON.stringify(imageCount)}}, (_, index) => {
        const bytes = index % 2 === 0 ? landscapeImageBytes : portraitImageBytes;
        return {
          evidence: {
            id: "synthetic-image-" + (index + 1),
            standard_id: "synthetic-standard-1",
            title: "شاهد تجريبي " + (index + 1),
            file_name: "synthetic-image-" + (index + 1) + ".png",
            description: "وصف اصطناعي موجز للشاهد للتحقق من وضوح الصورة وتسلسلها والمسافة بينها وبين بياناتها.",
            evidence_date: index % 2 === 0 ? "2026-11-15" : null,
            created_at: "2026-11-15T00:00:00.000Z",
            mime_type: "image/png",
            file_size: bytes.length,
          },
          bytes
        };
      })
    }).catch(error => { throw new Error(error.message + " | captured geometry: " + JSON.stringify(standardGeometry)); });
    observer.disconnect();
    if (generatedPages.some(page => page.total !== result.pageCount)) throw new Error("Generated page total is inaccurate.");
    if (new Set(generatedPages.map(page => page.number)).size !== generatedPages.length) throw new Error("Generated page numbering is duplicated.");
    for (const entry of indexEntries) {
      if (!generatedPages.some(page => page.number === entry.page && page.standard === entry.standard)) {
        throw new Error("Index reference does not point to its actual standard cover: " + JSON.stringify(entry));
      }
    }
    const coverPages = generatedPages.filter(page => page.standard);
    if (JSON.stringify(coverPages.map(page => page.standard)) !== JSON.stringify(${JSON.stringify(standards.map(standard => standard.code))})) {
      throw new Error("Standard cover order changed.");
    }
    if (imageGeometry.length !== ${teacherLayouts ? 30 : finalRoyal ? 16 : standardCovers ? 17 : imageCount ?? 2}) throw new Error("Unexpected evidence image count.");
    if (standardGeometry.length !== ${imageCount ? 1 : 11}) throw new Error("Each selected standard must have exactly one cover.");
    for (const standard of standardGeometry) {
      if (standard.bodyBottom > standard.viewportBottom + 1 || standard.bodyRight > standard.viewportRight + 1) {
        throw new Error("Standard " + standard.number + " content exceeds its safe page bounds.");
      }
    }
    const expectedGroups = ${JSON.stringify(teacherLayouts ? [1,1,1,2,2,1,3,3,1,4,4,1,1,1,1,1,1,1] : standardCovers
      ? Array.from({length: finalRoyal ? 10 : 11}, (_, index) => Array.from({length: Math.ceil((index < 4 ? index + 1 : 1) / 2)}, (_, group) => Math.min(2, (index < 4 ? index + 1 : 1) - group * 2))).flat()
      : imageCount ? Array.from({length: Math.ceil(imageCount / 2)}, (_, index) => Math.min(2, imageCount - index * 2)) : [1, 1])};
    if (JSON.stringify(imagePageGroups.map(group => group.length)) !== JSON.stringify(expectedGroups)) {
      throw new Error("Suitable same-standard images did not paginate into the selected layout: " + JSON.stringify(imagePageGroups));
    }
    for (const group of imagePageGroups) {
      if (group.length === 1 && Math.abs(group[0].imageHeight - 1123 / 3) > 2) {
        throw new Error("Single image should occupy approximately one-third of A4 height.");
      }
      for (let index = 1; index < group.length; index++) {
        const item = group[index];
        for (const previous of group.slice(0, index)) {
          if (!(item.captionLeft >= previous.captionRight + 15 || previous.captionLeft >= item.captionRight + 15 ||
              item.imageTop >= previous.captionBottom + 15)) throw new Error("Evidence items overlap or are not clearly separated.");
        }
      }
      if (group.length === 4 && (group[0].imageTop !== group[1].imageTop || group[2].imageTop !== group[3].imageTop ||
          group[0].imageLeft <= group[1].imageLeft)) throw new Error("Four items must use a strict RTL 2x2 grid.");
      if (group.some(item => item.imageHeight < (${teacherLayouts} ? 0.42 : 0.8) * 1123 / 3 - 2)) {
        throw new Error("Evidence images were excessively shrunk.");
      }
    }
    for (const geometry of imageGeometry) {
      if (geometry.captionTop < geometry.imageBottom + 10) throw new Error("Evidence caption overlaps image.");
      if (geometry.captionBottom > 1042) throw new Error("Evidence caption extends into footer.");
    }
    for (let index = 0; index < imageGeometry.length; index++) {
      const item = imageGeometry[index];
      if (Math.abs(item.imageWidth / item.imageHeight - item.sourceAspect) > 0.001) {
        throw new Error("Evidence image proportions changed.");
      }
    }
    // Inspect the actual assembled PDF, not just its page count or intermediate HTML.
    const { openPdf } = await import("/src/lib/pdf-render.ts");
    const renderedPdf = await openPdf(result.bytes.slice().buffer);
    const visiblePages = [];
    for (let number = 1; number <= renderedPdf.numPages; number++) {
      const page = await renderedPdf.getPage(number);
      const viewport = page.getViewport({ scale: 0.65 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      await page.render({ canvasContext: context, viewport }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      let black = 0;
      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        const y = Math.floor(pixel / 4 / canvas.width);
        if (pixels[pixel] < 18 && pixels[pixel + 1] < 18 && pixels[pixel + 2] < 18) black++;
        if (y > canvas.height * 0.12 && y < canvas.height * 0.9 &&
            pixels[pixel] < 150 && pixels[pixel + 1] < 180 && pixels[pixel + 2] < 180) ink++;
      }
      // Original fixtures may intentionally contain only a small source label.
      const isOriginal = !generatedPages.some(generated => generated.number === number);
      if (!isOriginal && ink < 100) throw new Error("Generated PDF page " + number + " has no visible content.");
      if (!isOriginal && black / (pixels.length / 4) > .98) throw new Error("Generated PDF page " + number + " is black.");
      if (!isOriginal) {
        const edge = Math.floor(canvas.height / 2) * canvas.width * 4;
        if (Math.abs(pixels[edge] - 248) > 3 || Math.abs(pixels[edge + 1] - 245) > 3 ||
            Math.abs(pixels[edge + 2] - 236) > 3) {
          throw new Error("Generated PDF page " + number + " lost its full-bleed ivory background.");
        }
      }
      visiblePages.push({ number, ink });
      page.cleanup();
    }
    await renderedPdf.destroy();
    const base64 = [];
    for (let index = 0; index < result.bytes.length; index += 32768) {
      base64.push(String.fromCharCode(...result.bytes.subarray(index, index + 32768)));
    }
    return {
      pageCount: result.pageCount,
      warnings: result.warnings,
      byteLength: result.bytes.length,
      visiblePages,
      imageGeometry,
      imagePageGroups,
      standardGeometry,
      generatedPages,
      pdfBase64: btoa(base64.join(""))
    };
  })()`;

  const evaluation = await devTools.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || "Synthetic PDF export failed.");
  }
  const result = evaluation.result?.value;
  assert.ok(result, `Chromium returned no sample export result. ${browserErrors.slice(-2000)}`);
  assert.equal(result.warnings.length, 0, "Synthetic evidence should export without attachment warnings.");
  if (imageCount) {
    assert.equal(result.pageCount, 7 + Math.ceil(imageCount / 2));
    assert.deepEqual(result.imageGeometry.map(item => item.id),
      Array.from({length: imageCount}, (_, index) => `synthetic-image-${index + 1}`), "Evidence order must be preserved.");
  } else {
    assert.ok(result.pageCount >= 20, "The sample should include 11 standards, two images, and all five source-PDF pages.");
  }

  const outputBytes = Buffer.from(result.pdfBase64, "base64");
  assert.equal(outputBytes.length, result.byteLength);
  await mkdir(join(process.cwd(), "generated-artifacts"), { recursive: true });
  await writeFile(outputPath, outputBytes);

  const generatedPdf = await PDFDocument.load(new Uint8Array(await readFile(outputPath)));
  assert.equal(generatedPdf.getPageCount(), result.pageCount);
  const sourcePages = generatedPdf.getPages().filter((page) =>
    evidencePdf.sizes.some(([width, height]) => page.getWidth() === width && page.getHeight() === height),
  );
  assert.equal(sourcePages.length, imageCount ? 0 : 5, "Every original source-PDF page must be present.");
  if (!imageCount) {
    assert.deepEqual(sourcePages.map((page) => [page.getWidth(), page.getHeight()]), evidencePdf.sizes);
    assert.deepEqual(sourcePages.map((page) => page.getRotation().angle), evidencePdf.rotations);
  }
  const embeddedImageDimensions = [];
  for (const page of generatedPdf.getPages()) {
    const resources = page.node.Resources();
    const objects = resources?.lookup(PDFName.of("XObject"));
    if (!(objects instanceof PDFDict)) continue;
    for (const [, reference] of objects.entries()) {
      const object = generatedPdf.context.lookup(reference);
      if (object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image") {
        embeddedImageDimensions.push([
          Number(object.dict.get(PDFName.of("Width"))?.toString()),
          Number(object.dict.get(PDFName.of("Height"))?.toString()),
        ]);
      }
    }
  }
  assert.ok(embeddedImageDimensions.some(([width, height]) => width === 1200 && height === 800), "Landscape evidence must retain its original image resolution.");
  if (imageCount !== 1) assert.ok(embeddedImageDimensions.some(([width, height]) => width === 800 && height === 1200), "Portrait evidence must retain its original image resolution.");
  assert.ok(generatedPdf.getPages().every((page) =>
    evidencePdf.sizes.some(([width, height]) => page.getWidth() === width && page.getHeight() === height) ||
    (Math.abs(page.getWidth() - 595.28) < 0.01 && Math.abs(page.getHeight() - 841.89) < 0.01)),
    "Generated pages should use portrait A4; original PDF dimensions must stay unchanged.");

  console.log(`Generated ${outputPath}`);
  console.log(`Validated ${result.pageCount} pages (${outputBytes.length} bytes)${imageCount ? `; image groups: ${result.imagePageGroups.map(group => group.length).join(", ")}` : ", including all five source-PDF pages"}.`);
  console.log(`Verified final-PDF visible content on ${result.visiblePages.length} pages and caption geometry for ${result.imageGeometry.length} original-resolution images.`);
  console.log(`Verified ${result.standardGeometry.length} dedicated standard covers with all body content inside its safe bounds.`);
} finally {
  try {
    await devTools?.send("Browser.close");
  } catch {
    // Chromium may already have exited after a failed export.
  }
  devTools?.socket.close();
  if (browserProcess && browserProcess.exitCode === null) browserProcess.kill("SIGKILL");
  if (browserClosed) {
    await Promise.race([browserClosed, new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
  await rm(profileDirectory, { recursive: true, force: true });
}
