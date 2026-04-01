// Mock @blocknote modules to avoid ES module issues
const React = require('react');

// Create a comprehensive mock editor
const createMockEditor = () => ({
  document: [],
  onEditorContentChange: jest.fn((callback) => {
    // Store the callback for later use
    if (callback) {
      // Simulate calling the callback with mock data
      setTimeout(() => callback({ content: 'mock content' }), 0);
    }
    return { dispose: jest.fn() };
  }),
  getJSON: jest.fn(() => [{ id: 'test-block', type: 'paragraph', content: 'Test content' }]),
  insertBlocks: jest.fn(),
  replaceBlocks: jest.fn(),
  focus: jest.fn(),
  domElement: typeof document !== 'undefined' ? document.createElement('div') : null,
  activeEditor: {
    chain: jest.fn().mockReturnThis(),
    focus: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnThis()
  },
  mount: jest.fn(),
  unmount: jest.fn(),
  destroy: jest.fn(),
  schema: {},
});

module.exports = {
  useCreateBlockNote: jest.fn(() => createMockEditor()),
  BlockNoteView: React.forwardRef((props, ref) => {
    // Calculate the combined className
    const classes = [];
    if (props.className) {
      classes.push(props.className);
    }
    
    // Create attributes object
    const attributes = {
      'data-testid': 'mock-blocknote-view',
      ref,
      theme: props.theme,
      ...props
    };
    
    // Handle editable prop - convert boolean to string, only include if defined
    if (props.hasOwnProperty('editable')) {
      attributes.editable = props.editable.toString();
    }
    
    // Handle className - only include if we have classes
    if (classes.length > 0) {
      attributes.className = classes.join(' ');
    }
    
    return React.createElement('div', attributes);
  }),
  BlockNoteEditor: React.forwardRef((props, ref) => 
    React.createElement('div', { 
      'data-testid': 'mock-blocknote-editor',
      ref,
      ...props 
    })
  ),
  Block: {},
  BlockSchema: {
    create: jest.fn(() => ({}))
  },
  InlineContent: {},
  StyleSchema: {},
  BlockNoteSchema: {
    create: jest.fn(() => ({}))
  },
  defaultBlockSpecs: {
    paragraph: { type: 'paragraph' },
    heading: { type: 'heading' },
    bulletListItem: { type: 'bulletListItem' },
    numberedListItem: { type: 'numberedListItem' },
    image: { type: 'image' },
    video: { type: 'video' },
    audio: { type: 'audio' },
    table: { type: 'table' },
    file: { type: 'file' }
  },
  defaultProps: {
    textAlignment: { default: 'left', values: ['left', 'center', 'right', 'justify'] },
    backgroundColor: { default: 'default' },
  },
  defaultInlineContentSpecs: {},
  defaultStyleSpecs: {},
  locales: {
    en: {
      placeholders: {
        emptyDocument: 'Start typing...'
      }
    }
  },
  createReactBlockSpec: jest.fn(() => jest.fn(() => ({}))),
  filterSuggestionItems: jest.fn((items) => items),
  insertOrUpdateBlockForSlashMenu: jest.fn(),
  getDefaultReactSlashMenuItems: jest.fn(() => []),
  SuggestionMenuController: React.forwardRef((props, ref) =>
    React.createElement('div', { 'data-testid': 'mock-suggestion-menu', ref })
  ),
};