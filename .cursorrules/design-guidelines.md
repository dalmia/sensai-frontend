# Design Guidelines

## Core Principles

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

## UI Components

### Buttons

- Use rounded buttons (rounded-full for primary actions)
- Keep button text concise and action-oriented
- ALl buttons should have cursor-pointer.
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

- Primary Palette: Use black, white, and shades of gray as the foundation. Use color purposefully—for highlights, interactions, feedback, and visual hierarchy. Any additional color should feel cohesive with the minimal, dark aesthetic of the app.
- Maintain proper contrast ratios for accessibility
- Implement proper dark mode inversions
- **CRITICAL**: Never add colored information boxes or colored backgrounds for sections

### Layout

- Center important actions
- Use a clean grid system
- Maintain consistent spacing
- Allow for proper breathing room around elements
- **CRITICAL**: Avoid nested containers or unnecessary grouping divs

## Interaction Design

### Feedback

- Provide subtle visual feedback on interaction
- Use opacity or slight color changes for hover states
- Implement smooth, subtle transitions
- Avoid flashy animations or effects

### Accessibility

- Include proper focus indicators
- Ensure sufficient color contrast
- Make interactive elements appropriately sized
- Support keyboard navigation

## Implementation Guidelines

### Following Requirements

- **CRITICAL**: Implement ONLY what is explicitly requested by the user
- Never add "helpful" UI elements that weren't requested
- When in doubt about a feature, ask rather than implement
- Do not add explanatory text, tooltips, or guidance unless specifically requested

### What to Avoid

#### Excessive Elements

- Multiple containers or nested boxes
- Decorative icons or graphics that don't serve a purpose
- Headers or text that isn't absolutely necessary
- Borders or dividers unless needed for clarity
- **CRITICAL**: Explanatory boxes, hints, or guidance text that wasn't requested

#### Visual Noise

- Gradients or complex backgrounds
- Multiple colors or color variations
- Shadows or 3D effects
- Animations that distract rather than guide
- **CRITICAL**: Colored backgrounds for content sections

#### Complexity

- Nested or complex layouts
- Multiple interactive elements when one would suffice
- Unnecessary information or options
- Anything that distracts from the primary action
- **CRITICAL**: Never add "helpful" UI elements that weren't explicitly requested
