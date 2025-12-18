## Light Mode Expectations (Reusable Spec)

### Theme source of truth

- **Default**: treat **dark mode as default** unless explicitly set otherwise.
- **Storage**: the app reads `localStorage.getItem('theme')` and interprets `'light'` as **light mode**; anything else falls back to **dark**.
- **Propagation**: if a component is theme-aware, it must accept `isDarkMode?: boolean` and **forward** it to child components (`ChatView`, `ChatHistoryView`, `CourseModuleList`, viewers/editors, dialogs) so the whole subtree renders consistently.

### Non-negotiables (do not change in light mode)

- **Structure parity**: spacing, layout, padding, margins, borders, rounded corners, element order, hover/active logic, and accessibility behavior must remain unchanged.
- **Interaction parity**: all click targets, disabled states, progress logic, completion logic, and “active row” logic must be identical across themes.
- **No “new UI”**: do not add extra hints, help boxes, decorative containers, or additional UI elements just for light mode.

### What changes in light mode (colors only)

- **Backgrounds**: dark backgrounds become **white / very-light gray**; avoid introducing new gradients or decorative backgrounds.
- **Text**: use readable dark text (`text-slate-900`/`text-gray-900`) with muted secondary text (`text-gray-600`/`text-gray-500`).
- **Borders**: replace dark borders (`border-[#222222]`, `border-gray-800`) with light borders (`border-gray-200`/`border-gray-300`).
- **Elevation**: if the dark version has no shadow, keep it that way; if you need separation in light mode, prefer **borders** over shadows.

### Shared color semantics (keep consistent across the app)

- **Completed**: **emerald** accents (light: `text-emerald-600`, `border-emerald-400`, optional subtle fill `bg-emerald-50`; dark keeps existing green presentation).
- **Partially complete / in-progress quiz**: **amber** accents (light: `text-amber-600`, `border-amber-400`, optional subtle fill `bg-amber-50`).
- **Learning material vs quiz differentiation**: keep the same _category_ cues from dark mode; in light mode prefer subtle tints and readable icon colors:
  - **Material**: rose-based cues (e.g. `bg-rose-50`, `text-rose-600`)
  - **Quiz**: indigo-based cues (e.g. `bg-indigo-50`, `text-indigo-700`)
  - **Assignment**: keep distinct from quiz/material (commonly rose/pink family is fine) but don’t change icons/structure.

### Recommended class patterns (copy/paste style)

- **Page wrapper**: `isDarkMode ? 'bg-black text-white' : 'bg-white text-black'`
- **Card / panel**:
  - Dark: `bg-[#111111] border border-[#222222]`
  - Light: `bg-white border border-gray-200` (optional `shadow-sm` only if the dark version also has elevation)
- **Left “content” panel (read-only viewer)**:
  - Dark: `bg-[#1A1A1A] border-[#222222]`
  - Light: `bg-gray-50 border-gray-200`
- **Inputs**:
  - Dark: `bg-[#161925] border-gray-800 text-white focus:ring-white`
  - Light: `bg-white border-gray-300 text-black focus:ring-black`
- **Chips / pills**:
  - Dark: `bg-[#222222] text-white`
  - Light: `bg-gray-100 text-gray-700`
- **Primary button**:
  - Dark: `bg-white text-black`
  - Light: `bg-black text-white`
- **Secondary/outline button (completion)**:
  - Light: `text-emerald-600 border-emerald-400 hover:bg-emerald-50`

### Chat-specific expectations

- **Bubbles**: preserve sender alignment and sizing; only swap colors.
  - Light user bubble: warm neutral/amber tint is acceptable (e.g. `bg-amber-100 text-amber-900 border border-amber-200`)
  - Light AI bubble: indigo tint is acceptable (e.g. `bg-indigo-100 text-indigo-900 border border-indigo-200`)
- **Code blocks**: keep strong contrast; light mode can use dark code backgrounds (`bg-slate-900`) with light text.
- **File download UI**: keep the same button placement; in light mode ensure contrast (e.g. `bg-indigo-600 text-white`).

### Mobile/desktop parity

- Sidebars, sticky headers, and bottom nav/footers must be theme-aware:
  - Light: `bg-white`/`bg-gray-50` + `border-gray-200`
  - Dark: keep existing `bg-[#111111]`/`bg-[#121212]` + `border-gray-800`

### Guardrails

- **Avoid structural changes**: do not change roundedness (e.g. `rounded-md` → `rounded-full`), spacing, or layout for light mode.
- **Prefer neutrals**: light mode should feel premium/minimal—use whites and grays with small, purposeful color accents only.
