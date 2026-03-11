---
description: Trigger this skill when working on the Backend, Database schema (Prisma), or Seed scripts.
---

# Backend & Database Rules

## 🟢 DO (Mandatory)
- Follow strict architecture: Controller -> Service -> Repository.
- Validate all incoming requests using DTOs.
- Keep output concise. Output ONLY the necessary code changes.

## 🔴 DON'T (Forbidden)
- NEVER invent or use dummy data for Ministry of Education norms or tests. Always query the real data from the PostgreSQL database.
- Never expose raw database errors to the frontend.