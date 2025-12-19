# Themes & Design Guidelines

## Dark/Light Mode Implementation

### How Theme Switching Works

The app uses Tailwind's class-based dark mode with CSS variables:

1. **The `.dark` class is applied to `<html>`** by `useThemePreference` hook
2. **CSS variables** in `globals.css` define colors for `:root` (light) and `.dark` (dark)
3. **Tailwind's `dark:` prefix** enables automatic theme switching in components

### Tailwind v4 Configuration (CRITICAL)

This project uses **Tailwind v4**, which requires a different dark mode setup than v3:

```css
/* In globals.css - REQUIRED for class-based dark mode in Tailwind v4 */
@custom-variant dark (&:where(.dark, .dark *));
```

**DO NOT** use `darkMode: ["class"]` in `tailwind.config.js` - this is the Tailwind v3 approach and won't work in v4.

### Theme Source of Truth

- **Default**: Dark mode is the default
- **Storage**: `localStorage.getItem('theme')` stores `'dark'`, `'light'`, or `'device'`
- **Hook**: `useThemePreference()` manages theme state and applies the `.dark` class to `document.documentElement`

### How to Style Components (Preferred Approach)

**Use Tailwind's `dark:` prefix** - components automatically respond to theme changes:

```tsx
// ✅ PREFERRED: Uses dark: variants - instant theme switching, no reload needed
<div className="bg-white dark:bg-black text-black dark:text-white">

// ✅ ALSO GOOD: Uses CSS variables that auto-switch
<div className="bg-background text-foreground">
```

**Avoid prop drilling `isDarkMode`** except when necessary:

```tsx
// ❌ AVOID: Prop drilling and ternary conditionals
// This causes theme changes to require page reloads!
<div className={`${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
```

### Why `isDarkMode` Conditionals Cause Problems

**The State Synchronization Issue:**

When you use `isDarkMode` from `useThemePreference()` for conditional styling:

1. User clicks theme toggle
2. Hook calls `applyDarkClass()` which adds/removes `.dark` class on `<html>`
3. Hook calls `setIsDarkMode()` to update React state
4. **Problem**: CSS responds instantly to `.dark` class, but React components wait for state update
5. **Result**: Visual mismatch or need for page reload

**The Solution**: Use `dark:` variants which respond directly to the CSS class, bypassing React state entirely.

### When to Use `isDarkMode` Prop

Only pass `isDarkMode` to components that truly need it:

1. **Third-party libraries** that require a theme prop (BlockNote editor, Monaco editor)
2. **Dynamic color calculations in JavaScript** (see MutationObserver pattern below)
3. **Complex conditional logic** that CSS alone cannot handle

### JavaScript Color Calculations (MutationObserver Pattern)

When you need to compute colors in JavaScript based on theme (e.g., for canvas, dynamic backgrounds):

```tsx
// ❌ WRONG: Using hook state - can be out of sync with DOM
const { isDarkMode } = useThemePreference();
const bgColor = isDarkMode ? "#000" : "#fff"; // May not update correctly!

// ✅ CORRECT: Watch DOM directly with MutationObserver
const [isDarkModeDOM, setIsDarkModeDOM] = useState(true);

useEffect(() => {
  const checkDarkMode = () => {
    setIsDarkModeDOM(document.documentElement.classList.contains("dark"));
  };

  checkDarkMode();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "class") {
        checkDarkMode();
      }
    });
  });

  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}, []);

// Now use isDarkModeDOM for color calculations
const bgColor = isDarkModeDOM ? "#000" : "#fff";
```

### CSS Override Issues (globals.css)

**CRITICAL**: The `globals.css` file may contain `!important` rules that override Tailwind classes:

```css
/* Example problematic rules in globals.css */
.dark .bg-gray-200 {
  background-color: #1a1a1a !important;
}
.dark .text-black {
  color: #ffffff !important;
}
```

**Workaround**: Use arbitrary hex values to bypass these overrides:

```tsx
// ❌ May be overridden by globals.css !important rules
<div className="bg-gray-200 dark:bg-gray-800">

