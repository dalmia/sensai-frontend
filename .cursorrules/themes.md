# Themes & Design Guidelines

## Dark/Light Mode Implementation

### How Theme Switching Works

The app uses Tailwind's class-based dark mode with CSS variables:

1. **The `.dark` class is applied to `<html>`** by `useThemePreference` hook
2. **CSS variables** in `globals.css` define colors for `:root` (light) and `.dark` (dark)
3. **Tailwind's `dark:` prefix** enables automatic theme switching in components

### Theme Source of Truth

- **Default**: Dark mode is the default
- **Storage**: `localStorage.getItem('theme')` stores `'dark'`, `'light'`, or `'device'`
- **Hook**: `useThemePreference()` manages theme state and applies the `.dark` class to `document.documentElement`

### How to Style Components (Preferred Approach)

**Use Tailwind's `dark:` prefix** - components automatically respond to theme changes:

```tsx
// ✅ PREFERRED: Uses dark: variants
<div className="bg-white dark:bg-black text-black dark:text-white">

// ✅ ALSO GOOD: Uses CSS variables that auto-switch
<div className="bg-background text-foreground">
```

**Avoid prop drilling `isDarkMode`** except when necessary:

```tsx
// ❌ AVOID: Prop drilling and ternary conditionals
<div className={`${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
```

### When to Use `isDarkMode` Prop

Only pass `isDarkMode` to components that truly need it:

1. **Third-party libraries** that require a theme prop (BlockNote editor, Monaco editor)
2. **Dynamic image sources** (e.g., logo switching between light/dark versions)
3. **Complex conditional logic** that CSS alone cannot handle

### Recommended Class Patterns

| Element | Classes |
|---------|---------|
| **Page wrapper** | `bg-white dark:bg-black text-black dark:text-white` |
| **Card / panel** | `bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#222222]` |
| **Content panel** | `bg-gray-50 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#222222]` |
| **Input** | `bg-white dark:bg-[#161925] border-gray-300 dark:border-gray-800 text-black dark:text-white` |
| **Chips / pills** | `bg-gray-100 dark:bg-[#222222] text-gray-700 dark:text-white` |
| **Primary button** | `bg-purple-600 dark:bg-white text-white dark:text-black` |
| **Cancel/secondary** | `text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white` |
| **Spinner** | `border-black dark:border-white` |

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

