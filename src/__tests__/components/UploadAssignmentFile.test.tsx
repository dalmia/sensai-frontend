import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import UploadAssignmentFile from '@/components/UploadAssignmentFile';

function createFile(name: string, size: number, type = 'application/zip'): File {
    const blob = new Blob([new ArrayBuffer(size)], { type });
    return new File([blob], name, { type });
}

describe('UploadAssignmentFile', () => {
    jest.useFakeTimers();

    it('renders with default UI', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);
        expect(screen.getByText('Upload your project ZIP')).toBeInTheDocument();
        expect(screen.getByText('.zip up to 50MB')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Choose file/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload/i })).toBeDisabled();
    });

    it('opens file picker when Choose file is clicked (not disabled)', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);

        const hiddenInput = screen.getByRole('button', { name: /Choose file/i });
        // Clicking the visible button should not throw; actual picker is hidden input triggered via ref
        fireEvent.click(hiddenInput);
    });

    it('accepts a dragged .zip under 50MB and enables Upload', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);

        const dropZone = screen.getByText(/Upload your project ZIP/i).closest('div')!.parentElement!;

        fireEvent.dragOver(dropZone);
        const smallZip = createFile('project.zip', 1024 * 1024 * 10); // 10MB
        fireEvent.drop(dropZone, { dataTransfer: { files: [smallZip] } });

        expect(screen.getByText('project.zip')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload/i })).toBeEnabled();
    });

    it('ignores non-zip files on drop and on file change', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);

        const dropZone = screen.getByText(/Upload your project ZIP/i).closest('div')!.parentElement!;
        fireEvent.dragOver(dropZone);
        const notZip = createFile('image.png', 1024, 'image/png');
        fireEvent.drop(dropZone, { dataTransfer: { files: [notZip] } });

        // Still shows default title and upload remains disabled
        expect(screen.getByText('Upload your project ZIP')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload/i })).toBeDisabled();
    });

    it('ignores .zip over 50MB', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);

        const dropZone = screen.getByText(/Upload your project ZIP/i).closest('div')!.parentElement!;
        fireEvent.dragOver(dropZone);
        const bigZip = createFile('big.zip', 51 * 1024 * 1024);
        fireEvent.drop(dropZone, { dataTransfer: { files: [bigZip] } });

        expect(screen.getByText('Upload your project ZIP')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload/i })).toBeDisabled();
    });

    it('toggles dragActive class on dragOver and dragLeave', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);

        // Clickable container with border classes (the rounded-xl bordered div)
        const textEl = screen.getByText(/Upload your project ZIP/i);
        const container = textEl.closest('div')!.closest('div')!.closest('div')!.closest('div.rounded-xl') as HTMLDivElement;

        // Default should be dashed
        expect(container).toHaveClass('border-dashed');
        fireEvent.dragOver(container);
        // Should switch to solid border when active
        expect(container).toHaveClass('border-solid');
        fireEvent.dragLeave(container);
        // Should return to dashed
        expect(container).toHaveClass('border-dashed');
    });

    it('onFileChange selects a valid zip and enables upload', () => {
        const onComplete = jest.fn();
        const { container } = render(<UploadAssignmentFile onComplete={onComplete} />);

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile('picked.zip', 1024 * 1024);
        // Simulate change event with files list
        Object.defineProperty(input, 'files', { value: [file] });
        fireEvent.change(input);

        expect(screen.getByText('picked.zip')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload/i })).toBeEnabled();
    });

    it('simulates upload progress and calls onComplete', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);

        const dropZone = screen.getByText(/Upload your project ZIP/i).closest('div')!.parentElement!;
        fireEvent.dragOver(dropZone);
        const smallZip = createFile('project.zip', 10 * 1024 * 1024);
        fireEvent.drop(dropZone, { dataTransfer: { files: [smallZip] } });

        const uploadBtn = screen.getByRole('button', { name: /Upload/i });
        fireEvent.click(uploadBtn);

        // Progress UI should appear
        expect(screen.getByText(/Uploading…|Ready|Uploaded/)).toBeInTheDocument();

        // Fast-forward timers to complete simulated upload
        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete.mock.calls[0][0].name).toBe('project.zip');
        expect(screen.getByText('Uploaded')).toBeInTheDocument();
    });

    it('supports Enter key to start upload when focused and file selected', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} />);

        const dropZone = screen.getByText(/Upload your project ZIP/i).closest('div')!.parentElement!;
        const smallZip = createFile('project.zip', 10 * 1024 * 1024);
        fireEvent.drop(dropZone, { dataTransfer: { files: [smallZip] } });

        // Focus container with tabIndex and press Enter
        const focusable = dropZone;
        focusable.focus();
        fireEvent.keyDown(focusable, { key: 'Enter', code: 'Enter', charCode: 13 });

        act(() => {
            jest.advanceTimersByTime(2000);
        });
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('respects disabled state for interactions', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} disabled />);

        const container = screen.getByText(/Upload your project ZIP/i).closest('div')!.parentElement!;
        fireEvent.dragOver(container);
        const zip = createFile('a.zip', 1024);
        fireEvent.drop(container, { dataTransfer: { files: [zip] } });

        // Should not select
        expect(screen.getByText('Upload your project ZIP')).toBeInTheDocument();

        // Buttons should be disabled or non-interactive
        const chooseBtn = screen.getByRole('button', { name: /Choose file/i });
        fireEvent.click(chooseBtn);
        const uploadBtn = screen.getByRole('button', { name: /Upload/i });
        expect(uploadBtn).toBeDisabled();
    });

    it('hides controls and shows spinner when AI is responding', () => {
        const onComplete = jest.fn();
        render(<UploadAssignmentFile onComplete={onComplete} isAiResponding />);

        // Choose/Upload buttons should be hidden
        expect(screen.queryByRole('button', { name: /Choose file/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Upload/i })).not.toBeInTheDocument();

        // Spinner indicator exists
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
});


