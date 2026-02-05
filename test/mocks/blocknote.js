// Mock @blocknote modules to avoid ES module issues
const React = require('react');

// Store captured functions for testing
let capturedUploadFile = null;
let capturedResolveFileUrl = null;

// Flag to simulate replaceBlocks error
let shouldReplaceBlocksThrow = false;

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
  replaceBlocks: jest.fn(() => {
    if (shouldReplaceBlocksThrow) {
      throw new Error('Mock replaceBlocks error');
    }
  }),
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

// Helper to set replaceBlocks error mode
const setReplaceBlocksError = (shouldThrow) => {
  shouldReplaceBlocksThrow = shouldThrow;
};

// Helper to get captured functions for testing
const getCapturedFunctions = () => ({
  uploadFile: capturedUploadFile,
  resolveFileUrl: capturedResolveFileUrl,
});

// Reset captured functions
const resetCapturedFunctions = () => {
  capturedUploadFile = null;
  capturedResolveFileUrl = null;
};

// Mock defaultProps used by custom blocks
const defaultProps = {
  textAlignment: { default: 'left' },
  backgroundColor: { default: 'default' },
};

// Mock createReactBlockSpec for custom block creation
const createReactBlockSpec = (config, options) => {
  return () => ({
    type: config.type,
    propSchema: config.propSchema,
    content: config.content,
    render: options?.render,
  });
};

module.exports = {
  useCreateBlockNote: jest.fn((options) => {
    // Capture the functions for testing
    if (options?.uploadFile) {
      capturedUploadFile = options.uploadFile;
    }
    if (options?.resolveFileUrl) {
      capturedResolveFileUrl = options.resolveFileUrl;
    }
    return createMockEditor();
  }),
  getCapturedFunctions,
  resetCapturedFunctions,
  setReplaceBlocksError,
  defaultProps,
  createReactBlockSpec,
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
  defaultInlineContentSpecs: {},
  defaultStyleSpecs: {},
  locales: {
    en: {
      placeholders: {
        emptyDocument: 'Start typing...'
      }
    }
  }
}; 