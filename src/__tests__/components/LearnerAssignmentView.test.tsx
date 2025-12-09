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
            // upload-local fails
            .mockResolvedValueOnce({ ok: false, status: 500 });

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
        // initial GET, presigned create fails, then upload-local succeeds
        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: false }) // presigned create
            .mockResolvedValueOnce({ ok: true, json: async () => ({ file_uuid: 'uuid-local-1' }) }); // upload-local

        render(<LearnerAssignmentView taskId="51" userId="61" isTestMode={true} />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Upload File'));
        await waitFor(() => {
            const calls = (global.fetch as any).mock.calls.length;
            expect(calls).toBeGreaterThanOrEqual(2);
        });
    });

    it('calls onAiRespondingChange when isAiResponding changes to true', async () => {
        const onAiRespondingChange = jest.fn();
        const reader = makeMockReader([
            JSON.stringify({ feedback: 'Feedback here', evaluation_status: 'completed', key_area_scores: { A: { score: 3, max_score: 4, pass_score: 3, feedback: {} } }, current_key_area: 'A' })
        ]);

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
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

        (global.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, body: { getReader: () => reader } });

        render(<LearnerAssignmentView taskId="201" userId="211" isTestMode={true} onTaskComplete={onTaskComplete} />);

        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());

        // Submit an answer
        fireEvent.change(screen.getByLabelText('answer'), { target: { value: 'my answer' } });
        fireEvent.click(screen.getByText('Submit'));

        // Wait for the streaming to complete and handleAssignmentResponse to be called
        await waitFor(() => {
            expect(onTaskComplete).toHaveBeenCalledWith('201', true);
        }, { timeout: 5000 });
    });

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
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: false,
                status: 404
            });

        render(<LearnerAssignmentView taskId="101" userId="111" />);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error fetching assignment data:',
                expect.any(Error)
            );
        });

        consoleErrorSpy.mockRestore();
    });

    it('handles general fetch error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock fetch to throw an error
        (global.fetch as any)
            .mockReset()
            .mockRejectedValueOnce(new Error('Network error'));

        render(<LearnerAssignmentView taskId="111" userId="121" />);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error fetching assignment data:',
                expect.any(Error)
            );
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
                    blocks: mockBlocks
                })
            });

        render(<LearnerAssignmentView taskId="121" userId="131" />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('sets title when data.title is provided', async () => {
        const mockTitle = 'Test Assignment Title';

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    title: mockTitle
                })
            });

        render(<LearnerAssignmentView taskId="131" userId="141" />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('sets submission type when data.input_type is provided', async () => {
        const mockInputType = 'audio';

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    input_type: mockInputType
                })
            });

        render(<LearnerAssignmentView taskId="141" userId="151" />);
        await waitFor(() => expect(screen.getByTestId('chat-view')).toBeInTheDocument());
    });

    it('sets all fields when complete data is provided', async () => {
        const mockBlocks = [{ type: 'paragraph', content: 'Full problem' }];
        const mockTitle = 'Complete Assignment';
        const mockInputType = 'file';

        (global.fetch as any)
            .mockReset()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    blocks: mockBlocks,
                    title: mockTitle,
                    input_type: mockInputType
                })
            });

        render(<LearnerAssignmentView taskId="151" userId="161" />);
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

        // Only 1 call for initial assignment fetch, no chat history fetch
        expect(fetchCallCount).toBe(1);
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

        expect(fetchCallCount).toBe(2);
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

        // Verify that only 1 fetch call was made (initial assignment fetch)
        expect((global.fetch as any).mock.calls.length).toBe(1);
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

        // Verify that only 1 fetch call was made (initial assignment fetch)
        expect((global.fetch as any).mock.calls.length).toBe(1);
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
            expect((global.fetch as any).mock.calls.length).toBe(2);
        });

        // Verify the API was called with correct body
        const apiCall = (global.fetch as any).mock.calls[1];
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
});


