---
name: Production and billing safety
description: User's standing approval requirement for production data and billing-related changes in this project.
---

For the Injazi Teacher Portfolio project, do not change production data,
subscription settings, or payment features without the user's explicit approval.

**Why:** The user set this as a project safety rule.

**How to apply:** Before any operation that writes production data or changes
subscription/payment behavior, explain the exact scope and wait for explicit
approval. Prefer an isolated test environment for write-dependent QA.
