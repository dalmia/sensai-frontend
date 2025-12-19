# Frontend Guidelines

These guidelines are based on actual issues encountered during development. Following these will help avoid common pitfalls in frontend implementation.

## ContentEditable Elements

### Avoid React-Controlled ContentEditable Elements

- **CRITICAL**: Never render a contentEditable element with React state as its content (`<div contentEditable>{stateValue}</div>`)
- This causes the cursor to reset position on every keystroke
- Instead, initialize the content once via DOM manipulation and track changes via events
- Use `element.textContent = initialValue` in useEffect rather than rendering the value directly

### Proper Focus Management

- When focusing contentEditable elements, always position the cursor at the end of the text
- Use Range and Selection APIs to set cursor position correctly
- Remember to handle both the initial focus and subsequent focus events

### ContentEditable Reference Handling

- For multiple contentEditable elements (like in lists), store IDs rather than direct DOM references
- Use data attributes (e.g., `data-module-id`) to identify elements
- Query for elements using these attributes when needed for focus or content manipulation

## State Management

### Isolated State for Editable Elements

- Each editable element should have its own isolated state management
- Prevent state updates in one element from affecting others
- Be especially careful with refs in dynamic lists of editable elements

### Proper Update Patterns

- When updating nested state (like items within modules), ensure you're creating new object references
- Use proper immutable update patterns to avoid unintended side effects
- Always test state updates with multiple items to ensure isolation

## Implementation Planning

### Consider Interaction Patterns

- Think through how users will interact with multiple related elements
- Plan for focus management between elements
- Consider edge cases like rapid typing, deletion, and navigation between fields

### Apply Successful Patterns Consistently

- When you solve a problem in one part of the application, apply the same solution pattern to similar problems
- The course title editing solution should have been applied to module titles as well
- Maintain consistency in how you handle similar UI elements

## Testing Considerations

### Test Dynamic Editing Behavior

- Mentally step through editing workflows, especially with multiple editable elements
- Test cursor behavior during typing, not just the initial and final states
- Verify that focus remains in the correct element during editing

### Test List Operations

- Verify that adding, removing, and reordering items maintains proper state
- Ensure that operations on one item don't affect others
- Test focus management when adding new items to lists

## DOM and React Integration

### Understand React Rendering Lifecycle

- Be aware of how React's rendering cycle interacts with browser-native behaviors
- ContentEditable elements, focus management, and selection are areas where React and DOM can conflict
- Use useEffect with appropriate dependencies to manage DOM operations

### Minimize Direct DOM Manipulation

- When direct DOM manipulation is necessary, isolate it clearly
- Use refs and useEffect to contain imperative code
- Document why direct DOM manipulation is needed for future maintainers
