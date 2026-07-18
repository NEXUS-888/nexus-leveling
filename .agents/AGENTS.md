# Workspace Rules: Vishal Engineering Portfolio

## Architecture & Code Standards
1. **Zero-Framework Frontend**: Maintain pure HTML5, Vanilla CSS3, and ES6+ JavaScript. Avoid heavy framework dependencies.
2. **Performance First**:
   - Use `translate3d` and GPU compositing for animations instead of modifying `left`/`top`.
   - Throttle scroll, touch, and resize handlers with `requestAnimationFrame` and `{ passive: true }`.
   - Use state-diffing snapshot checks before updating DOM nodes or Chart rendering loops.
3. **Data Integrity & Offline-First**:
   - All primary user data resides in `localStorage` with JSON import/export fallbacks.
   - Dispatch `nexus-state-change` custom events whenever `S.set()` or `S.del()` is invoked to trigger reactive UI updates across all active widgets.
   - Maintain the `_nexus_pending` local retry queue for failing network requests.

## Portfolio & Content Standards
1. **Proof-First Storytelling**:
   - Emphasize tangible artifacts (deployed URLs, repository READMEs, architecture decision records, debugging notes) over theoretical progress.
   - Use STAR format (Situation, Task, Action, Result) for practice cards and project summaries.
2. **Obsidian Harmony**:
   - Keep raw, unedited thoughts in local Obsidian notes.
   - Use this web app as the public-facing showcase and structured tracker.
