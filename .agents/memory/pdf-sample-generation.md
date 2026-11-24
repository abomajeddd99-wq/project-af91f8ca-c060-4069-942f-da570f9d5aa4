---
name: Browser-based PDF sample generation
description: Avoid Vite watcher exhaustion and raw CommonJS imports when validating the full portfolio exporter.
---

For full browser-based PDF samples, use the running app's Vite dev server as the module loader rather than starting an isolated Vite server.

**Why:** A project-root test server scanned large local caches and exhausted file watchers; a temporary Vite root served `pdf-lib`'s `pako` CommonJS module without optimization. Both failures came from the test harness, not the exporter.

**How to apply:** Launch isolated Chromium against the running local app and import the exporter from that same origin. Keep all sample evidence synthetic and local.

Browser evaluation does not rewrite bare package imports. Resolve React and ReactDOM through the running Vite app's optimized module URLs when mounting real UI in a synthetic browser harness.

**Why:** Bare imports inside an evaluated string fail in the browser; using unrelated React entry points can also produce duplicate runtimes.

**How to apply:** Read the app-served component module's resolved import URL and use the matching optimized runtime, rather than relying on Node-style resolution inside browser evaluation.
