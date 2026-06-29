# Design QA — Delegate Surface Sync

- source visual truth path: `DESIGN.md`
- source evidence: `.gstack/design-reports/delegate-20260629-195351/screenshots/*-before-*.png`
- implementation evidence: `.gstack/design-reports/delegate-20260629-195351/screenshots/*-after-v3-*.png`, `.gstack/design-reports/delegate-20260629-195351/screenshots/dashboard-after-v4-*.png`
- viewport: desktop `1280x720`, tablet `768x1024`, mobile `375x812`
- state: Site home, Dashboard overview, Reps public representative page
- full-view comparison evidence: before/after responsive screenshots captured with gstack browse
- focused region comparison evidence: focused on mobile dashboard ordering, representative chat ordering, shared card surfaces, and marketing hero hierarchy

## Findings

- The Site, Dashboard, and Reps surfaces now share the Dispatch Editorial system more consistently: warm paper surfaces, sea-ink trust states, copper action states, stronger ruled cards, and clearer editorial hierarchy.
- Mobile Dashboard now shows the operating stage before the workspace directory, matching the product priority in `DESIGN.md`.
- Mobile Reps now gives conversation priority before service tiers and releases section headings from two-column compression.
- Small-screen entry animations were disabled so long screenshots and lower-page cards remain readable instead of appearing faded.

## Patches Made

- Tightened shared visual tokens, card contrast, topbar surfaces, hero/stage treatment, and mobile breakpoints in `packages/web-ui/styles/globals.css`.
- Added a representative chat panel class so mobile ordering can prioritize the conversation surface.
- Updated `DESIGN.md` to reflect resilient local font fallback loading instead of build-time Google Fonts fetches.

## Residual Notes

- Browser QA still reports a hydration warning caused by `caret-color: transparent` appearing on form fields in the browser environment. The warning was present before this design pass and appears tied to browser/runtime field styling rather than the visual CSS changes.

## Final Result

final result: passed
