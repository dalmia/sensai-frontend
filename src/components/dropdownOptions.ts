import { DropdownOption } from "./Dropdown";

// Options for question purpose in the quiz editor
export const questionPurposeOptions: DropdownOption[] = [
    {
        "label": "Practice",
        "value": "chat",
        "color": "#5E548E",
        "tooltip": "Learners can practice with real-time, personalized AI feedback"
    },
    {
        "label": "Exam",
        "value": "exam",
        "color": "#B15E6C",
        "tooltip": "Test a learner's knowledge and skills - no feedback given to them"
    },
];

// Options for question types in the quiz editor
export const questionTypeOptions: DropdownOption[] = [
    {
        "label": "Objective",
        "value": "objective",
        "color": "#3A506B",
        "tooltip": "Objective question with a single correct answer"
    },
    {
        "label": "Subjective",
        "value": "subjective",
        "color": "#3C6E47",
        "tooltip": "No single correct answer, open-ended question"
    },
];

// Options for copy-paste control in exam questions
export const copyPasteControlOptions: DropdownOption[] = [
    {
        "label": "Allow",
        "value": "true",
        "color": "#3C6562",
        "tooltip": "Learners can copy the question content and paste their answer for this question"
    },
    {
        "label": "Deny",
        "value": "false",
        "color": "#E43F5A",
        "tooltip": "Learners cannot copy the question content or paste their answer for this question"
    },
];


// Options for answer types in the quiz editor
export const answerTypeOptions: DropdownOption[] = [
    {
        "label": "Text",
        "value": "text",
        "color": "#2D6A4F",
        "tooltip": "Learner types their answer"
    },
    {
        "label": "Audio",
        "value": "audio",
        "color": "#9D4E4E",
        "tooltip": "Learner records their answer"
    },
    {
        "label": "Code",
        "value": "code",
        "color": "#614A82",
        "tooltip": "Learner writes code in a code editor"
    },
    {
        "label": "File",
        "value": "file",
        "color": "#7C3AED",
        "tooltip": "Learner uploads a PDF file as their answer"
    }
];


// Options for coding languages in the quiz editor
export const codingLanguageOptions: DropdownOption[] = [
    {
        "label": "HTML",
        "value": "html",
        "color": "#9D4335",
    },
    {
        "label": "CSS",
        "value": "css",
        "color": "#2C5282",
    },
    {
        "label": "Javascript",
        "value": "javascript",
        "color": "#8A6D00",
    },
    {
        "label": "NodeJS",
        "value": "nodejs",
        "color": "#2F6846",
    },
    {
        "label": "Python",
        "value": "python",
        "color": "#4B5563",
    },
    {
        "label": "React",
        "value": "react",
        "color": "#2C7A7B",
    },
    {
        "label": "SQL",
        "value": "sql",
        "color": "#3182CE",
    }
];
