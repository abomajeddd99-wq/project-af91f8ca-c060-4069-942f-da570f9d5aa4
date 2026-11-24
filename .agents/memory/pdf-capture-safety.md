---
name: Generated PDF capture safety
description: Why valid PNG bytes and successful page merging do not prove a generated portfolio page is usable.
---

Treat decoded dimensions and visible content as part of capture success, not merely successful PNG decoding or PDF insertion. Retry a failed generated capture once at a lower bounded resolution, then stop explicitly rather than saving or removing a damaged page.

**Why:** A user-supplied portfolio contained a valid one-pixel black raster stretched over an entire generated A4 page, while adjacent captures had normal dimensions. File validity and page counts alone missed the failure. The exact browser-level trigger was not established from the exported PDF.

**How to apply:** Preserve explicit capture dimensions and browser-based black/blank/collapsed-image regression checks when changing the exporter. Apply quality rejection only to generated page captures, never to original uploaded PDF pages or teacher evidence images, which must remain intact.
