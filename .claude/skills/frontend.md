---
description: Trigger this skill ANY TIME you are creating or modifying React components, Next.js pages, UI elements, or Tailwind CSS styles.
---

# Web Frontend Engineering Rules

## 🟢 DO (Mandatory)
- Write modular React components using hooks.
- Enforce strictly RTL (Right-to-Left) layout with Hebrew text (`dir="rtl"`).
- Implement "Glassmorphism" UI: use `backdrop-blur`, semi-transparent backgrounds (`bg-white/10`), and subtle borders.
- Always use `pointer-events-none` on decorative overlapping elements to prevent ghost clicks.

## 🔴 DON'T (Forbidden)
- Never leave interactive elements without hover/active states.
- Never fetch massive datasets on initial load without pagination or specific filters.