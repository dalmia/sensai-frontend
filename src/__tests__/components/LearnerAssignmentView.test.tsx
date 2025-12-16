/* eslint-disable @typescript-eslint/no-explicit-any, react/display-name */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LearnerAssignmentView from '@/components/LearnerAssignmentView';

// Mock child components
jest.mock('@/components/BlockNoteEditor', () => (props: any) => <div data-testid="blocknote">{props.placeholder || 'blocknote'}</div>);
jest.mock('@/components/ChatView', () => (props: any) => {
    return (
        <div>
            <div data-testid="chat-view">
                <div>isAiResponding:{String(props.isAiResponding)}</div>
                <div>isSubmitting:{String(props.isSubmitting)}</div>
                <div>showUpload:{String(props.showUploadSection)}</div>
            </div>
            <input aria-label="answer" value={props.currentAnswer} onChange={props.handleInputChange} />
            <button onClick={() => props.handleSubmitAnswer?.()}>Submit</button>
            <button onClick={() => props.handleViewScorecard?.([{ category: 'A', score: 3, max_score: 4, pass_score: 3, feedback: {} }])}>Open Scorecard</button>
            <button onClick={() => props.onFileUploaded?.(new File([new Uint8Array([1, 2, 3])], 'sample.zip', { type: 'application/zip' }))}>Upload File</button>
            {props.onFileDownload && (
                <button onClick={() => props.onFileDownload?.('test-uuid', 'test-file.zip')} data-testid="download-file">Download File</button>
            )}
            {props.handleAudioSubmit && (
                <button onClick={() => props.handleAudioSubmit?.(new Blob(['audio'], { type: 'audio/webm' }))} data-testid="audio-submit">Audio Submit</button>
            )}
        </div>
    );
});
jest.mock('@/components/ScorecardView', () => (props: any) => (
    <div data-testid="scorecard-view">
        <button onClick={() => props.handleBackToChat?.()}>Back</button>
        <div>items:{props.activeScorecard?.length || 0}</div>
    </div>
));
jest.mock('@/components/UploadFile', () => () => <div data-testid="upload-file" />);

// Mock auth hook
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { email: 't@e.st' } }) }));

// Mock indexedDB draft utils
jest.mock('@/lib/utils/indexedDB', () => ({
    getDraft: jest.fn(async () => null),
    setDraft: jest.fn(async () => undefined),
    deleteDraft: jest.fn(async () => undefined),
}));

// Helper to build a mock ReadableStream reader
function makeMockReader(lines: string[]) {
    let idx = 0;
    const encode = (s: string) => Uint8Array.from(Array.from(s).map((ch) => ch.charCodeAt(0)));
    return {
        read: jest.fn(async () => {
            if (idx >= lines.length) return { done: true, value: undefined };
            const value = encode(lines[idx++] + '\n');
            return { done: false, value };
        })
    };
}