// ✅ Arbitrary values bypass !important overrides
<div className="bg-[#e5e7eb] dark:bg-[#222222]">
```

### Recommended Class Patterns

| Element              | Classes                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| **Page wrapper**     | `bg-white dark:bg-black text-black dark:text-white`                                          |
| **Card / panel**     | `bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#222222]`                    |
| **Content panel**    | `bg-gray-50 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#222222]`                         |
| **Input**            | `bg-white dark:bg-[#161925] border-gray-300 dark:border-gray-800 text-black dark:text-white` |
| **Chips / pills**    | `bg-gray-100 dark:bg-[#222222] text-gray-700 dark:text-white`                                |
| **Primary button**   | `bg-purple-600 dark:bg-white text-white dark:text-black`                                     |
| **Cancel/secondary** | `text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white`                    |
| **Spinner**          | `border-black dark:border-white`                                                             |

### Logo Switching Pattern

For images that need different sources per theme:

```tsx
<Image src="/images/logo-light.svg" className="dark:hidden" />
<Image src="/images/logo-dark.svg" className="hidden dark:block" />
```

### CSS Variables Available

These are defined in `globals.css` and switch automatically:

- `--background` / `--foreground` (main page colors)
- `--primary` / `--primary-foreground`
- `--secondary` / `--secondary-foreground`
- `--muted` / `--muted-foreground`
- `--accent` / `--accent-foreground`
- `--border`, `--input`, `--ring`
- `--card` / `--card-foreground`
- `--popover` / `--popover-foreground`
- `--destructive` / `--destructive-foreground`

Use them via Tailwind: `bg-background`, `text-foreground`, `border-border`, etc.

---

## Migration Guide: `isDarkMode` to `dark:` Variants

### Step-by-Step Refactoring

1. **Identify conditionals**: Search for `isDarkMode ?` in the component

2. **Convert each conditional**:

   ```tsx
   // Before
   className={isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}

   // After
   className="bg-white dark:bg-black text-black dark:text-white"
   ```

