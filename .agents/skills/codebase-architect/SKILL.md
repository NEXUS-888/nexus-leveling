---
name: codebase-architect
description: Architectural standards and debugging guidelines for the zero-dependency HTML/CSS/JS single-page-style static app with Three.js 3D WebGL background layer.
---

# Codebase Architect Skill

Use this skill when refactoring, extending, or debugging the core JavaScript engine (`app.js`), CSS token system (`style.css`), or HTML page structures.

## Core Technical Patterns
1. **Three.js WebGL Layer**:
   - The 3D canvas is injected into `document.body` with `z-index: 1`.
   - Node buttons use `will-change: transform` and `translate3d(x, y, 0)` for 60fps GPU-composited rendering.
   - Parallax and momentum rotation utilize drag velocity decay (`dragVelocityY *= 0.95`).
2. **State Management**:
   - `S.get()` and `S.set()` handle `localStorage` reads/writes.
   - All state updates dispatch `window.dispatchEvent(new CustomEvent('nexus-state-change'))`.
   - DOM re-renders should use snapshot diffing (`_statsSnapshot`, `_heatmapData`, etc.) to minimize DOM thrashing.
3. **Responsive Navigation & Keyboard Escape Hatch**:
   - Pressing `/` toggles the terminal Command Palette overlay for rapid keyboard navigation.
   - Hamburger menu handles mobile navigation toggle.
