## CSS Refactor Plan: Split `styles.css`

### Objectives
- Maintain visual parity while improving maintainability and navigation.
- Introduce a small, predictable set of CSS files without adding a build step.
- Preserve cascade and specificity; avoid regressions in dark mode, accessibility, and PWA UX.

### Constraints and Context
- No CSS bundler/post-processor; site is served statically via Netlify.
- `index.html` currently links a single `styles.css`. Other HTML files may also link it (`offline.html`, `pwa-test.html`, `test-app.html`, `verify.html`).
- HTTP/2 is available on Netlify; 5–6 CSS files is acceptable.

### Target File Structure
- `styles/tokens.css`: CSS variables, color scales, spacing, typography scale, theme tokens (light/dark/auto), z-index, radii, transitions, legacy token aliases.
- `styles/base.css`: Reset, base element styles, typography, global focus indicators, utilities (`.hidden`, `.sr-only`, `.link-button`), print rules.
- `styles/layout.css`: Page-level layout (header, nav, main, footer), responsive containers, grids, view transitions, sticky filters container.
- `styles/components.css`: Reusable components (buttons, cards, badges, modals, notifications/toast, skeletons), animations used across components.
- `styles/features.css`: App feature areas (filters, equipment grid/cards, workout builder, substitutes, history, settings, search suggestions, keyboard help, migration modal content styles).
- `styles/pwa.css`: Offline/queue indicators, SW update notification, standalone/iOS display-mode adjustments, reduced motion and high-contrast adjustments.

### Load Order (preserve cascade)
Place these in `<head>` in this exact order across all HTML pages:

```html
<link rel="stylesheet" href="styles/tokens.css?v=2.1.0">
<link rel="stylesheet" href="styles/base.css?v=2.1.0">
<link rel="stylesheet" href="styles/layout.css?v=2.1.0">
<link rel="stylesheet" href="styles/components.css?v=2.1.0">
<link rel="stylesheet" href="styles/features.css?v=2.1.0">
<link rel="stylesheet" href="styles/pwa.css?v=2.1.0">
```

### Mapping From `styles.css` to New Files (approximate sections)
- To ensure minimal risk, move blocks verbatim and in order. The following headings refer to comment banners already in `styles.css`.

- `styles/tokens.css`
  - Design System - Token Based Architecture (variables): L7–L137
  - Dark Theme Variables: L139–L179
  - Auto Dark Mode based on system preference: L181–L222
  - Elevation, radii, transitions, z-index are contained within the variables section above.
  - Legacy token aliases (keep for compatibility): part of L112–L129
  - Zone colors (light/dark/auto): L130–L137, L172–L179, L214–L221

- `styles/base.css`
  - Reset and Base Styles: L224–L243
  - Typography System: L245–L276
  - Focus States (global): L278–L297
  - Minimum touch target size: L298–L303
  - Utility Classes: `.hidden`, `.sr-only`, `.link-button`: L2248–L2279
  - Enhanced Focus Indicators and accessibility prefs (global): L2281–L2350
  - Print Styles: L2352–L2376

- `styles/layout.css`
  - Header Styles: L304–L344, `.gym-info`, `.tagline`, `.header-info`, header controls: L346–L407
  - Navigation Styles: L418–L459
  - Main Content: L460–L477
  - Filters Section container and sticky behaviors: L479–L505, L507–L509
  - Responsive Design media queries (layout-level): L1673–L1730, L1732–L1797, L2021–L2058, L2060–L2095
  - Status Bar and Footer: L1633–L1663, L1642–L1663

- `styles/components.css`
  - Buttons (primary/secondary/danger/ghost): L1263–L1296, L2860–L2921, L2004–L2019
  - Cards: Equipment card container visuals: L807–L821, animations: L2818–L2843
  - Badges (`.zone-badge`): L839–L855
  - Skeleton Loading States (component-level): L975–L1066 and the later skeleton block L2662–L2801
  - Modal base: L1068–L1184, L1186–L1220 (header/body), close button: L1140–L1159, focus: L2334–L2339
  - Notifications/Toast: L1568–L1631, L2922–L2988
  - Animations shared across components: `fadeIn`, `spin`, `rotate`, `toastSlideIn/Out`, etc.