3. **Handle complex conditionals** (multiple conditions):

   ```tsx
   // Before
   className={`${isActive
     ? isDarkMode ? 'bg-green-900' : 'bg-green-100'
     : isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}

   // After - use string concatenation
   className={`${isActive
     ? 'bg-green-100 dark:bg-green-900'
     : 'bg-gray-100 dark:bg-gray-800'}`}
   ```

4. **Remove unused `isDarkMode` prop/import** after converting all usages

5. **Keep `isDarkMode` only for**:
   - Third-party library props (BlockNote, Monaco)
   - JavaScript color calculations (use MutationObserver pattern)

### Refactoring Checklist

- [ ] Convert all `isDarkMode ?` conditionals to `dark:` variants
- [ ] Remove `isDarkMode` prop from component interface (if no longer needed)
- [ ] Remove `isDarkMode` from parent component prop passing
- [ ] Update any child components that received the prop
- [ ] Test theme switching without page reload
- [ ] Verify both themes match original visual appearance

---

## Common Pitfalls & Solutions

### Pitfall 1: Theme Change Requires Page Reload

**Symptom**: Clicking theme toggle doesn't update component until page refresh

**Cause**: Using `isDarkMode` conditionals for styling

**Solution**: Convert to `dark:` variants

### Pitfall 2: Light Mode Colors Showing in Dark Mode

**Symptom**: Vibrant light-mode colors appear even when page is in dark mode

**Cause**: JavaScript color calculation using stale `isDarkMode` state

**Solution**: Use MutationObserver to watch `.dark` class on `<html>` element

### Pitfall 3: `dark:` Classes Not Working

**Symptom**: `dark:bg-gray-800` has no effect

**Possible Causes**:

1. Missing `@custom-variant dark` in globals.css (Tailwind v4)
2. `!important` overrides in globals.css
3. Parent element missing dark class propagation

**Solutions**:

1. Add `@custom-variant dark (&:where(.dark, .dark *));` to globals.css
2. Use arbitrary values: `dark:bg-[#1f2937]` instead of `dark:bg-gray-800`
3. Ensure `.dark` class is on `<html>` element

---

## Additional Learnings (from a real debugging session)

These are the “gotchas” that actually caused issues during implementation, and what to do next time.

### 1) Dark styles “not applying” is often **specificity/order**, not Tailwind

**Symptom**: In DevTools you see `class="bg-gray-200 dark:bg-[#1A1A1A]"` but the element still looks like `bg-gray-200` in dark mode. When you remove the light class, the dark color appears.

**Common Causes**:

- A global stylesheet (often `globals.css` or a component-level `style jsx global`) has `!important` rules that override Tailwind utilities.
- Component CSS-in-JS injects styles later than Tailwind, winning the cascade.
- In Tailwind v4, dark-mode support depends on the `@custom-variant dark ...` rule; if it’s missing/mis-scoped, `dark:` classes may not generate or may not match.

**Debug Checklist**:

- Inspect the element → check the “Styles” panel and confirm which rule is winning.
- Search for `!important` overrides (especially anything targeting `.dark .bg-*`, `.bg-*`, or element selectors).
- Confirm `.dark` is on `<html>` (not a nested wrapper), since the app’s convention relies on that.

**Pragmatic Fixes (minimal impact)**:

- Prefer arbitrary values (`bg-[#...]`) to bypass broad overrides.
- If there’s an override you can’t easily remove safely, use Tailwind important variants:
  - `dark:!bg-[#...]`, `dark:hover:!bg-[#...]`
  - Use this sparingly and only where needed (it’s a “break glass” tool).

### 2) Avoid “theme state” for CSS when `dark:` can do it

**Symptom**: Theme toggle updates some areas, but others need reload or look mismatched.

**Cause**: Styling is driven by `isDarkMode` state/props (ternaries) in some parts, while other parts rely on `.dark` + Tailwind `dark:`. They can get out of sync.

**Rule**: For static styling, use `dark:` utilities only. Avoid `isDarkMode ? ... : ...` for class names.

### 3) Third‑party libraries: keep `isDarkMode`, but don’t let it leak into layout styling

Some libraries require a theme prop:

- Monaco (`@monaco-editor/react`): `theme="vs-dark" | "vs"`
- Notion renderer (`RenderConfig theme="dark" | "light"`)
- BlockNote editor (theme prop)

**Best practice**:

- Get `isDarkMode` locally (from `useThemePreference()`) inside the component that owns the library.
- Keep surrounding layout/panels styled via `dark:` so they react instantly to `.dark`.

### 4) Fast Refresh / Hot Reload can break Monaco unless you remount safely

**Symptom**: After a code change + hot reload, Monaco throws runtime errors (e.g. `Cannot read properties of undefined (reading 'domNode')`), but a full refresh fixes it.

**Why**: Monaco schedules internal renders/layout; Fast Refresh can replace DOM nodes while Monaco still holds references.

**Minimal dev-only mitigation**:

- Force `<Editor />` remount on refresh using a `key` that changes in dev.
- Dispose editor instance on cleanup (`editor.dispose()`), best effort.

**Note**: Keep this dev-only when possible to avoid changing prod behavior.

### 5) Avoid accidental “double containers” (especially for code/audio blocks)

**Symptom**: A code block or audio player looks like it has a weird extra bubble/padding/background.

**Cause**: The chat bubble container adds padding/background, and the inner component (code/audio) also has its own container styling → double UI chrome.

**Fix pattern**:

- Make the outer bubble transparent / minimal for those message types.
- Let the inner component own its visual container.

### 6) Keep changes strictly scoped to the user request

**Lesson**: When the task is “fix styling X,” avoid refactors (prop drilling, theme architecture changes, etc.). If a broader cause exists, apply the smallest change that resolves the symptom first (then optionally propose deeper cleanup separately).

### Pitfall 4: Hydration Mismatch

**Symptom**: Flash of wrong theme on page load, console hydration warnings

**Cause**: Server renders with different theme than client

**Solution**: The `useThemePreference` hook handles this - ensure `hasHydrated` state is used if needed for conditional rendering

---

## Design Principles

### Minimalism

- Embrace whitespace as a design element
- Include only what is absolutely necessary
- Remove all decorative elements that don't serve a functional purpose
- When in doubt, remove rather than add
- **CRITICAL**: Never add explanatory text boxes, hints, or guidance elements unless explicitly requested

### Premium Aesthetics

- Use high contrast elements (black on white, white on black)
- Employ clean typography with proper spacing
- Prefer rounded shapes for interactive elements
- Maintain consistent spacing and alignment
- **CRITICAL**: Font weight must be light (font-light) for headings, never bold unless specified

### Inspiration

- Follow design patterns from premium products like Notion and Spotify
- Prioritize clean, uncluttered interfaces
- Use subtle animations and transitions
- Avoid flashy or game-like elements

---

## UI Components

### Buttons

- Use rounded buttons (rounded-full for primary actions)
- Keep button text concise and action-oriented
- All buttons should have `cursor-pointer`
- Implement subtle hover states (opacity changes preferred)
- Include proper focus states for accessibility
- Avoid excessive shadows or 3D effects

### Typography

- Use a clean, modern sans-serif font
- Maintain a clear hierarchy with limited font sizes
- **CRITICAL**: Always use lighter font weights (font-light) for larger text and headings
- Ensure sufficient contrast between text and background
- Never use bold fonts for headings unless explicitly requested

### Colors

- Primary Palette: Use black, white, and shades of gray as the foundation
- Use color purposefully—for highlights, interactions, feedback, and visual hierarchy
- Maintain proper contrast ratios for accessibility
- **CRITICAL**: Never add colored information boxes or colored backgrounds for sections

### Layout

- Center important actions
- Use a clean grid system
- Maintain consistent spacing
- Allow for proper breathing room around elements
- **CRITICAL**: Avoid nested containers or unnecessary grouping divs

---

## Theme-Specific Color Semantics

### Shared Across Themes

- **Completed**: Emerald accents (`text-emerald-600`, `border-emerald-400`)
- **In-progress**: Amber accents (`text-amber-600`, `border-amber-400`)
- **Learning material**: Rose-based cues (`bg-rose-50 dark:bg-rose-900/20`, `text-rose-600 dark:text-rose-400`)
- **Quiz**: Indigo-based cues (`bg-indigo-50 dark:bg-indigo-900/20`, `text-indigo-700 dark:text-indigo-400`)

### Light Mode Specifics

- Backgrounds: white / very-light gray (`bg-white`, `bg-gray-50`)
- Text: readable dark text (`text-gray-900`) with muted secondary (`text-gray-600`)
- Borders: light borders (`border-gray-200`, `border-gray-300`)
- Elevation: prefer borders over shadows

### Dark Mode Specifics

- Backgrounds: black / dark gray (`bg-black`, `bg-[#111111]`, `bg-[#1A1A1A]`)
- Text: white with muted secondary (`text-white`, `text-gray-400`)
- Borders: dark borders (`border-[#222222]`, `border-gray-800`)

---

## Non-Negotiables

- **Structure parity**: spacing, layout, padding, margins, borders, rounded corners must be identical across themes
- **Interaction parity**: all click targets, disabled states, progress logic must be identical
- **No "new UI"**: do not add extra hints, help boxes, or decorative containers for either theme
- **Avoid structural changes**: do not change roundedness, spacing, or layout based on theme
- **Prefer neutrals**: both themes should feel premium/minimal with small, purposeful color accents

---

## What to Avoid

### Excessive Elements

- Multiple containers or nested boxes
- Decorative icons or graphics that don't serve a purpose
- Headers or text that isn't absolutely necessary
- Borders or dividers unless needed for clarity
- **CRITICAL**: Explanatory boxes, hints, or guidance text that wasn't requested

### Visual Noise

- Gradients or complex backgrounds
- Multiple colors or color variations
- Shadows or 3D effects
- Animations that distract rather than guide
- **CRITICAL**: Colored backgrounds for content sections

### Complexity

- Nested or complex layouts
- Multiple interactive elements when one would suffice
- Unnecessary information or options
- Anything that distracts from the primary action
- **CRITICAL**: Never add "helpful" UI elements that weren't explicitly requested

---

## Quick Reference: Decision Tree

```
Need to style based on theme?
│
├─ Is it static CSS styling?
│  └─ YES → Use `dark:` variants ✅
│
├─ Is it for a third-party library (BlockNote, Monaco)?
│  └─ YES → Pass `isDarkMode` from useThemePreference() ✅
│
├─ Is it a JavaScript color calculation?
│  └─ YES → Use MutationObserver pattern to watch .dark class ✅
│
├─ Is it an image that changes per theme?
│  └─ YES → Use `dark:hidden` / `hidden dark:block` pattern ✅
│
└─ None of the above?
   └─ Default to `dark:` variants ✅
```
