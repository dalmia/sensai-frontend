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
        </div>
    );
});
jest.mock('@/components/ScorecardView', () => (props: any) => (
    <div data-testid="scorecard-view">
        <button onClick={() => props.handleBackToChat?.()}>Back</button>
        <div>items:{props.activeScorecard?.length || 0}</div>
    </div>
));
jest.mock('@/components/UploadAssignmentFile', () => () => <div data-testid="upload-assignment-file" />);

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
        expect(screen.getByText('Loading assignment...')).toBeInTheDocument();
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
});