- `styles/features.css`
  - Filter chips and filter buttons: L616–L799
  - Equipment feature specifics (header, body, muscles, actions): L822–L974, L856–L912
  - Forms (generic and auth forms): L1232–L1261, L1869–L1915
  - Workout Builder: L1298–L1403
  - Substitutes: L1404–L1463
  - History: L1485–L1547
  - Settings: L1549–L1566
  - Authentication UI (header user-status, buttons): L1799–L1867, L1812–L1826
  - Keyboard Help modal content and grid: L558–L614, L564–L607, L186–L194 if referenced as content styles
  - Migration modal content styles: L1952–L2019
  - Search Suggestions UI: L2990–L3063

- `styles/pwa.css`
  - PWA and Offline Styles: L2378 onward until end of PWA blocks
  - Sync indicator, offline bar, queue indicator: L2380–L2571
  - SW update notification: L2573–L2610
  - Standalone and iOS display-mode adjustments: L2495–L2524
  - Responsive PWA adjustments: L2612–L2634
  - High contrast and reduced motion PWA tweaks: L2636–L2660, L2648–L2660

Note: Line numbers are approximate and for orientation. Move sections by their comment headers and class blocks, not strictly by line numbers.

### Migration Steps
1. Create directory `styles/` at repo root.
2. Extract sections from `styles.css` into the new files listed above, maintaining original declaration order inside each file.
3. Update HTML pages to include the 6 new CSS files in the specified order:
   - `index.html`
   - `offline.html`
   - `pwa-test.html`
   - `test-app.html`
   - `verify.html`
4. Replace the existing `<link rel="stylesheet" href="styles.css">` with the set from the Load Order snippet.
5. Add version query parameters (e.g., `?v=2.1.0`) to mitigate cached assets on client devices.
6. Keep the original `styles.css` in Git history only; remove it from the HTML and repository after validation. If desired, retain a temporary `styles/umbrella.css` that `@import`s the new files for manual diffing during review, but do not ship `@import` to production.

### Validation Checklist (must pass on desktop and iOS Safari standalone)
- Visual parity: key pages and panels (Equipment, Workout, Substitutes, History, Settings) match before/after screenshots.
- Theming: Light, Dark, and Auto (prefers-color-scheme) render correctly; tokens resolve in both modes.
- Accessibility: Focus-visible indicators on all interactive elements; skip link appears on focus; forms and modals preserve outline behavior; `prefers-reduced-motion` disables non-essential animations.
- High contrast: `prefers-contrast: high` rules apply; focus and offline indicators remain legible.
- PWA behaviors: Offline banner, queue indicator, SW update notification render and animate as expected; standalone and iOS display-mode adjustments apply.
- Responsiveness: Breakpoints at 768px and 480px render correct layouts for header/nav, filters, grid, and modals.
- Print styles: Non-print components are hidden; cards avoid page breaks.
- No console warnings about missing assets; no 404s for CSS.

### Performance Considerations
- Multiple small CSS files are fine under HTTP/2. Keep the set to 6 files to balance caching granularity and request overhead.
- All CSS must remain in `<head>` to avoid FOUC.
- Consider adding `preload` for `tokens.css` if initial paint shows flashes (optional, measure first).

### Risks and Mitigations
- Cascade/specificity shifts: Preserve file order and internal block order. Do not reorder selectors or declarations during extraction.
- Dark mode regressions: Keep theme variables solely in `tokens.css`; component files should reference tokens, not hard-coded colors.
- Duplicate declarations: Avoid copying shared animations or variables into multiple files; centralize in `tokens.css` or `components.css` as mapped.
- Cache staleness: Use versioned query params and update on each deploy until a proper hashing strategy exists.

### Rollback Plan
- Revert to the commit prior to split. Since HTML links are the only integration point, a single revert restores prior behavior.

### Future Enhancements (optional, post-refactor)
- Introduce a minimal build step (PostCSS) to concatenate and minify into a single `app.css` while keeping the source files split for DX.
- Add stylelint with a basic config to guard against accidental hard-coded colors and enforce token usage.

### Work Breakdown and Estimates
- Create structure and extract tokens/base/layout: 1.5–2.0 hours
- Extract components/features: 2.0–2.5 hours
- Extract PWA and responsive tweaks: 0.5–1.0 hour
- Update HTML pages and run manual validation: 1.0–1.5 hours
- Total: ~5–7 hours depending on review cycles

### Acceptance Criteria
- The app renders identically before and after on supported devices/browsers.
- No missing style rules; no console 404s for CSS files.
- Dark/light modes and accessibility preferences operate as prior.
- All HTML pages reference the new CSS files in the agreed order.

