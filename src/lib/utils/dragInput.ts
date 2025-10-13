import { useState, useCallback, useEffect } from 'react';

interface DragInputOptions {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    sensitivity?: number;
    disabled?: boolean;
    onDragStart?: () => void;
}

interface DragInputReturn {
    isDragging: boolean;
    dragProps: {
        onMouseDown: (e: React.MouseEvent) => void;
        style: React.CSSProperties;
    };
}

/**
 * Custom hook for horizontal drag functionality on input fields
 * @param options Configuration options for the drag behavior
 * @returns Drag state and props to attach to input elements
 */
export const useDragInput = ({
    value,
    onChange,
    min = 1,
    max = 100,
    sensitivity = 1,
    disabled = false,
    onDragStart
}: DragInputOptions): DragInputReturn => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartValue, setDragStartValue] = useState(0);
    const [dragSensitivity, setDragSensitivity] = useState(sensitivity);
    const [hasMoved, setHasMoved] = useState(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return;

        // Don't prevent default immediately - let click work first
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartValue(value);
        setHasMoved(false);

        // Adjust sensitivity based on current value range
        const range = max - min;
        setDragSensitivity(Math.max(1, Math.floor(range / 100)));
    }, [disabled, value, min, max]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStartX;

        // Only start dragging after 5px movement to allow normal clicks
        if (Math.abs(deltaX) > 5 && !hasMoved) {
            setHasMoved(true);
            // Now prevent default behavior for dragging
            e.preventDefault();
            // Call onDragStart callback to show input
            onDragStart?.();
        }

        if (hasMoved) {
            const deltaValue = Math.round(deltaX / 10) * dragSensitivity; // 10px = 1 unit
            const newValue = Math.max(min, Math.min(max, dragStartValue + deltaValue));

            if (newValue !== value) {
                onChange(newValue);
            }
        }
    }, [isDragging, dragStartX, dragStartValue, dragSensitivity, min, max, value, onChange, hasMoved, onDragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setHasMoved(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return {
        isDragging,
        dragProps: {
            onMouseDown: handleMouseDown,
            style: { cursor: 'ew-resize' }
        }
    };
};
