/*
 * Generates assets/extraction/engine.html — a single self-contained HTML file
 * that runs inside the app's hidden WebView (lib/extraction/engine.tsx) and
 * does the heavy parsing the app can't do in Hermes: Mozilla Readability for
 * web articles and pdf.js for PDF text extraction.
 *
 * Everything is inlined so the page loads with ZERO network access. Re-run
 * this after bumping @mozilla/readability or pdfjs-dist:
 *
 *   npm run build:engine
 *
 * The generated file is committed so CI / prebuild don't need to run this.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readabilitySrc = fs.readFileSync(
  path.join(root, "node_modules/@mozilla/readability/Readability.js"),
  "utf8"
);
const pdfSrc = fs.readFileSync(
  path.join(root, "node_modules/pdfjs-dist/build/pdf.min.mjs"),
  "utf8"
);
const pdfWorkerSrc = fs.readFileSync(
  path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
  "utf8"
);

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body>
<script>
// --- Mozilla Readability (CommonJS -> window global) ----------------------
(function () {
  var module = { exports: {} };
  ${readabilitySrc}
  window.Readability = module.exports;
})();
</script>

<script type="module">
${pdfSrc}
// pdf.js needs a worker; build one from the inlined worker source as a blob
// URL so nothing is fetched over the network.
const workerBlob = new Blob([${JSON.stringify(pdfWorkerSrc)}], { type: "text/javascript" });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
window.__pdfjsLib = pdfjsLib;
window.__pdfjsReady = true;
</script>

<script>
(function () {
  function reply(id, ok, payload) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify(ok ? { id: id, ok: true, result: payload } : { id: id, ok: false, error: payload })
    );
  }

  function b64ToUtf8(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  async function runReadability(payload) {
    var html = b64ToUtf8(payload.htmlB64);
    var doc = new DOMParser().parseFromString(html, "text/html");
    if (payload.baseUrl) {
      var base = doc.createElement("base");
      base.href = payload.baseUrl;
      doc.head && doc.head.appendChild(base);
    }
    var lang = (doc.documentElement.getAttribute("lang") || "").trim() || null;
    var article = new window.Readability(doc).parse();
    return {
      title: (article && article.title) || "",
      text: (article && article.textContent) || "",
      language: lang,
    };
  }

  async function waitForPdfjs() {
    for (var i = 0; i < 100 && !window.__pdfjsReady; i++) {
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    if (!window.__pdfjsReady) throw new Error("pdfjs_load_failed");
  }

  async function runPdf(payload) {
    await waitForPdfjs();
    var pdfjsLib = window.__pdfjsLib;
    var buf = await (await fetch(payload.fileUri)).arrayBuffer();
    var pdf;
    try {
      pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
    } catch (e) {
      if (e && e.name === "PasswordException") { var pw = new Error("password_protected"); pw.code = "password_protected"; throw pw; }
      var cf = new Error("corrupt_file"); cf.code = "corrupt_file"; throw cf;
    }
    var parts = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var line = content.items.map(function (it) { return it.str; }).join(" ");
      if (line.trim()) parts.push(line);
    }
    var meta = null;
    try { meta = await pdf.getMetadata(); } catch (e) {}
    var title = (meta && meta.info && meta.info.Title) || payload.fallbackTitle || "";
    return { title: String(title).slice(0, 200), text: parts.join("\\n\\n"), language: null };
  }

  window.addEventListener("message", handle);
  document.addEventListener("message", handle); // Android

  async function handle(ev) {
    var msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (!msg || !msg.id) return;
    try {
      var result;
      if (msg.op === "readability") result = await runReadability(msg.payload);
      else if (msg.op === "pdf") result = await runPdf(msg.payload);
      else throw new Error("unknown_op");
      reply(msg.id, true, result);
    } catch (err) {
      reply(msg.id, false, (err && (err.code || err.message)) || "engine_error");
    }
  }

  window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }));
})();
</script>
</body>
</html>
`;

const outDir = path.join(root, "assets/extraction");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "engine.html"), html);
console.log(
  `engine.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`
);
