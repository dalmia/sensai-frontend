import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable, IKeyboardEvent } from 'monaco-editor';
import { Play, Send, Terminal, ArrowLeft, X } from 'lucide-react';
import Toast from './Toast';

interface CodeEditorViewProps {
    initialCode?: Record<string, string>;
    languages?: string[];
    handleCodeSubmit: (code: Record<string, string>) => void;
    onCodeRun?: (previewContent: string, output: string, executionTime?: string, isRunning?: boolean) => void;
    disableCopyPaste?: boolean;
    onCodeChange?: (code: Record<string, string>) => void;
    isDarkMode?: boolean;
}

// Add interface for the ref methods
export interface CodeEditorViewHandle {
    getCurrentCode: () => Record<string, string>;
}

// Preview component that can be used in a separate column
export interface CodePreviewProps {
    isRunning: boolean;
    previewContent: string;
    output: string;
    isWebPreview: boolean;
    executionTime?: string;
    onClear?: () => void;
    onBack?: () => void;
    isMobileView?: boolean;
    isDarkMode?: boolean;
}

export const CodePreview: React.FC<CodePreviewProps> = ({
    isRunning,
    previewContent,
    output,
    isWebPreview,
    executionTime,
    onClear,
    onBack,
    isMobileView = false,
    isDarkMode = true,
}) => {
    const [isIframeLoading, setIsIframeLoading] = useState(true);

    // Reset loading state when new content is provided
    useEffect(() => {
        if (previewContent) {
            setIsIframeLoading(true);
        }
    }, [previewContent]);

    // Format console output with syntax highlighting
    const formatConsoleOutput = (text: string) => {
        if (!text) return 'Run your code to see output here';

        // Replace [ERROR], [WARN], and [INFO] tags with styled spans
        return text
            .replace(/\[ERROR\]/g, '<span class="text-red-500 font-bold">[ERROR]</span>')
            .replace(/\[WARN\]/g, '<span class="text-yellow-500 font-bold">[WARN]</span>')
            .replace(/\[INFO\]/g, '<span class="text-blue-500 font-bold">[INFO]</span>')
            .replace(/---.*?---/g, '<span class="text-gray-400">$&</span>')
            .replace(/→ Return value:/g, '<span class="text-green-500 font-semibold">→ Return value:</span>')
            .replace(/(Error:[\s\S]*?)(?=\n\n|$)/g, '<span class="text-red-500">$1</span>')
            .replace(/(Compilation Error:[\s\S]*?)(?=\n\n|$)/g, '<span class="text-red-500">$1</span>');
    };

    // Create a modified HTML content with a loading indicator
    const enhancedPreviewContent = isWebPreview && previewContent ? `
        ${previewContent.replace(
        '</body>',
        `
            <style>
                #iframe-loading-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: #1a1a1a;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    transition: opacity 0.3s ease-out;
                }
                #iframe-loading-indicator.hidden {
                    opacity: 0;
                    pointer-events: none;
                }
                .iframe-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #2a2a2a;
                    border-top: 4px solid #a0a0a0;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
            <div id="iframe-loading-indicator">
                <div class="iframe-spinner"></div>
            </div>
            <script>
                // Hide the loading indicator when the page is fully loaded
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        document.getElementById('iframe-loading-indicator').classList.add('hidden');
                    }, 500); // Small delay to ensure everything is rendered
                });
            </script>
            </body>
            `
    )}
    ` : previewContent;

    return (
        <div
            className={`flex-1 flex flex-col overflow-hidden h-full ${isMobileView ? 'mobile-preview-container' : ''} ${isDarkMode ? 'bg-[#111111] text-white' : 'bg-white text-slate-900'}`}
        >
            <div className={`px-4 font-medium flex justify-between items-center ${isDarkMode ? 'bg-[#222222] text-white' : 'bg-gray-100 text-gray-900 border-b border-gray-200'}`}>
                <div className="flex items-center">
                    <span className="text-sm py-2">{isWebPreview ? 'Preview' : 'Output'}</span>
                </div>
                <div className="items-center gap-2 flex">
                    {(!isWebPreview && output && onClear) && (
                        <button
                            onClick={onClear}
                            className={`hidden md:block text-sm px-2 py-1 rounded transition-colors cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#333333]' : 'text-gray-600 hover:text-black hover:bg-gray-200'}`}
                            aria-label="Clear output"
                        >
                            Clear
                        </button>
                    )}
                    {isMobileView && onBack && (
                        <button
                            onClick={onBack}
                            className={`text-sm p-1 rounded transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#333333]' : 'text-gray-600 hover:text-black hover:bg-gray-200'}`}
                            aria-label="Close preview"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                {isRunning ? (
                    <div className="flex items-center justify-center h-full">
                        <div className={`animate-spin rounded-full h-6 w-6 border-t-2 border-t-transparent ${isDarkMode ? 'border-white' : 'border-slate-900'}`}></div>
                    </div>
                ) : !previewContent && !output ? (
                    <div className={`flex flex-col items-center justify-center h-full preview-placeholder ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 4L18 8M18 8V18M18 8H8M6 20L10 16M10 16H20M10 16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <p>Run your code to see the preview here</p>
                        <p className={`text-xs mt-2 text-center px-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>For HTML/CSS/React, you will see a live preview. For other languages, you will see the console output.</p>
                    </div>
                ) : isWebPreview ? (
                    <div className="relative w-full h-full">
                        {isIframeLoading && (
                            <div className={`absolute inset-0 flex items-center justify-center z-10 ${isDarkMode ? 'bg-[#111111]' : 'bg-white'}`}>
                                <div className={`animate-spin rounded-full h-10 w-10 border-4 ${isDarkMode ? 'border-[#2a2a2a] border-t-[#a0a0a0]' : 'border-[#f3f3f3] border-t-[#3498db]'}`}></div>
                            </div>
                        )}
                        <iframe
                            srcDoc={enhancedPreviewContent}
                            title="Code Preview"
                            className={`w-full h-full ${isDarkMode ? 'bg-white' : 'bg-white'}`}
                            sandbox="allow-scripts"
                            onLoad={() => setIsIframeLoading(false)}
                        />
                    </div>
                ) : (
                    <div className={`p-4 font-mono text-sm terminal-output ${isDarkMode ? 'text-white bg-[#1A1A1A]' : 'text-slate-900 bg-white border-t border-gray-200'}`}>
                        <div
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: formatConsoleOutput(output) }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const DEFAULT_LANGUAGE_CONTENTS = {
    'javascript': 'function changeText() {\n  document.getElementById("greeting").textContent = "Hello from JavaScript!";\n}\n\nconsole.log("Hello, world!");\n',
    'html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n  <h1 id="greeting">Hello, world!</h1>\n  <button onclick="changeText()">Change Text</button>\n</body>\n</html>\n',
    'css': 'body {\n  font-family: sans-serif;\n  margin: 20px;\n}\n\nh1 {\n  color: navy;\n}\n',
    'react': `// === REACT PLAYGROUND GUIDE ===
// 
// This playground runs React 18 directly in the browser using Babel for JSX transformation.
// Here's how to use this editor effectively:
//
// 1. COMPONENT DEFINITION:
//    - Define your components using either function or class syntax
//    - Example: function MyComponent() { return <div>Hello</div>; }
//
// 2. USING HOOKS:
//    - React hooks work normally (useState, useEffect, etc.)
//    - Access them directly from the React object (React.useState)
//
// 3. RENDERING TO DOM:
//    - IMPORTANT: Always render your main component to the "root" div
//    - Use React 18's createRoot API as shown below
// 
// 4. LIMITATIONS:
//    - No npm imports (use only built-in React functionality)
//    - Libraries like React Router won't work here
//    - For CSS, add inline styles or use the CSS tab
//
// The example below demonstrates a basic counter component:
// ======

// Define your main component
function App() {
  // Use React hooks just like in a normal React app
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ fontFamily: "sans-serif", textAlign: "center", marginTop: "50px" }}>
      <h1>Hello from React!</h1>
      <p>You clicked the button {count} times</p>
      <button 
        onClick={() => setCount(count + 1)}
        style={{
          padding: "8px 16px",
          borderRadius: "4px",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >
        Click me
      </button>
    </div>
  );
}

// REQUIRED: Create a root and render your App component
// This is the React 18 way of rendering components
const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);

// You can add more components above the App component
// Just make sure your final component is rendered to the DOM
`,
    'python': 'print("Hello, world!")\n',
    'java': 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, world!");\n  }\n}\n',
    'c': '#include <stdio.h>\n\nint main() {\n  printf("Hello, world!\\n");\n  return 0;\n}\n',
    'cpp': '#include <iostream>\n\nint main() {\n  std::cout << "Hello, world!" << std::endl;\n  return 0;\n}\n',
    'csharp': 'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, world!");\n  }\n}\n',
    'ruby': 'puts "Hello, world!"\n',
    'typescript': 'const message: string = "Hello, world!";\nconsole.log(message);\n',
    'php': '<?php\necho "Hello, world!";\n?>\n',
    'nodejs': `// Node.js example
// Data processing example
const users = [
  { id: 1, name: 'Alice', age: 28, role: 'developer' },
  { id: 2, name: 'Bob', age: 35, role: 'manager' },
  { id: 3, name: 'Charlie', age: 24, role: 'designer' },
  { id: 4, name: 'Diana', age: 31, role: 'developer' },
  { id: 5, name: 'Evan', age: 40, role: 'admin' }
];

// Filter developers
const developers = users.filter(user => user.role === 'developer');
console.log('Developers in the team:');
developers.forEach(dev => console.log(\` - \${dev.name}, \${dev.age} years old\`));

// Calculate average age
const totalAge = users.reduce((sum, user) => sum + user.age, 0);
const averageAge = totalAge / users.length;
console.log(\`\nAverage team age: \${averageAge.toFixed(1)} years\`);

// Find oldest team member
const oldest = users.reduce((oldest, user) => user.age > oldest.age ? user : oldest, users[0]);
console.log(\`Oldest team member: \${oldest.name} (\${oldest.age} years old, \${oldest.role})\`);`,
    'sql': `-- SQL PLAYGROUND GUIDE
-- 
-- This is a SQLite playground that allows you to practice SQL operations
-- Here's how to use this editor effectively:
--
-- === STRUCTURE YOUR SQL CODE IN THIS ORDER ===
--
-- 1. CREATE TABLES:
--    - Define your schema with appropriate data types
--    - Set up primary keys and foreign key relationships
--    - Example below creates customers and orders tables
--
-- 2. INSERT DATA:
--    - Populate your tables with sample data
--    - Use INSERT INTO statements with specific values
--    - Ensure foreign key references exist before inserting
--
-- 3. QUERY DATA:
--    - Write SELECT statements to retrieve and analyze your data
--    - Use joins, where clauses, aggregations, etc.
--    - Always test your queries after inserting data
--
-- === EXAMPLE BELOW ===

-- Step 1: Create your tables
CREATE TABLE customers (
    customer_id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
);

CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT,
    amount DECIMAL(10, 2),
    order_date DATE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Step 2: Insert sample data
INSERT INTO customers (customer_id, name, email) VALUES
(1, 'John Doe', 'john@example.com'),
(2, 'Jane Smith', 'jane@example.com'),
(3, 'Bob Johnson', 'bob@example.com'),
(4, 'Alice Brown', 'alice@example.com'),
(5, 'Charlie Davis', 'charlie@example.com');

INSERT INTO orders (order_id, customer_id, amount, order_date) VALUES
(101, 1, 150.50, '2023-01-15'),
(102, 1, 75.25, '2023-02-20'),
(103, 2, 200.00, '2023-01-10'),
(104, 3, 50.75, '2023-03-05'),
(105, 3, 125.30, '2023-03-15'),
(106, 3, 45.80, '2023-04-02'),
(107, 5, 350.00, '2023-02-28');

-- Step 3: Query the data
SELECT 
    customers.customer_id,
    customers.name,
    customers.email,
    COUNT(orders.order_id) AS total_orders,
    SUM(orders.amount) AS total_spent
FROM 
    customers
LEFT JOIN 
    orders ON customers.customer_id = orders.customer_id
GROUP BY 
    customers.customer_id
HAVING 
    COUNT(orders.order_id) > 0
ORDER BY 
    total_spent DESC
LIMIT 10;`
} as Record<string, string>;

// Map language to Monaco editor language identifiers
const LANGUAGE_MAPPING: Record<string, string> = {
    'javascript': 'javascript',
    'js': 'javascript',
    'html': 'html',
    'css': 'css',
    'python': 'python',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'c++': 'cpp',
    'csharp': 'csharp',
    'c#': 'csharp',
    'ruby': 'ruby',
    'typescript': 'typescript',
    'ts': 'typescript',
    'php': 'php',
    'react': 'javascript', // React uses JavaScript syntax with JSX
    'nodejs': 'javascript',
    'sql': 'sql',
};

// Prettier language display names
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
    'javascript': 'JavaScript',
    'html': 'HTML',
    'css': 'CSS',
    'python': 'Python',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'csharp': 'C#',
    'ruby': 'Ruby',
    'typescript': 'TypeScript',
    'php': 'PHP',
    'react': 'React',
};

// Judge0 language IDs - see https://judge0.com/
const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
    'python': 71,      // Python 3.8.1
    'sql': 82,         // SQL (SQLite 3.27.2)
    'javascript': 63,  // JavaScript (Node.js 12.14.0)
    'nodejs': 63,      // Node.js 12.14.0
};

// Judge0 API URL - using environment variables for flexibility
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || '';
// Whether to use proxy approach to avoid CORS issues
const USE_PROXY_API = true;

const CodeEditorView = forwardRef<CodeEditorViewHandle, CodeEditorViewProps>(({
    initialCode = {},
    languages = ['javascript'],
    handleCodeSubmit,
    onCodeRun,
    disableCopyPaste = false,
    onCodeChange,
    isDarkMode = true,
}, ref) => {
    // Check if React is in the original languages array
    const hasReact = languages.some(lang =>
        lang.toLowerCase() === 'react'
    );

    const hasNodejs = languages.some(lang =>
        lang.toLowerCase() === 'nodejs'
    );

    // When only React is selected, don't normalize languages (skip the mapping to JavaScript)
    let normalizedLanguages: string[];

    if (hasReact) {
        // When React is the only language, skip normalization and just use React
        normalizedLanguages = ['react'];
    } else if (hasNodejs) {
        // When Node.js is the only language, skip normalization and just use Node.js
        normalizedLanguages = ['nodejs'];
    } else {
        // Otherwise normalize languages as usual
        normalizedLanguages = languages.map(lang =>
            LANGUAGE_MAPPING[lang.toLowerCase()] || lang.toLowerCase()
        ).filter((lang, index, self) =>
            // Remove duplicates
            self.indexOf(lang) === index &&
            // Ensure we have a default content for this language
            Object.keys(LANGUAGE_MAPPING).includes(lang)
        );
    }

    // Helper method to setup code state with defaults
    const setupCodeState = (initial: Record<string, string>): Record<string, string> => {
        const state: Record<string, string> = {};

        // Add entries for all valid languages
        normalizedLanguages.forEach(lang => {
            state[lang] = initial[lang] || DEFAULT_LANGUAGE_CONTENTS[lang] || '';
        });

        return state;
    };

    // Initialize code state with provided initialCode or defaults
    const [code, setCode] = useState<Record<string, string>>(() => {
        return setupCodeState(initialCode);
    });

    // State for the active language tab
    const [activeLanguage, setActiveLanguage] = useState<string>(normalizedLanguages[0]);

    // Preview state
    const [previewContent, setPreviewContent] = useState<string>('');
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [output, setOutput] = useState<string>('');
    const [executionTime, setExecutionTime] = useState<string>('');
    // Input state (for languages that need stdin)
    const [showInputPanel, setShowInputPanel] = useState<boolean>(false);
    const [stdInput, setStdInput] = useState<string>('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const keydownDisposableRef = useRef<IDisposable | null>(null);

    // Reset active language when languages prop changes
    useEffect(() => {
        if (normalizedLanguages.length > 0) {
            setActiveLanguage(normalizedLanguages[0]);
        }
    }, [languages]);

    // Mobile preview state
    const [showMobilePreview, setShowMobilePreview] = useState<boolean>(false);

    // Check if web preview is available (HTML, CSS)
    const hasWebLanguages = normalizedLanguages.some(lang =>
        ['html', 'css'].includes(lang)
    );

    // Add state for input validation and toast
    const [inputError, setInputError] = useState<boolean>(false);
    const [showToast, setShowToast] = useState<boolean>(false);
    const [toastData, setToastData] = useState<{
        title: string;
        description: string;
        emoji: string;
    }>({
        title: '',
        description: '',
        emoji: '',
    });

    // Check if we're on a mobile device
    const [isMobileView, setIsMobileView] = useState<boolean>(false);

    // Add state to keep track of the last copied code
    const [lastCopiedCode, setLastCopiedCode] = useState<string>('');

    // Effect to detect mobile devices
    useEffect(() => {
        const checkMobileView = () => {
            setIsMobileView(window.innerWidth < 1024);
        };

        // Initial check
        checkMobileView();

        // Listen for window resize events
        window.addEventListener('resize', checkMobileView);

        // Cleanup event listener
        return () => {
            window.removeEventListener('resize', checkMobileView);
        };
    }, []);

    // Auto-close toast after 5 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 5000);

            // Cleanup the timer when component unmounts or showToast changes
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Update code state when initialCode changes
    useEffect(() => {
        setCode(setupCodeState(initialCode));
    }, [initialCode]);

    // Handle code change for the active language
    const handleCodeChange = (value: string | undefined) => {
        if (value !== undefined) {
            setCode(prevCode => {
                const nextCode = {
                    ...prevCode,
                    [activeLanguage]: value
                };
                if (onCodeChange) {
                    onCodeChange(nextCode);
                }
                return nextCode;
            });
        }
    };

    // Handle mobile back button click
    const handleMobileBackClick = () => {
        setShowMobilePreview(false);

        // Notify parent that preview was closed
        if (onCodeRun) {
            // Signal that the preview is closed with empty content
            // This doesn't clear the actual content but just signals UI state change
            onCodeRun(
                '',
                output,
                executionTime,
                false
            );
        }
    };

    // Function to count the number of input() calls in Python code
    const countPythonInputs = (code: string): number => {
        // Match different variations of input calls
        // This regex matches:
        // 1. Standard input() calls
        // 2. input("prompt") with any string prompt
        // 3. Assigned input() calls like x = input()
        // 4. Complex variations like x = int(input())

        // Remove comments first
        const codeWithoutComments = code.replace(/#.*$/gm, '');

        // Look for different input patterns
        const patterns = [
            /\binput\s*\([^)]*\)/g,               // Standard input() or input("prompt")
        ];

        // Count all occurrences of input calls
        let totalInputCalls = 0;

        patterns.forEach(pattern => {
            const matches = codeWithoutComments.match(pattern);
            if (matches) {
                // Count all occurrences, not just unique ones
                totalInputCalls += matches.length;
            }
        });

        return totalInputCalls;
    };

    // Function to count the number of provided inputs
    const countProvidedInputs = (input: string): number => {
        if (!input) return 0;
        // Count all lines
        return input.split('\n').length;
    };

    // Handle code run with input validation
    const handleCodeRun = () => {
        setInputError(false); // Reset input error state

        // Check for Python input validation
        if (activeLanguage === 'python') {
            const requiredInputs = countPythonInputs(code['python']);

            if (requiredInputs > 0) {
                const providedInputs = countProvidedInputs(stdInput);

                // If inputs are required but input panel is not open, show it
                if (!showInputPanel) {
                    setShowInputPanel(true);
                    setInputError(true); // Add error state when automatically opening input panel
                    setToastData({
                        title: 'Input Required',
                        description: `Your code requires ${requiredInputs} input${requiredInputs > 1 ? 's' : ''}. Please provide ${requiredInputs > 1 ? 'them' : 'it'} in the input panel.`,
                        emoji: '⌨️',
                    });
                    setShowToast(true);
                    return; // Don't run code yet
                }

                // If insufficient inputs, show error
                if (providedInputs < requiredInputs) {
                    setInputError(true);
                    setToastData({
                        title: 'Insufficient Inputs',
                        description: `Your code requires ${requiredInputs} input${requiredInputs > 1 ? 's' : ''}, but ${providedInputs === 0 ? 'no input was provided' : `only ${providedInputs} ${providedInputs === 1 ? 'input was' : 'inputs were'} provided`}`,
                        emoji: '⚠️',
                    });
                    setShowToast(true);
                    return; // Don't run code with insufficient inputs
                }
            }
        }

        setIsRunning(true);

        // If on mobile, show the preview
        if (isMobileView) {
            setShowMobilePreview(true);
        }

        try {
            // For React code
            if (activeLanguage === 'react') {
                // Create a basic HTML template with React and ReactDOM loaded from CDN with specific version
                const reactTemplate = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>React Preview</title>
                    <!-- Load React and ReactDOM from CDN with specific version -->
                    <script src="https://unpkg.com/react@18.2.0/umd/react.development.js"></script>
                    <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.development.js"></script>
                    <!-- Load Babel for JSX support -->
                    <script src="https://unpkg.com/@babel/standalone@7.21.4/babel.min.js"></script>
                    ${code['css'] ? `<style>${code['css']}</style>` : ''}
                </head>
                <body>
                    <div id="root"></div>
                    <script type="text/babel">
                    ${code['react']}
                    </script>
                </body>
                </html>`;

                setPreviewContent(reactTemplate);
                setOutput('React preview updated');

                // Notify parent component
                if (onCodeRun) {
                    onCodeRun(reactTemplate, 'React preview updated', undefined, true);
                }

                // Delay setting isRunning to false to give time for the iframe to start loading
                setTimeout(() => {
                    setIsRunning(false);
                    // Update parent again when loading is complete
                    if (onCodeRun) {
                        onCodeRun(reactTemplate, 'React preview updated', undefined, false);
                    }
                }, 300);
            }
            // For web-based languages, create a preview
            else if (hasWebLanguages) {
                // For SQL, we'll handle the preview later in executeWithJudge0
                if (activeLanguage === 'sql') {
                    executeWithJudge0(activeLanguage, code[activeLanguage]);
                } else {
                    // Generate HTML preview with CSS and JavaScript
                    const htmlContent = code['html'] || '';
                    const cssContent = code['css'] ? `<style>${code['css']}</style>` : '';
                    const jsContent = code['javascript'] ? `<script>${code['javascript']}</script>` : '';

                    // Combine all content
                    const fullHtmlContent = htmlContent
                        .replace('</head>', `${cssContent}</head>`)
                        .replace('</body>', `${jsContent}</body>`);

                    setPreviewContent(fullHtmlContent);
                    setOutput('Preview updated');

                    // Notify parent component
                    if (onCodeRun) {
                        onCodeRun(fullHtmlContent, 'Preview updated', undefined, true);
                    }

                    // Delay setting isRunning to false to give time for the iframe to start loading
                    setTimeout(() => {
                        setIsRunning(false);
                        // Update parent again when loading is complete
                        if (onCodeRun) {
                            onCodeRun(fullHtmlContent, 'Preview updated', undefined, false);
                        }
                    }, 300);
                }
            }
            // For non-web languages, execute the code if possible
            else {
                // Send all supported languages to Judge0, including JavaScript and Node.js
                if (Object.keys(JUDGE0_LANGUAGE_IDS).includes(activeLanguage)) {
                    // Notify parent component that code execution is starting
                    if (onCodeRun) {
                        // Pass isRunning=true to indicate execution has started
                        onCodeRun('', 'Executing code...', undefined, true);
                    }
                    executeWithJudge0(activeLanguage, code[activeLanguage]);
                }
                else {
                    // For other languages, show placeholder message
                    const outputMessage = `Code execution for ${LANGUAGE_DISPLAY_NAMES[activeLanguage] || activeLanguage} would happen on a server.`;
                    setOutput(outputMessage);

                    // Notify parent component for other languages
                    if (onCodeRun) {
                        onCodeRun('', outputMessage);
                    }
                    setIsRunning(false);
                }
            }
        } catch (error) {
            const errorMessage = `Error: ${(error as Error).message}`;
            setOutput(errorMessage);
            setExecutionTime(''); // Reset execution time on error

            // Notify parent component
            if (onCodeRun) {
                onCodeRun('', errorMessage, undefined, false);
            }

            // Set isRunning to false in case of an error
            setIsRunning(false);
        }
    };

    // Execute code using Judge0 API
    const executeWithJudge0 = async (language: string, sourceCode: string) => {
        try {
            setIsRunning(true);
            setExecutionTime(''); // Reset execution time when starting new execution

            // If on mobile, show the preview
            if (isMobileView) {
                setShowMobilePreview(true);
            }

            // Check if language is supported by Judge0
            const languageId = JUDGE0_LANGUAGE_IDS[language];
            if (!languageId) {
                throw new Error(`Language '${language}' is not supported for execution`);
            }

            // Prepare request data
            const requestData = {
                source_code: sourceCode,
                language_id: languageId,
                stdin: stdInput,  // Use the input from the input panel
                expected_output: null,
                cpu_time_limit: 2,  // 2 seconds
                cpu_extra_time: 0.5,
                wall_time_limit: 5,
                memory_limit: 128000, // 128MB
                stack_limit: 64000,  // 64MB
                max_processes_and_or_threads: 60,
                enable_per_process_and_thread_time_limit: false,
                enable_per_process_and_thread_memory_limit: false,
                compiler_options: '',
                command_line_arguments: '',
            };

            let token;

            // Step 1: Create a submission (using proxy if needed)
            // Using Next.js API route to proxy the request and avoid CORS issues
            const createResponse = await fetch(`/api/code/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            if (!createResponse.ok) {
                throw new Error(`Failed to submit code: ${createResponse.status}`);
            }

            const submission = await createResponse.json();
            token = submission.token;

            if (!token) {
                throw new Error('No token received from Judge0');
            }

            // Step 2: Poll for results
            let result;
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                let statusResponse;

                // Using Next.js API route to proxy the request
                statusResponse = await fetch(`/api/code/status?token=${token}`);

                if (!statusResponse.ok) {
                    throw new Error(`Failed to get submission status: ${statusResponse.status}`);
                }

                result = await statusResponse.json();

                // Check if processing is complete
                // 1 = In Queue, 2 = Processing, 3 = Accepted, 4+ = Various errors
                if (result.status_id >= 3) {
                    break;
                }
            }

            // Step 3: Handle the result
            if (!result) {
                throw new Error('Failed to get execution result');
            }

            let outputText = '';

            // Build output based on what's available
            if (result.compile_output) {
                outputText += `Compilation Error:\n${result.compile_output}\n`;
            }

            if (result.stderr) {
                outputText += `Error:\n${result.stderr}\n`;

                if (result.message) {
                    outputText += `${result.message}`;
                }
            }

            // For SQL results, create HTML table instead of showing raw output
            if (language === 'sql') {
                try {
                    // Generate HTML table from SQL results
                    const sqlOutput = result.stdout ? result.stdout.trim() : '';

                    if (sqlOutput) {
                        // Check if there are query results (not just success messages from CREATE/INSERT)
                        if (sqlOutput.includes('|')) {
                            // Create HTML table preview content
                            const tableHtml = generateTableFromSqlOutput(sqlOutput);

                            // Set preview content with styled table
                            const htmlContent = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <style>
                                    body {
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                        padding: 16px;
                                        background-color: #1a1a1a;
                                        color: #e2e2e2;
                                        font-size: 12px;
                                    }
                                    table {
                                        width: 100%;
                                        border-collapse: collapse;
                                        font-size: 12px;
                                    }
                                    th {
                                        font-weight: 500;
                                        text-align: left;
                                        padding: 6px 8px;
                                        border-bottom: 1px solid #333;
                                        color: #a0a0a0;
                                    }
                                    td {
                                        padding: 6px 8px;
                                        border-bottom: 1px solid #222;
                                    }
                                    tr:hover {
                                        background-color: #222;
                                    }
                                    .sql-results-title {
                                        margin-bottom: 12px;
                                        color: #e2e2e2;
                                        font-size: 14px;
                                        font-weight: 500;
                                    }
                                    .no-results {
                                        color: #a0a0a0;
                                        padding: 16px;
                                        text-align: center;
                                        font-size: 12px;
                                        background-color: #222;
                                        border-radius: 3px;
                                    }
                                </style>
                            </head>
                            <body>
                                ${tableHtml}
                            </body>
                            </html>`;

                            setPreviewContent(htmlContent);

                            // Still set a minimal text output
                            outputText = "Query executed successfully. Results displayed in the table.";

                            // Notify parent component with both HTML content and text output
                            if (onCodeRun) {
                                // Use true for isWebPreview
                                onCodeRun(htmlContent, outputText, result.time, false);
                            }
                        } else {
                            // For non-query operations (CREATE, INSERT, etc.)
                            outputText = sqlOutput;

                            // Show a message in the preview
                            const htmlContent = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <style>
                                    body {
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                        padding: 16px;
                                        background-color: #1a1a1a;
                                        color: #e2e2e2;
                                        font-size: 12px;
                                    }
                                    .message {
                                        padding: 12px 16px;
                                        background-color: #252525;
                                        border-radius: 3px;
                                        margin-bottom: 16px;
                                        font-size: 12px;
                                    }
                                    .message h3 {
                                        font-weight: 500;
                                        font-size: 13px;
                                        margin-top: 0;
                                        margin-bottom: 8px;
                                        color: #e2e2e2;
                                    }
                                    .message p {
                                        margin: 4px 0;
                                        color: #a0a0a0;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="message">
                                    <h3>SQL Operation Successful</h3>
                                    <p>Your SQL commands executed successfully.</p>
                                    <p>Run a SELECT query to see results in a table format.</p>
                                </div>
                            </body>
                            </html>`;

                            setPreviewContent(htmlContent);

                            if (onCodeRun) {
                                // Use true for isWebPreview
                                onCodeRun(htmlContent, outputText, result.time, false);
                            }
                        }
                    } else {
                        // Empty result
                        const htmlContent = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body {
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                    padding: 16px;
                                    background-color: #1a1a1a;
                                    color: #e2e2e2;
                                    font-size: 12px;
                                }
                                .message {
                                    padding: 16px;
                                    background-color: #252525;
                                    border-radius: 3px;
                                    text-align: center;
                                    font-size: 12px;
                                    color: #a0a0a0;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="message">
                                <p>Your query did not return any results. Run a SELECT query to see results in a table format.</p>
                            </div>
                        </body>
                        </html>`;

                        setPreviewContent(htmlContent);
                        outputText = "Query executed successfully, but returned no results.";

                        if (onCodeRun) {
                            // Use true for isWebPreview
                            onCodeRun(htmlContent, outputText, result.time, false);
                        }
                    }
                } catch (error) {
                    console.error("Error formatting SQL results:", error);
                    // If table generation fails, fall back to regular output display
                    outputText += `${result.stdout}`;
                }
            } else if (result.stdout) {
                // For non-SQL languages, use normal output display
                outputText += `${result.stdout}`;
            }

            // Store execution time separately instead of adding to output
            if (result.time) {
                setExecutionTime(result.time);
            }

            // If no output was generated
            if (!outputText) {
                outputText = 'No output generated.';
            }

            setOutput(outputText);

            // For non-SQL languages, make sure to notify parent component with updated outputs
            if (language !== 'sql' && onCodeRun) {
                onCodeRun('', outputText, result.time, false);
            }

            // Only set isRunning to false after everything is complete
            setIsRunning(false);
        } catch (error) {
            const errorMessage = `Error: ${(error as Error).message}`;
            setOutput(errorMessage);
            setExecutionTime(''); // Reset execution time on error

            // Notify parent component
            if (onCodeRun) {
                onCodeRun('', errorMessage, undefined, false);
            }

            // Set isRunning to false in case of an error
            setIsRunning(false);
        }
    };

    // Submit the code
    const handleSubmit = () => {
        handleCodeSubmit(code);
    };

    // Monaco editor setup
    const setupPastePreventionHandler = () => {
        const editor = editorRef.current;

        // Dispose any existing listener first
        if (keydownDisposableRef.current) {
            try {
                keydownDisposableRef.current.dispose();
            } catch { }
            keydownDisposableRef.current = null;
        }

        if (editor && disableCopyPaste) {
            // Listen for copy operations using onKeyDown for Cmd/Ctrl+C and Cmd/Ctrl+X
            const copyKeyDownDisposable = editor.onKeyDown((e: IKeyboardEvent) => {
                const isCmdCtrl = e.ctrlKey || e.metaKey;
                const key = (e.browserEvent?.key || '').toLowerCase();
                if (isCmdCtrl && (key === 'c' || key === 'x')) {
                    const selection = editor.getSelection();
                    if (selection) {
                        const selectedText = editor.getModel()?.getValueInRange(selection) || '';
                        if (selectedText) {
                            setLastCopiedCode(selectedText);
                        }
                    }
                }
            });

            const pasteKeyDownDisposable = editor.onKeyDown((e: IKeyboardEvent) => {
                const isCmdCtrl = e.ctrlKey || e.metaKey;
                const key = (e.browserEvent?.key || '').toLowerCase();
                if (isCmdCtrl && key === 'v') {
                    // Prevent the default paste behavior
                    e.preventDefault();
                    e.stopPropagation();

                    navigator.clipboard.readText().then((clipboardText) => {
                        // Check if the pasted content matches the last copied content
                        if (clipboardText === lastCopiedCode) {
                            const selection = editor.getSelection();
                            if (selection) {
                                editor.executeEdits('paste', [{
                                    range: selection,
                                    text: clipboardText
                                }]);
                            }
                        } else {
                            // Show toast message for external paste attempts
                            setToastData({
                                title: 'Not allowed',
                                description: 'Pasting the answer is disabled for this question',
                                emoji: '🚫'
                            });
                            setShowToast(true);
                        }
                    }).catch(() => {
                    // If clipboard access fails, show toast anyway
                        setToastData({
                            title: 'Not allowed',
                            description: 'Pasting the answer is disabled for this question',
                            emoji: '🚫'
                        });
                        setShowToast(true);
                    });
                }
            });

            // Store disposables for cleanup
            keydownDisposableRef.current = {
                dispose: () => {
                    copyKeyDownDisposable.dispose();
                    pasteKeyDownDisposable.dispose();
                }
            };
        }
    };

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
        editorRef.current = editor;
        editor.focus();
        setupPastePreventionHandler();
    };

    // Update paste prevention when flag changes and cleanup on unmount
    useEffect(() => {
        setupPastePreventionHandler();
        return () => {
            if (keydownDisposableRef.current) {
                try {
                    keydownDisposableRef.current.dispose();
                } catch { }
                keydownDisposableRef.current = null;
            }
        };
    }, [disableCopyPaste, lastCopiedCode]);

    // Get the correct Monaco editor language based on active language
    const getMonacoLanguage = (lang: string) => {
        if (lang === 'react' || lang === 'nodejs') {
            return 'javascript'; // React and Node.js use JavaScript syntax
        }
        return lang;
    };

    // Helper function to generate HTML table from SQL output
    const generateTableFromSqlOutput = (sqlOutput: string): string => {
        // Split output into lines
        const lines = sqlOutput.trim().split('\n');

        if (lines.length < 3) {
            return '<div class="no-results">No data returned from query</div>';
        }

        // Start building HTML table
        let tableHtml = '<table><tbody>';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            // Replace multiple spaces with a single delimiter
            const normalizedLine = line.replace(/\s{2,}/g, '|');
            const cells = normalizedLine.split('|').map(c => c.trim()).filter(c => c);

            tableHtml += '<tr>';
            cells.forEach(cell => {
                // Handle NULL values with italic styling
                const cellContent = cell === 'NULL'
                    ? '<em style="color: #a0aec0;">NULL</em>'
                    : cell;

                // Treat all rows the same - no special header row
                tableHtml += `<td>${cellContent}</td>`;
            });
            tableHtml += '</tr>';
        }

        tableHtml += '</tbody></table>';
        return tableHtml;
    };

    // Effect to notify parent when mobile preview changes
    useEffect(() => {
        if (isMobileView && onCodeRun) {
            // When mobile preview is shown/hidden, notify parent to help with layout adjustments
            onCodeRun(
                previewContent,
                output,
                executionTime,
                isRunning
            );
        }
    }, [showMobilePreview, isMobileView]);

    // Use useImperativeHandle to expose getCurrentCode method
    useImperativeHandle(ref, () => ({
        getCurrentCode: () => code,
    }));

    return (
        <div
            className={`flex flex-col h-full overflow-auto ${isDarkMode ? '' : 'bg-white'}`}
            style={{ ['--code-mobile-preview-bg' as any]: isDarkMode ? '#111111' : '#ffffff' }}
        >
            {/* Toast notification for input validation */}
            <Toast
                show={showToast}
                title={toastData.title}
                description={toastData.description}
                emoji={toastData.emoji}
                onClose={() => setShowToast(false)}
                isMobileView={isMobileView}
            />

            {/* Mobile-specific styles */}
            <style jsx global>{`
                @media (max-width: 1024px) {
                    .mobile-preview-container {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 1000;
                        background-color: var(--code-mobile-preview-bg, #111111);
                        animation: slide-up 0.3s ease-out;
                    }
                    
                    @keyframes slide-up {
                        from {
                            transform: translateY(100%);
                        }
                        to {
                            transform: translateY(0);
                        }
                    }

                    .hidden-on-mobile {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Mobile preview overlay when active */}
            {isMobileView && showMobilePreview && (previewContent || output) ? (
                <div className={`fixed inset-0 z-50 ${isDarkMode ? 'bg-[#111111]' : 'bg-white'}`}>
                    <CodePreview
                        isRunning={isRunning}
                        previewContent={previewContent}
                        output={output}
                        isWebPreview={hasWebLanguages || activeLanguage === 'react' || activeLanguage === 'sql'}
                        executionTime={executionTime}
                        onBack={handleMobileBackClick}
                        isMobileView={true}
                        isDarkMode={isDarkMode}
                    />
                </div>
            ) : null}

            {/* Language tabs */}
            {normalizedLanguages.length > 0 && !isMobileView && (
                <div className={`flex items-center overflow-x-auto hide-scrollbar ${isDarkMode ? 'bg-[#1D1D1D]' : 'bg-gray-100 border-b border-gray-200'}`}>
                    {/* Show all language tabs */}
                    {normalizedLanguages.map((lang) => (
                        <button
                            key={lang}
                            onClick={() => {
                                setActiveLanguage(lang);
                            }}
                            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${activeLanguage === lang
                                ? (isDarkMode ? 'bg-[#2D2D2D] text-white border-b-2 border-white' : 'bg-white text-black border-b-2 border-black')
                                : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#222222]' : 'text-gray-600 hover:text-black hover:bg-gray-200')
                                }`}
                        >
                            {LANGUAGE_DISPLAY_NAMES[lang] || lang}
                        </button>
                    ))}
                </div>
            )}

            {/* Mobile language tabs - more compact */}
            {normalizedLanguages.length > 0 && isMobileView && (
                <div className={`flex items-center overflow-x-auto hide-scrollbar ${isDarkMode ? 'bg-[#1D1D1D]' : 'bg-gray-100 border-b border-gray-200'}`}>
                    {/* Show all language tabs */}
                    {normalizedLanguages.map((lang) => (
                        <button
                            key={lang}
                            onClick={() => {
                                setActiveLanguage(lang);
                            }}
                            className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${activeLanguage === lang
                                ? (isDarkMode ? 'bg-[#2D2D2D] text-white border-b-2 border-white' : 'bg-white text-black border-b-2 border-black')
                                : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#222222]' : 'text-gray-600 hover:text-black hover:bg-gray-200')
                                }`}
                        >
                            {LANGUAGE_DISPLAY_NAMES[lang] || lang}
                        </button>
                    ))}
                </div>
            )}

            {/* Main editor area with potential split for input */}
            <div className="flex-1 overflow-auto flex flex-col">
                {/* Code editor */}
                <div className={`${showInputPanel ? 'flex-none' : 'flex-1'} ${showInputPanel ? 'h-2/3' : ''}`}>
                    <Editor
                        height="100%"
                        language={getMonacoLanguage(activeLanguage)}
                        value={code[activeLanguage]}
                        onChange={handleCodeChange}
                        theme={isDarkMode ? "vs-dark" : "vs"}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            wordWrap: 'on',
                            lineNumbers: 'off',
                        }}
                        onMount={handleEditorDidMount}
                    />
                </div>

                {/* Input panel (conditionally shown) */}
                {showInputPanel && (
                    <div className={`flex-none h-1/3 border-t flex flex-col ${isDarkMode ? 'border-[#444444]' : 'border-gray-200'}`}>
                        <div className={`px-4 py-2 text-sm font-medium flex justify-between items-center ${inputError ? (isDarkMode ? 'bg-red-800 text-white' : 'bg-rose-100 text-rose-900') : (isDarkMode ? 'bg-[#222222] text-white' : 'bg-gray-100 text-gray-900')}`}>
                            <span>{inputError ? 'Input Required' : 'Add inputs for testing'}</span>
                        </div>
                        <textarea
                            ref={inputRef}
                            className={`flex-1 p-4 resize-none font-mono text-sm ${isDarkMode ? 'bg-[#1E1E1E] text-white' : 'bg-white text-slate-900'} ${inputError ? 'border border-red-500' : (isDarkMode ? '' : 'border border-gray-200')} `}
                            value={stdInput}
                            onChange={(e) => {
                                setStdInput(e.target.value);
                                setInputError(false); // Clear error on input change
                            }}
                            placeholder="Add every input to your program in a new line"
                        />
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div className={`flex items-center justify-between p-4 border-t ${isDarkMode ? 'border-[#222222]' : 'border-gray-200 bg-white'}`}>
                <div>
                    <button
                        onClick={handleCodeRun}
                        disabled={isRunning}
                        className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-700 disabled:opacity-50 text-white rounded-full px-4 py-2 cursor-pointer"
                    >
                        {isRunning ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                <span>Run</span>
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                <span>Run</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Only show the input toggle for languages that typically need input */}
                {(['python'].includes(activeLanguage)) && (
                    <div>
                        <button
                            onClick={() => {
                                setShowInputPanel(!showInputPanel);
                                // Focus the input textarea when showing
                                setTimeout(() => {
                                    if (!showInputPanel && inputRef.current) {
                                        inputRef.current.focus();
                                    }
                                }, 100);
                            }}
                            className={`flex items-center space-x-2 rounded-full px-4 py-2 cursor-pointer ${inputError
                                ? (isDarkMode ? 'bg-red-700 text-white' : 'bg-rose-500 text-white')
                                : showInputPanel
                                    ? (isDarkMode ? 'bg-[#444444] text-white' : 'bg-gray-200 text-gray-900')
                                    : (isDarkMode ? 'bg-[#333333] hover:bg-[#444444] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200')
                                }`}
                        >
                            <Terminal size={16} />
                            <span>Input</span>
                        </button>
                    </div>
                )}

                <div>
                    <button
                        onClick={handleSubmit}
                        className={`flex items-center space-x-2 rounded-full px-4 py-2 cursor-pointer ${isDarkMode ? 'bg-white hover:bg-gray-200 text-black' : 'bg-white hover:bg-gray-50 text-black border border-gray-200 shadow-sm'}`}
                    >
                        <Send size={16} />
                        <span>Submit</span>
                    </button>
                </div>
            </div>
        </div>
    );
});

export default CodeEditorView; 