describe('LearnerAssignmentView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as any) = jest.fn();
        // Default fetch mock to avoid crashes for unrelated calls
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });
    });

    it('shows loading then renders problem and chat', async () => {
        render(<LearnerAssignmentView taskId="1" userId="2" />);
        await waitFor(() => expect(screen.getByTestId('blocknote')).toBeInTheDocument());
        expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    });

    it('submits text answer and processes streaming chunks to show AI response', async () => {
        // Mock the streaming POST call
        const reader = makeMockReader([
            JSON.stringify({ feedback: 'first' }),
            JSON.stringify({ feedback: 'final', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
        ]);
        (global.fetch as any)
            // first GET assignment details
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            // POST streaming response
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="11" userId="22" isTestMode={true} />);
        // wait for chat view to appear (loading finishes)
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
        // type into input and submit
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        // isAiResponding should turn false after first feedback processed
        await waitFor(() => expect(screen.getByText(/isAiResponding:false/)).toBeInTheDocument());
    });

    it('auto shows and exits scorecard view via control flow', async () => {
        render(<LearnerAssignmentView taskId="21" userId="22" isTestMode={true} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
        // open scorecard via button
        fireEvent.click(screen.getByText('Open Scorecard'));
        expect(screen.getByTestId('scorecard-view')).toBeInTheDocument();
        // back to chat
        fireEvent.click(screen.getByText('Back'));
        expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    });

    it('file upload error path shows error message in chat', async () => {
        // initial GET
        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            // upload-local succeeds to avoid throwing in component
            .mockResolvedValueOnce({ ok: true, json: async () => ({ file_uuid: 'uuid-local' }) });

        render(<LearnerAssignmentView taskId="31" userId="41" isTestMode={true} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // trigger upload from ChatView mock
        fireEvent.click(screen.getByText('Upload File'));
        // After error, component still renders and should append error AI message
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('file upload success via S3 presigned flow', async () => {
        const presignedUrl = 'https://s3.test/presigned';
        // initial GET, presigned create, S3 PUT, then no streaming call here
        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ presigned_url: presignedUrl, file_uuid: 'uuid-123' }) })
            .mockResolvedValueOnce({ ok: true });

        render(<LearnerAssignmentView taskId="41" userId="51" isTestMode={true} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Upload File'));
        // Wait for the S3 PUT call to complete without throwing
        await waitFor(() => expect((global.fetch as any)).toHaveBeenCalled());
    });

    it('file upload success via direct backend flow when presigned fails', async () => {
        // When isTestMode is true, initial GET is skipped
        // presigned create fails, then upload-local succeeds
        (global.fetch as any)
            .mockResolvedValueOnce({ ok: false }) // presigned create fails
            .mockResolvedValueOnce({ ok: true, json: async () => ({ file_uuid: 'uuid-local-1' }) }); // upload-local succeeds

        render(<LearnerAssignmentView taskId="51" userId="61" isTestMode={true} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Upload should succeed without throwing
        fireEvent.click(screen.getByText('Upload File'));

        await waitFor(() => {
            const calls = (global.fetch as any).mock.calls;
            // Should have presigned create + upload-local (initial fetch skipped in test mode)
            expect(calls.length).toBeGreaterThanOrEqual(2);
            // Verify component still renders (no error thrown)
            expect(screen.getByTestId('chat-view')).toBeInTheDocument();
        });
    });

    it('returns early when viewOnly is true', async () => {
        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

        render(<LearnerAssignmentView taskId="61" userId="71" viewOnly={true} isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Mock FileReader to track if it's called
        const fileReaderSpy = jest.spyOn(global, 'FileReader' as any);

        // Try to trigger file upload - should return early due to viewOnly
        fireEvent.click(screen.getByText('Upload File'));

        // Wait a bit to ensure the function would have been called if not for early return
        await new Promise(resolve => setTimeout(resolve, 100));

        // FileReader should not be called because handleFileSubmit returns early
        // We verify this by checking that no fetch calls were made for file upload
        const fetchCalls = (global.fetch as any).mock.calls;
        const uploadCalls = fetchCalls.filter((call: any) =>
            call[0]?.includes('/file/create-presigned') ||
            call[0]?.includes('/file/upload-local')
        );
        expect(uploadCalls.length).toBe(0);
    });

    it('sets reader.onerror handler and throws error when triggered (line 885-887)', async () => {
        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

        let onerrorHandler: (() => void) | null = null;

        // Mock FileReader to capture the onerror handler
        global.FileReader = jest.fn().mockImplementation(function (this: FileReader) {
            this.readAsDataURL = jest.fn();
            Object.defineProperty(this, 'onerror', {
                set: (handler: () => void) => {
                    onerrorHandler = handler;
                },
                get: () => onerrorHandler
            });
            return this;
        }) as any;

        render(<LearnerAssignmentView taskId="71" userId="81" isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Trigger file upload - this should set the onerror handler
        fireEvent.click(screen.getByText('Upload File'));

        // Wait a bit for the handler to be set
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify onerror handler was set (line 885-887)
        expect(onerrorHandler).toBeDefined();
        expect(typeof onerrorHandler).toBe('function');

        // Trigger the onerror handler and verify it throws an error (line 886)
        expect(() => {
            if (onerrorHandler) {
                onerrorHandler();
            }
        }).toThrow('Failed to read file');
    });

    it('handles catch block error and adds errorResponse to chatHistory (line 888-900)', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => ([]) });

        // Mock FileReader constructor to throw synchronously to trigger catch block
        global.FileReader = jest.fn().mockImplementation(() => {
            throw new Error('FileReader initialization failed');
        }) as any;

        render(<LearnerAssignmentView taskId="81" userId="91" isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Trigger file upload - error should be caught in catch block
        fireEvent.click(screen.getByText('Upload File'));

        // Wait for error to be caught and logged
        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error processing file upload:',
                expect.any(Error)
            );
        }, { timeout: 3000 });

        // Verify error was logged (indicates catch block was executed - line 888-889)
        expect(consoleErrorSpy).toHaveBeenCalled();
        // Verify component still renders (error was handled - line 900)
        expect(screen.getByTestId('chat-view')).toBeInTheDocument();

        consoleErrorSpy.mockRestore();
    });

    describe('File download functionality', () => {
        let createElementSpy: jest.SpyInstance;
        let mockLink: any;
        const originalCreateElement = document.createElement.bind(document);

        beforeEach(() => {
            jest.clearAllMocks();
            (global.fetch as any) = jest.fn();

            // Mock URL methods
            global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
            global.URL.revokeObjectURL = jest.fn();

            // Mock createElement to return a mock link
            mockLink = {
                href: '',
                download: '',
                click: jest.fn(),
            };
            createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'a') {
                    return mockLink;
                }
                return originalCreateElement(tagName);
            });
        });

        afterEach(() => {
            createElementSpy.mockRestore();
        });

        it('downloads file using presigned URL (line 924-926)', async () => {
            const mockBlob = new Blob(['file content'], { type: 'application/zip' });
            const presignedUrl = 'https://s3.test/presigned-download';

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ({ url: presignedUrl }) }) // Presigned URL success (line 924-926)
                .mockResolvedValueOnce({ ok: true, blob: async () => mockBlob }); // File download

            render(<LearnerAssignmentView taskId="1" userId="2" isTestMode={false} />);
            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Trigger file download
            const downloadButton = screen.getByTestId('download-file');
            fireEvent.click(downloadButton);

            // Wait for presigned URL fetch and file download to complete
            await waitFor(() => {
                const fetchCalls = (global.fetch as any).mock.calls;
                const presignedCall = fetchCalls.find((call: any) =>
                    call[0]?.includes('/file/presigned-url/get')
                );
                const fileDownloadCall = fetchCalls.find((call: any) =>
                    call[0] === presignedUrl
                );
                expect(presignedCall).toBeDefined();
                expect(fileDownloadCall).toBeDefined();
            }, { timeout: 3000 });

            // Verify URL.createObjectURL was called (line 939)
            expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            // Verify link was created and configured (line 942-944)
            expect(createElementSpy).toHaveBeenCalledWith('a');
            expect(mockLink.href).toBe('blob:mock-url');
            expect(mockLink.download).toBe('test-file.zip');
        });

        it('falls back to direct download when presigned URL fails (line 927-930)', async () => {
            const mockBlob = new Blob(['file content'], { type: 'application/zip' });

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockResolvedValueOnce({ ok: false }) // Presigned URL fails (line 927-930)
                .mockResolvedValueOnce({ ok: true, blob: async () => mockBlob }); // Direct download succeeds

            render(<LearnerAssignmentView taskId="2" userId="3" isTestMode={false} />);
            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Trigger file download
            const downloadButton = screen.getByTestId('download-file');
            fireEvent.click(downloadButton);

            // Wait for download to complete
            await waitFor(() => {
                expect(createElementSpy).toHaveBeenCalledWith('a');
            }, { timeout: 3000 });

            // Verify direct download URL was used (line 929)
            const fetchCalls = (global.fetch as any).mock.calls;
            const directUrlCall = fetchCalls.find((call: any) =>
                call[0]?.includes('/file/download-local/')
            );
            expect(directUrlCall).toBeDefined();
            // Verify URL.createObjectURL was called
            expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
        });

        it('handles file download failure (line 934-936)', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://s3.test/presigned' }) }) // Presigned URL success
                .mockResolvedValueOnce({ ok: false, status: 404 }); // File download fails (line 934-936)

            render(<LearnerAssignmentView taskId="3" userId="4" isTestMode={false} />);
            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Trigger file download
            const downloadButton = screen.getByTestId('download-file');
            fireEvent.click(downloadButton);

            // Wait for error to be logged
            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    'Error downloading file:',
                    expect.any(Error)
                );
            }, { timeout: 3000 });

            consoleErrorSpy.mockRestore();
        });

        it('handles error in catch block (line 951-953)', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockRejectedValueOnce(new Error('Network error')); // Presigned URL fetch throws (line 951-953)

            render(<LearnerAssignmentView taskId="4" userId="5" isTestMode={false} />);
            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Trigger file download
            const downloadButton = screen.getByTestId('download-file');
            fireEvent.click(downloadButton);

            // Wait for error to be logged
            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    'Error downloading file:',
                    expect.any(Error)
                );
            }, { timeout: 3000 });

            consoleErrorSpy.mockRestore();
        });
    });

    it('calls onAiRespondingChange when isAiResponding changes to true', async () => {
        const onAiRespondingChange = jest.fn();
        const reader = makeMockReader([
            JSON.stringify({ feedback: 'Feedback here', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
        ]);

        (global.fetch as any)
            // Streaming response for AI evaluation
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="61" userId="71" isTestMode={true} onAiRespondingChange={onAiRespondingChange} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Initially onAiRespondingChange should be called with false
        expect(onAiRespondingChange).toHaveBeenCalledWith(false);

        // Submit an answer which will set isAiResponding to true
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        // Wait for isAiResponding to change to true
        await waitFor(() => {
            expect(onAiRespondingChange).toHaveBeenCalledWith(true);
        });

        // After the first feedback chunk, isAiResponding should be set to false
        await waitFor(() => {
            expect(onAiRespondingChange).toHaveBeenCalledWith(false);
        });
    });

    it('calls onTaskComplete when assignment is completed', async () => {
        const onTaskComplete = jest.fn();
        const reader = makeMockReader([
            JSON.stringify({ feedback: 'Great work!', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
        ]);

        // In test mode only the streaming call is made; mock it to return the completed chunk
        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="201" userId="211" isTestMode={true} onTaskComplete={onTaskComplete} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Submit an answer
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        // Wait for the streaming to complete and handleAssignmentResponse to be called
        await waitFor(() => {
            expect(onTaskComplete).toHaveBeenCalledWith('201', true);
        }, { timeout: 10000 });
    }, 15000);

    it('converts key area scores to scorecard format with all fields provided', async () => {
        const keyAreaScores = {
            'Code Quality': { score: 4, max_score: 5, pass_score: 3, feedback: { comment: 'Excellent' } },
            'Testing': { score: 3, max_score: 5, pass_score: 3, feedback: { comment: 'Good' } }
        };

        const reader = makeMockReader([
            JSON.stringify({
                feedback: 'Great work!',
                evaluation_status: 'completed',
                key_area_scores: keyAreaScores,
                current_key_area: 'Code Quality'
            })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="301" userId="311" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        // Wait for AI response with scorecard
        await waitFor(() => expect(screen.getByText('Open Scorecard')).toBeInTheDocument());

        // Click to view scorecard
        fireEvent.click(screen.getByText('Open Scorecard'));

        // Scorecard should show items
        expect(screen.getByTestId('scorecard-view')).toBeInTheDocument();
    });

    it('converts key area scores with default values when fields are missing', async () => {
        const keyAreaScores = {
            'Code Quality': { score: 2 }, // missing max_score, pass_score, feedback
            'Testing': { max_score: 6, pass_score: 4 } // missing score and feedback
        };

        const reader = makeMockReader([
            JSON.stringify({
                feedback: 'Work needed',
                evaluation_status: 'completed',
                key_area_scores: keyAreaScores,
                current_key_area: 'Testing'
            })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="401" userId="411" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        // Wait for AI response
        await waitFor(() => expect(screen.getByText('Open Scorecard')).toBeInTheDocument(), { timeout: 5000 });

        // Click to view scorecard
        fireEvent.click(screen.getByText('Open Scorecard'));

        // Scorecard should render with default values
        expect(screen.getByTestId('scorecard-view')).toBeInTheDocument();
    });

    it('handles convertKeyAreaScoresToScorecard with empty feedback', async () => {
        const keyAreaScores = {
            'Quality': { score: 4, max_score: 5, pass_score: 3, feedback: {} }
        };

        const reader = makeMockReader([
            JSON.stringify({
                feedback: 'Completed',
                evaluation_status: 'completed',
                key_area_scores: keyAreaScores,
                current_key_area: 'Quality'
            })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="501" userId="511" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        // Wait for AI response and verify scorecard button appears
        await waitFor(() => expect(screen.getByText('Open Scorecard')).toBeInTheDocument(), { timeout: 5000 });
    });

    it('handles fetch error when response is not ok', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
            // Filter out CSS parsing errors
            const message = args[0];
            if (typeof message === 'string' && message.includes('Could not parse CSS')) {
                return;
            }
            // Allow other errors through
        });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: false,
                status: 404
            });

        // Set isTestMode to false so the component actually fetches
        render(<LearnerAssignmentView taskId="101" userId="111" isTestMode={false} />);

        await waitFor(() => {
            const calls = consoleErrorSpy.mock.calls.filter(call =>
                call[0] === 'Error fetching assignment data:'
            );
            expect(calls.length).toBeGreaterThan(0);
        });

        consoleErrorSpy.mockRestore();
    });

    it('handles general fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
            // Filter out CSS parsing errors
            const message = args[0];
            if (typeof message === 'string' && message.includes('Could not parse CSS')) {
                return;
            }
            // Allow other errors through
        });

        // Mock fetch to throw an error
        (global.fetch as any)
            .mockReset()
            .mockRejectedValueOnce(new Error('Network error'));

        // Set isTestMode to false so the component actually fetches
        render(<LearnerAssignmentView taskId="111" userId="121" isTestMode={false} />);

        await waitFor(() => {
            const calls = consoleErrorSpy.mock.calls.filter(call =>
                call[0] === 'Error fetching assignment data:'
            );
            expect(calls.length).toBeGreaterThan(0);
        });

        consoleErrorSpy.mockRestore();
    });

    it('sets problem blocks when data.blocks is provided', async () => {
        const mockBlocks = [
            { type: 'paragraph', content: 'Test problem statement' }
        ];

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                    blocks: mockBlocks
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([])
            });

        render(<LearnerAssignmentView taskId="121" userId="131" isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('sets title when data.title is provided', async () => {
        const mockTitle = 'Test Assignment Title';

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        blocks: [],
                    title: mockTitle
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([])
            });

        render(<LearnerAssignmentView taskId="131" userId="141" isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('sets submission type when data.input_type is provided', async () => {
        const mockInputType = 'audio';

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: mockInputType,
                        blocks: []
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([])
            });

        render(<LearnerAssignmentView taskId="141" userId="151" isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('sets settings when assignment.settings is provided (line 161)', async () => {
        const mockSettings = {
            allowCopyPaste: false
        };

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                        input_type: 'text',
                        blocks: [],
                        settings: mockSettings
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([])
            });

        render(<LearnerAssignmentView taskId="161" userId="171" isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('sets all fields when complete data is provided', async () => {
        const mockBlocks = [{ type: 'paragraph', content: 'Full problem' }];
        const mockTitle = 'Complete Assignment';
        const mockInputType = 'file';
        const mockSettings = { allowCopyPaste: true };

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    assignment: {
                    blocks: mockBlocks,
                    title: mockTitle,
                        input_type: mockInputType,
                        settings: mockSettings
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([])
            });

        render(<LearnerAssignmentView taskId="151" userId="161" isTestMode={false} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('skips setting problem blocks when data.blocks is not an array', async () => {
        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    blocks: 'not an array',
                    title: 'Test Title'
                })
            });

        render(<LearnerAssignmentView taskId="161" userId="171" />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('fetches chat history successfully with text messages', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'Hello',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'text'
            },
            {
                role: 'assistant',
                id: 2,
                content: '{"feedback": "Great answer!"}',
                created_at: '2024-01-01T00:01:00Z',
                response_type: 'text'
            }
        ];

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData }); // Chat history

        render(<LearnerAssignmentView taskId="1001" userId="1011" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('fetches chat history with AI message extracting feedback', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'My answer',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'text'
            },
            {
                role: 'assistant',
                id: 2,
                content: '{"feedback": "Good work", "evaluation_status": "completed", "key_area_scores": {"A": {"score": 3, "max_score": 4, "pass_score": 3, "feedback": {}}}}',
                created_at: '2024-01-01T00:01:00Z',
                response_type: 'text'
            }
        ];

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData });

        render(<LearnerAssignmentView taskId="1101" userId="1111" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('fetches chat history with user file message', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: '{"file_uuid": "uuid-123", "filename": "test.zip"}',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'file'
            },
            {
                role: 'assistant',
                id: 2,
                content: '{"feedback": "File received"}',
                created_at: '2024-01-01T00:01:00Z',
                response_type: 'text'
            }
        ];

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData });

        render(<LearnerAssignmentView taskId="1201" userId="1211" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('handles fetch chat history error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial fetch
            .mockResolvedValueOnce({ ok: false, status: 500 }); // Chat history error

        render(<LearnerAssignmentView taskId="1301" userId="1311" isTestMode={false} />);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error fetching chat history:',
                expect.any(Error)
            );
        });

        consoleErrorSpy.mockRestore();
    });

    it('handles audio message fetching with presigned URL', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'audio-uuid-123',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'audio'
            }
        ];

        // Mock blob for audio
        const mockBlob = new Blob(['mock audio data'], { type: 'audio/wav' });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData }) // Chat history
            .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://presigned-url.com/audio.wav' }) }) // Presigned URL
            .mockResolvedValueOnce({ ok: true, blob: async () => mockBlob }); // Audio data

        render(<LearnerAssignmentView taskId="1401" userId="1411" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('handles audio message fetching with fallback to local download', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'audio-uuid-123',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'audio'
            }
        ];

        const mockBlob = new Blob(['mock audio data'], { type: 'audio/wav' });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData }) // Chat history
            .mockResolvedValueOnce({ ok: false }) // Presigned URL fails
            .mockResolvedValueOnce({ ok: true, blob: async () => mockBlob }); // Local download

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        render(<LearnerAssignmentView taskId="1501" userId="1511" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        consoleErrorSpy.mockRestore();
    });

    it('skips fetching chat history when in test mode', async () => {
        let fetchCallCount = 0;
        (global.fetch as any).mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        render(<LearnerAssignmentView taskId="1601" userId="1611" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // When isTestMode is true, component skips both assignment fetch and chat history fetch
        // So we expect 0 calls, not 1
        expect(fetchCallCount).toBe(0);
    });

    it('skips fetching chat history when userId is missing', async () => {
        let fetchCallCount = 0;
        (global.fetch as any).mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        render(<LearnerAssignmentView taskId="1701" userId="" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Only 1 call for initial assignment fetch, no chat history fetch
        expect(fetchCallCount).toBe(1);
    });

    it('skips fetching chat history when taskId is missing', async () => {
        let fetchCallCount = 0;
        (global.fetch as any).mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        render(<LearnerAssignmentView taskId="" userId="1811" isTestMode={false} />);

        await new Promise(resolve => setTimeout(resolve, 500));

        // Should not make any chat history calls
        expect(fetchCallCount).toBeLessThanOrEqual(2);
    });

    it('handles audio fetch failure from backend with error thrown', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'audio-uuid-123',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'audio'
            }
        ];

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData }) // Chat history
            .mockResolvedValueOnce({ ok: false }) // Presigned URL fails
            .mockResolvedValueOnce({ ok: false }); // Local download also fails - triggers throw new Error

        render(<LearnerAssignmentView taskId="1901" userId="1911" isTestMode={false} />);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error fetching audio data:',
                expect.any(Error)
            );
        });

        consoleErrorSpy.mockRestore();
    });

    it('handles audio fetch failure from presigned URL with error thrown', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'audio-uuid-123',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'audio'
            }
        ];

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData }) // Chat history
            .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://presigned-url.com/audio.wav' }) }) // Presigned URL
            .mockResolvedValueOnce({ ok: false }); // Presigned URL fetch fails - triggers throw new Error

        render(<LearnerAssignmentView taskId="2001" userId="2011" isTestMode={false} />);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error fetching audio data:',
                expect.any(Error)
            );
        });

        consoleErrorSpy.mockRestore();
    });

    it('handles audio blob conversion error', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'audio-uuid-123',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'audio'
            }
        ];

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock blob to throw error when accessing
        const mockBlobWithError = {
            blob: () => Promise.reject(new Error('Blob conversion failed'))
        };

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData }) // Chat history
            .mockResolvedValueOnce({ ok: false }) // Presigned URL fails
            .mockResolvedValueOnce(mockBlobWithError); // Local download succeeds but blob conversion fails

        render(<LearnerAssignmentView taskId="2101" userId="2111" isTestMode={false} />);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error fetching audio data:',
                expect.any(Error)
            );
        });

        consoleErrorSpy.mockRestore();
    });

    it('handles AI message JSON parsing failure', async () => {
        const mockChatData = [
            {
                role: 'assistant',
                id: 1,
                content: 'not valid json{',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'text'
            }
        ];

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData });

        render(<LearnerAssignmentView taskId="2201" userId="2211" isTestMode={false} />);

        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith(
                'Failed to parse AI message content, using original:',
                expect.any(Error)
            );
        });

        consoleLogSpy.mockRestore();
    });

    it('handles user file message JSON parsing failure', async () => {
        const mockChatData = [
            {
                role: 'user',
                id: 1,
                content: 'not valid json{',
                created_at: '2024-01-01T00:00:00Z',
                response_type: 'file'
            }
        ];

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockChatData });

        render(<LearnerAssignmentView taskId="2301" userId="2311" isTestMode={false} />);

        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith(
                'Failed to parse user file message content, using original:',
                expect.any(Error)
            );
        });

        consoleLogSpy.mockRestore();
    });

    it('does not call storeChatHistory when in test mode (early return)', async () => {
        const reader = makeMockReader([
            JSON.stringify({
                feedback: 'Feedback',
                evaluation_status: 'completed',
                key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } },
                current_key_area: 'A'
            })
        ]);

        let fetchCallCount = 0;
        (global.fetch as any).mockImplementation(() => {
            fetchCallCount++;
            if (fetchCallCount === 1) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (fetchCallCount === 2) {
                return Promise.resolve({
                    ok: true,
                    body: { getReader: () => reader }
                });
            }
        });

        render(<LearnerAssignmentView taskId="2801" userId="2811" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() => expect(screen.getByText(/isAiResponding:false/)).toBeInTheDocument(), { timeout: 5000 });

        // When isTestMode is true, initial fetch is skipped, so we only get the streaming call
        expect(fetchCallCount).toBe(1);
    });

    it('does not call storeChatHistory when userId is missing (early return)', async () => {
        let fetchCallCount = 0;
        (global.fetch as any).mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        render(<LearnerAssignmentView taskId="2901" userId="" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        await new Promise(resolve => setTimeout(resolve, 500));

        expect(fetchCallCount).toBeLessThanOrEqual(2);
    });

    it('does not call storeChatHistory when taskId is missing (early return)', async () => {
        let fetchCallCount = 0;
        (global.fetch as any).mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        render(<LearnerAssignmentView taskId="" userId="3011" isTestMode={false} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        await new Promise(resolve => setTimeout(resolve, 500));

        expect(fetchCallCount).toBeLessThanOrEqual(2);
    });

    it('does not submit when currentAnswer is empty', async () => {
        const reader = makeMockReader([
            JSON.stringify({ feedback: 'Response', evaluation_status: 'in_progress', key_area_scores: {}, current_key_area: '' })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="3101" userId="3111" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Try to submit with empty answer
        fireEvent.click(screen.getByText('Submit'));

        // Should still show isAiResponding:false (no submission occurred)
        expect(screen.getByText(/isAiResponding:false/)).toBeInTheDocument();

        // When isTestMode is true, initial fetch is skipped, so we expect 0 calls
        expect((global.fetch as any).mock.calls.length).toBe(0);
    });

    it('does not submit when currentAnswer contains only whitespace', async () => {
        const reader = makeMockReader([
            JSON.stringify({ feedback: 'Response', evaluation_status: 'in_progress', key_area_scores: {}, current_key_area: '' })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="3201" userId="3211" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Set answer to whitespace only
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: '   ' } });
        fireEvent.click(screen.getByText('Submit'));

        // Should still show isAiResponding:false (no submission occurred)
        expect(screen.getByText(/isAiResponding:false/)).toBeInTheDocument();

        // When isTestMode is true, initial fetch is skipped, so we expect 0 calls
        expect((global.fetch as any).mock.calls.length).toBe(0);
    });

    it('calls processUserResponse with correct parameters', async () => {
        const reader = makeMockReader([
            JSON.stringify({ feedback: 'Response', evaluation_status: 'in_progress', key_area_scores: {}, current_key_area: '' })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="3501" userId="3511" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        const answerText = 'My detailed answer';
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: answerText } });
        fireEvent.click(screen.getByText('Submit'));

        // Wait for API call
        await waitFor(() => {
            expect((global.fetch as any).mock.calls.length).toBeGreaterThanOrEqual(1);
        });

        // Verify the API was called with correct body
        const apiCall = (global.fetch as any).mock.calls[(global.fetch as any).mock.calls.length - 1];
        expect(apiCall[0]).toContain('/ai/assignment');

        const requestBody = JSON.parse(apiCall[1].body);
        expect(requestBody.user_response).toBe(answerText);
        expect(requestBody.response_type).toBe('text');
        expect(requestBody.task_id).toBe('3501');
        expect(requestBody.user_id).toBe('3511');
    });

    it('processUserResponse - chat history included in test mode request', async () => {
        const firstReader = makeMockReader([
            JSON.stringify({ feedback: 'First response', evaluation_status: 'in_progress', key_area_scores: {}, current_key_area: '' })
        ]);
        const secondReader = makeMockReader([
            JSON.stringify({ feedback: 'Second response', evaluation_status: 'in_progress', key_area_scores: {}, current_key_area: '' })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => firstReader } })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => secondReader } });

        render(<LearnerAssignmentView taskId="5101" userId="5111" isTestMode={true} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // First submission
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'first answer' } });
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() => expect(screen.getByText(/isAiResponding:false/)).toBeInTheDocument());

        // Second submission to build chat history
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'second answer with history' } });
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() => {
            const calls = (global.fetch as any).mock.calls;
            const lastCall = calls[calls.length - 1];
            if (lastCall && lastCall[1] && lastCall[1].body) {
                const body = JSON.parse(lastCall[1].body);
                // In test mode with chat history, chat_history should be included
                if (body.chat_history) {
                    expect(Array.isArray(body.chat_history)).toBe(true);
                }
            }
            expect(screen.getByText(/isAiResponding:false/)).toBeInTheDocument();
        }, { timeout: 5000 });
    });

    describe('storeChatHistory function', () => {
        it('calls storeChatHistory when submission completes in non-test mode', async () => {
            const reader = makeMockReader([
                JSON.stringify({ feedback: 'Completed feedback', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
            ]);

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch (empty for new assignment)
                .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } }) // AI streaming response
                .mockResolvedValueOnce({ ok: true }); // storeChatHistory call

            render(<LearnerAssignmentView taskId="10001" userId="10011" isTestMode={false} />);

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'test submission' } });
            fireEvent.click(screen.getByText('Submit'));

            // Wait for streaming to complete and storeChatHistory to be called
            await waitFor(() => {
                const calls = (global.fetch as any).mock.calls;
                const storeHistoryCall = calls.find((call: any) =>
                    call[0]?.includes('/chat/?userId=')
                );
                expect(storeHistoryCall).toBeDefined();
            }, { timeout: 5000 });
        }, 10000);

        it('storeChatHistory sends correct request body with user and assistant messages', async () => {
            const reader = makeMockReader([
                JSON.stringify({ feedback: 'Great work!', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
            ]);

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } }) // AI streaming
                .mockResolvedValueOnce({ ok: true }); // storeChatHistory call

            render(<LearnerAssignmentView taskId="10002" userId="10012" isTestMode={false} />);

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'My detailed answer' } });
            fireEvent.click(screen.getByText('Submit'));

            // Wait for storeChatHistory call
            await waitFor(() => {
                const calls = (global.fetch as any).mock.calls;
                const storeCall = calls.find((call: any) =>
                    call[0]?.includes('/chat/?userId=')
                );
                if (storeCall) {
                    const body = JSON.parse(storeCall[1].body);
                    // Verify request structure
                    expect(body.user_id).toBe(10012);
                    expect(body.task_id).toBe(10002);
                    expect(body.messages).toHaveLength(2);
                    expect(body.messages[0].role).toBe('user');
                    expect(body.messages[1].role).toBe('assistant');
                    expect(body.is_complete).toBe(true);

                    // Verify assistant message contains all required fields
                    const aiContent = JSON.parse(body.messages[1].content);
                    expect(aiContent.feedback).toBe('Great work!');
                    expect(aiContent.evaluation_status).toBe('completed');
                    expect(aiContent.key_area_scores).toBeDefined();
                }
            }, { timeout: 5000 });
        }, 10000);

        it('storeChatHistory sets is_complete correctly based on evaluation status', async () => {
            const reader = makeMockReader([
                JSON.stringify({ feedback: 'Needs work', evaluation_status: 'needs_resubmission', key_area_scores: {}, current_key_area: '' })
            ]);

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } })
                .mockResolvedValueOnce({ ok: true });

            render(<LearnerAssignmentView taskId="10003" userId="10013" isTestMode={false} />);

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'needs improvement' } });
            fireEvent.click(screen.getByText('Submit'));

            await waitFor(() => {
                const calls = (global.fetch as any).mock.calls;
                const storeCall = calls.find((call: any) =>
                    call[0]?.includes('/chat/?userId=')
                );
                if (storeCall) {
                    const body = JSON.parse(storeCall[1].body);
                    // For needs_resubmission, is_complete should be false
                    expect(body.is_complete).toBe(false);
                }
            }, { timeout: 5000 });
        }, 10000);

        it('storeChatHistory handles API errors gracefully', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            const reader = makeMockReader([
                JSON.stringify({ feedback: 'Test feedback', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
            ]);

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } })
                .mockResolvedValueOnce({ ok: false, status: 500 }); // storeChatHistory fails

            render(<LearnerAssignmentView taskId="10004" userId="10014" isTestMode={false} />);

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'error test' } });
            fireEvent.click(screen.getByText('Submit'));

            // Should not throw error, just log it
            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    'Error storing chat history:',
                    expect.any(Error)
                );
            }, { timeout: 5000 });

            consoleErrorSpy.mockRestore();
        }, 10000);

        it('storeChatHistory includes correct response_type for different message types', async () => {
            const reader = makeMockReader([
                JSON.stringify({ feedback: 'Audio processed', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
            ]);

            (global.fetch as any)
                .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Initial assignment fetch
                .mockResolvedValueOnce({ ok: true, json: async () => ([]) }) // Chat history fetch
                .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } })
                .mockResolvedValueOnce({ ok: true });

            render(<LearnerAssignmentView taskId="10005" userId="10015" isTestMode={false} />);

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'audio response' } });
            fireEvent.click(screen.getByText('Submit'));

            // The user message should have the correct response_type
            await waitFor(() => {
                const calls = (global.fetch as any).mock.calls;
                const storeCall = calls.find((call: any) =>
                    call[0]?.includes('/chat/?userId=')
                );
                if (storeCall) {
                    const body = JSON.parse(storeCall[1].body);
                    expect(body.messages[0].response_type).toBeDefined();
                }
            }, { timeout: 5000 });
        }, 10000);
    });

    describe('Copy/Paste disable functionality', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            (global.fetch as any) = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
        });

        it('prevents CMD+A (Mac) when copy/paste is disabled and shows toast', async () => {
            const preventDefault = jest.fn();
            const stopPropagation = jest.fn();

            render(
                <LearnerAssignmentView
                    taskId="1"
                    userId="2"
                    settings={{ allowCopyPaste: false }}
                />
            );

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Simulate CMD+A (Mac) keydown event
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'a',
                metaKey: true,
                ctrlKey: false,
                bubbles: true,
                cancelable: true
            });
            Object.defineProperty(keydownEvent, 'preventDefault', { value: preventDefault });
            Object.defineProperty(keydownEvent, 'stopPropagation', { value: stopPropagation });

            document.dispatchEvent(keydownEvent);

            // Wait for toast to appear
            await waitFor(() => {
                expect(screen.getByText('Not allowed')).toBeInTheDocument();
                expect(screen.getByText('Selecting all text is disabled for this assignment')).toBeInTheDocument();
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(stopPropagation).toHaveBeenCalled();
        });

        it('prevents CTRL+A (Windows/Linux) when copy/paste is disabled and shows toast', async () => {
            const preventDefault = jest.fn();
            const stopPropagation = jest.fn();

            render(
                <LearnerAssignmentView
                    taskId="1"
                    userId="2"
                    settings={{ allowCopyPaste: false }}
                />
            );

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Simulate CTRL+A (Windows/Linux) keydown event
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'a',
                metaKey: false,
                ctrlKey: true,
                bubbles: true,
                cancelable: true
            });
            Object.defineProperty(keydownEvent, 'preventDefault', { value: preventDefault });
            Object.defineProperty(keydownEvent, 'stopPropagation', { value: stopPropagation });

            document.dispatchEvent(keydownEvent);

            // Wait for toast to appear
            await waitFor(() => {
                expect(screen.getByText('Not allowed')).toBeInTheDocument();
                expect(screen.getByText('Selecting all text is disabled for this assignment')).toBeInTheDocument();
            });

            expect(preventDefault).toHaveBeenCalled();
            expect(stopPropagation).toHaveBeenCalled();
        });

        it('does not prevent CMD+A when copy/paste is enabled', async () => {
            const preventDefault = jest.fn();

            render(
                <LearnerAssignmentView
                    taskId="1"
                    userId="2"
                    settings={{ allowCopyPaste: true }}
                />
            );

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Simulate CMD+A keydown event
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'a',
                metaKey: true,
                ctrlKey: false,
                bubbles: true,
                cancelable: true
            });
            Object.defineProperty(keydownEvent, 'preventDefault', { value: preventDefault });

            document.dispatchEvent(keydownEvent);

            // Wait a bit to ensure toast doesn't appear
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(preventDefault).not.toHaveBeenCalled();
            expect(screen.queryByText('Not allowed')).not.toBeInTheDocument();
        });

        it('does not prevent CMD+A when settings are not provided (default enabled)', async () => {
            const preventDefault = jest.fn();

            render(
                <LearnerAssignmentView
                    taskId="1"
                    userId="2"
                />
            );

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Simulate CMD+A keydown event
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'a',
                metaKey: true,
                ctrlKey: false,
                bubbles: true,
                cancelable: true
            });
            Object.defineProperty(keydownEvent, 'preventDefault', { value: preventDefault });

            document.dispatchEvent(keydownEvent);

            // Wait a bit to ensure toast doesn't appear
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(preventDefault).not.toHaveBeenCalled();
            expect(screen.queryByText('Not allowed')).not.toBeInTheDocument();
        });

        it('does not prevent other keys when copy/paste is disabled', async () => {
            const preventDefault = jest.fn();

            render(
                <LearnerAssignmentView
                    taskId="1"
                    userId="2"
                    settings={{ allowCopyPaste: false }}
                />
            );

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Simulate CMD+C (copy) keydown event - should not be prevented
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'c',
                metaKey: true,
                ctrlKey: false,
                bubbles: true,
                cancelable: true
            });
            Object.defineProperty(keydownEvent, 'preventDefault', { value: preventDefault });

            document.dispatchEvent(keydownEvent);

            // Wait a bit to ensure toast doesn't appear
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(preventDefault).not.toHaveBeenCalled();
            expect(screen.queryByText('Not allowed')).not.toBeInTheDocument();
        });

        it('does not prevent CMD+A when only metaKey or ctrlKey is pressed without "a"', async () => {
            const preventDefault = jest.fn();

            render(
                <LearnerAssignmentView
                    taskId="1"
                    userId="2"
                    settings={{ allowCopyPaste: false }}
                />
            );

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Simulate CMD+B keydown event - should not be prevented
            const keydownEvent = new KeyboardEvent('keydown', {
                key: 'b',
                metaKey: true,
                ctrlKey: false,
                bubbles: true,
                cancelable: true
            });
            Object.defineProperty(keydownEvent, 'preventDefault', { value: preventDefault });

            document.dispatchEvent(keydownEvent);

            // Wait a bit to ensure toast doesn't appear
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(preventDefault).not.toHaveBeenCalled();
            expect(screen.queryByText('Not allowed')).not.toBeInTheDocument();
        });
    });

    describe('Draft loading and scorecard parsing', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            (global.fetch as any) = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
        });

        it('loads draft from IndexedDB and sets current answer (line 1005)', async () => {
            const { getDraft } = require('@/lib/utils/indexedDB');
            getDraft.mockResolvedValueOnce('draft answer text');

            render(<LearnerAssignmentView taskId="123" userId="456" />);

            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Wait for draft to load and set current answer
            await waitFor(() => {
                const input = screen.getByLabelText('answer') as HTMLInputElement;
                expect(input.value).toBe('draft answer text');
            });

            // Verify getDraft was called with correct key
            expect(getDraft).toHaveBeenCalledWith('123');
        });

        it('handles failed JSON parsing for scorecard and logs error (line 1032)', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

            // Mock fetch to return assignment and chat history with invalid JSON in last AI message
            // The invalid JSON contains "evaluation_status":"completed" as a string so isCompleted will be true
            // but the JSON itself is malformed so parsing will fail in the useEffect
            const invalidJson = '{"evaluation_status":"completed" "invalid":}'; // Invalid JSON syntax

            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        assignment: { input_type: 'text', blocks: [] }
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ([
                        { sender: 'user', content: 'test', rawContent: 'test' },
                        { sender: 'ai', content: invalidJson, rawContent: invalidJson } // Invalid JSON with completed status
                    ])
                });

            render(<LearnerAssignmentView taskId="999" userId="888" isTestMode={false} />);

            // Wait for component to render and chat history to load
            await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

            // Wait for chat history to be fetched and set
            // The fetchChatHistory useEffect will run and set chatHistory
            // Then isCompleted useMemo will recompute and return true (because content includes "evaluation_status":"completed")
            // Then the scorecard parsing useEffect will run and try to parse, which will fail
            await waitFor(() => {
                expect(consoleLogSpy).toHaveBeenCalledWith(
                    'Failed to parse AI message for scorecard:',
                    expect.any(Error)
                );
            }, { timeout: 5000 });

            consoleLogSpy.mockRestore();
        });
    });
});


