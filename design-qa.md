# Design QA — Koraz landing

- original visual reference: `D:\Jose (Datos)\UI Koraz Web\Imagen de Codex 29 ago 2026, 07_47_26 p.m..png`
- annotated revision reference: `C:\Users\josed\AppData\Local\Temp\codex-clipboard-04279759-199e-41f6-a5aa-a84e69d46680.png`
- revision source of truth: browser comments 1–14 supplied by the user
- inspected mobile viewport range: 415–460 × 698 CSS px
- browser-supplied desktop evidence: 1186 × 698 px
- state: anonymous landing, closed and open mobile navigation, plans comparison

## Revision requirements

- Removed the four floating hero cards: Anatomía 3D, Flashcards, progress and quizzes.
- Removed the secondary “Ver plataforma” action.
- Simplified the main navigation to Planes plus the two account actions.
- Reduced the resource rail to five items, removed every descriptive subtitle and removed Rutas de estudio.
- Removed the three pricing captions below the plan names.
- Rebuilt pricing as a cumulative comparison with one shared eight-benefit matrix.

## Pricing comparison

All cards use the same benefit order so plans can be compared line by line:

1. Materias esenciales
2. Videos y guías
3. Cuestionarios
4. Seguimiento de progreso
5. Acceso a todas las materias
6. Flashcards ilimitadas
7. Casos clínicos exclusivos
8. Soporte prioritario

Básico includes benefits 1–4 and marks 5–8 with an X. Pro inherits 1–4, adds 5–6 and marks 7–8 with an X. Premium inherits the complete Pro plan and adds 7–8. Every row also exposes its included or excluded state through an accessible label.

## Responsive evidence

- `tmp/landing-qa/revision-mobile-hero.png`: clean hero without floating cards or secondary action.
- `tmp/landing-qa/revision-mobile-features.png`: five title-only resources in a centered 3 + 2 mobile grid.
- `tmp/landing-qa/revision-mobile-menu.png`: Planes, Iniciar sesión and Regístrate are the only mobile navigation actions.
- `tmp/landing-qa/revision-mobile-pricing.png`: cumulative plan comparison with visible checks and X marks.
- Mobile width has no horizontal overflow.
- The desktop layout retains its fixed hero composition, changes the resource rail to five equal columns and gives the pricing cards enough height for all eight rows.

## Interaction and runtime checks

- Mobile menu opens and closes successfully.
- Selecting Planes closes the menu and scrolls to the pricing section.
- Registration and account routes are preserved.
- Browser console errors and warnings: none.
- `pnpm --filter @cediah/web typecheck`: passed.
- `pnpm --filter @cediah/web lint`: passed.
- `pnpm --filter @cediah/web build`: passed.

## Findings

No actionable P0, P1 or P2 issue remains. The black circular “N” visible in development screenshots belongs to the Next.js development overlay and is not rendered in production.

final result: passed
