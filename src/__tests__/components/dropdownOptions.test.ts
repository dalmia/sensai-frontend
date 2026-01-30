import {
    questionPurposeOptions,
    questionTypeOptions,
    answerTypeOptions,
    codingLanguageOptions
} from '../../components/dropdownOptions';

describe('Dropdown Options', () => {
    describe('questionPurposeOptions', () => {
        it('should have correct structure for all options', () => {
            expect(questionPurposeOptions).toHaveLength(2);
            
            // Test Practice option
            const practiceOption = questionPurposeOptions[0];
            expect(practiceOption).toEqual({
                label: "Practice",
                value: "chat",
                color: "#5E548E",
                tooltip: "Learners can practice with real-time, personalized AI feedback"
            });

            // Test Exam option
            const examOption = questionPurposeOptions[1];
            expect(examOption).toEqual({
                label: "Exam",
                value: "exam",
                color: "#B15E6C",
                tooltip: "Test a learner's knowledge and skills - no feedback given to them"
            });
        });

        it('should have all required properties for each option', () => {
            questionPurposeOptions.forEach(option => {
                expect(option).toHaveProperty('label');
                expect(option).toHaveProperty('value');
                expect(option).toHaveProperty('color');
                expect(option).toHaveProperty('tooltip');
                expect(typeof option.label).toBe('string');
                expect(typeof option.value).toBe('string');
                expect(typeof option.color).toBe('string');
                expect(typeof option.tooltip).toBe('string');
            });
        });
    });

    describe('questionTypeOptions', () => {
        it('should have correct structure for all options', () => {
            expect(questionTypeOptions).toHaveLength(2);
            
            // Test Objective option
            const objectiveOption = questionTypeOptions[0];
            expect(objectiveOption).toEqual({
                label: "Objective",
                value: "objective",
                color: "#3A506B",
                tooltip: "Objective question with a single correct answer"
            });

            // Test Subjective option
            const subjectiveOption = questionTypeOptions[1];
            expect(subjectiveOption).toEqual({
                label: "Subjective",
                value: "subjective",
                color: "#3C6E47",
                tooltip: "No single correct answer, open-ended question"
            });
        });

        it('should have all required properties for each option', () => {
            questionTypeOptions.forEach(option => {
                expect(option).toHaveProperty('label');
                expect(option).toHaveProperty('value');
                expect(option).toHaveProperty('color');
                expect(option).toHaveProperty('tooltip');
                expect(typeof option.label).toBe('string');
                expect(typeof option.value).toBe('string');
                expect(typeof option.color).toBe('string');
                expect(typeof option.tooltip).toBe('string');
            });
        });
    });

    describe('answerTypeOptions', () => {
        it('should have correct structure for all options', () => {
            expect(answerTypeOptions).toHaveLength(4);

            // Test Text option
            const textOption = answerTypeOptions[0];
            expect(textOption).toEqual({
                label: "Text",
                value: "text",
                color: "#2D6A4F",
                tooltip: "Learner types their answer"
            });

            // Test Audio option
            const audioOption = answerTypeOptions[1];
            expect(audioOption).toEqual({
                label: "Audio",
                value: "audio",
                color: "#9D4E4E",
                tooltip: "Learner records their answer"
            });

            // Test Code option
            const codeOption = answerTypeOptions[2];
            expect(codeOption).toEqual({
                label: "Code",
                value: "code",
                color: "#614A82",
                tooltip: "Learner writes code in a code editor"
            });

            // Test File option
            const fileOption = answerTypeOptions[3];
            expect(fileOption).toEqual({
                label: "File",
                value: "file",
                color: "#7C3AED",
                tooltip: "Learner uploads a PDF file as their answer"
            });
        });

        it('should have all required properties for each option', () => {
            answerTypeOptions.forEach(option => {
                expect(option).toHaveProperty('label');
                expect(option).toHaveProperty('value');
                expect(option).toHaveProperty('color');
                expect(option).toHaveProperty('tooltip');
                expect(typeof option.label).toBe('string');
                expect(typeof option.value).toBe('string');
                expect(typeof option.color).toBe('string');
                expect(typeof option.tooltip).toBe('string');
            });
        });
    });

    describe('codingLanguageOptions', () => {
        it('should have correct structure for all options', () => {
            expect(codingLanguageOptions).toHaveLength(7);
            
            const expectedLanguages = [
                { label: "HTML", value: "html", color: "#9D4335" },
                { label: "CSS", value: "css", color: "#2C5282" },
                { label: "Javascript", value: "javascript", color: "#8A6D00" },
                { label: "NodeJS", value: "nodejs", color: "#2F6846" },
                { label: "Python", value: "python", color: "#4B5563" },
                { label: "React", value: "react", color: "#2C7A7B" },
                { label: "SQL", value: "sql", color: "#3182CE" }
            ];

            expectedLanguages.forEach((expected, index) => {
                expect(codingLanguageOptions[index]).toEqual(expected);
            });
        });

        it('should have all required properties for each option', () => {
            codingLanguageOptions.forEach(option => {
                expect(option).toHaveProperty('label');
                expect(option).toHaveProperty('value');
                expect(option).toHaveProperty('color');
                expect(typeof option.label).toBe('string');
                expect(typeof option.value).toBe('string');
                expect(typeof option.color).toBe('string');
                // Note: codingLanguageOptions don't have tooltip property
                expect(option).not.toHaveProperty('tooltip');
            });
        });

        it('should have valid color values', () => {
            codingLanguageOptions.forEach(option => {
                expect(option.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            });
        });

        it('should have unique values', () => {
            const values = codingLanguageOptions.map(option => option.value);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });

        it('should have unique labels', () => {
            const labels = codingLanguageOptions.map(option => option.label);
            const uniqueLabels = new Set(labels);
            expect(uniqueLabels.size).toBe(labels.length);
        });
    });

    describe('General properties validation', () => {
        it('should have valid color values for all option arrays', () => {
            const allOptions = [
                ...questionPurposeOptions,
                ...questionTypeOptions,
                ...answerTypeOptions,
                ...codingLanguageOptions
            ];

            allOptions.forEach(option => {
                expect(option.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            });
        });

        it('should have non-empty labels and values for all options', () => {
            const allOptions = [
                ...questionPurposeOptions,
                ...questionTypeOptions,
                ...answerTypeOptions,
                ...codingLanguageOptions
            ];

            allOptions.forEach(option => {
                expect(option.label.length).toBeGreaterThan(0);
                expect(option.value.length).toBeGreaterThan(0);
            });
        });
    });
}); 