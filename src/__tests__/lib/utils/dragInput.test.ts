import React from "react";
import { renderHook, act } from "@testing-library/react";
import { useDragInput } from "../../../lib/utils/dragInput";

describe("useDragInput", () => {
    function setup(options?: Partial<Parameters<typeof useDragInput>[0]>) {
        const onChange = jest.fn();
        const onDragStart = jest.fn();
        const result = renderHook(() =>
            useDragInput({
                value: options?.value ?? 50,
                onChange,
                min: options?.min ?? 0,
                max: options?.max ?? 100,
                sensitivity: options?.sensitivity ?? 1,
                disabled: options?.disabled ?? false,
                onDragStart
            })
        );
        return { ...result, onChange, onDragStart };
    }

    const dispatchMouseMove = (x: number) => {
        act(() => {
            document.dispatchEvent(new MouseEvent("mousemove", { clientX: x }));
        });
    };

    const dispatchMouseUp = () => {
        act(() => {
            document.dispatchEvent(new MouseEvent("mouseup"));
        });
    };

    it("ignores mousemove events when not dragging (early return)", () => {
        const { result, onChange, onDragStart } = setup({ value: 5 });
        // No onMouseDown invoked here
        expect(result.current.isDragging).toBe(false);
        dispatchMouseMove(250);
        expect(onDragStart).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("exposes dragProps with onMouseDown and cursor style", () => {
        const { result } = setup();
        expect(typeof result.current.dragProps.onMouseDown).toBe("function");
        expect(result.current.dragProps.style).toEqual({ cursor: "ew-resize" });
    });

    it("does not drag when disabled", () => {
        const { result, onChange, onDragStart } = setup({ disabled: true });
        act(() => {
            result.current.dragProps.onMouseDown({ clientX: 100 } as unknown as React.MouseEvent);
        });
        dispatchMouseMove(200);
        dispatchMouseUp();
        expect(onDragStart).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("does not trigger change before threshold (<=5px)", () => {
        const { result, onChange, onDragStart } = setup({ value: 50 });
        act(() => {
            result.current.dragProps.onMouseDown({ clientX: 100 } as unknown as React.MouseEvent);
        });
        // Move 4px - under threshold
        dispatchMouseMove(104);
        expect(onDragStart).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        dispatchMouseUp();
    });

    it("starts drag after threshold and updates with sensitivity, clamped to min/max", () => {
        const { result, onChange, onDragStart } = setup({ value: 10, min: 0, max: 20 });
        act(() => {
            result.current.dragProps.onMouseDown({ clientX: 100 } as unknown as React.MouseEvent);
        });
        // Cross threshold to start dragging (6px)
        dispatchMouseMove(106);
        expect(onDragStart).toHaveBeenCalled();

        // move +100px -> Math.round(100/10)=10; sensitivity computed initially to Math.max(1, floor((20-0)/100)) = 1
        dispatchMouseMove(200);
        // newValue = 10 + 10 = 20 (clamped to max 20)
        expect(onChange).toHaveBeenLastCalledWith(20);

        // move negative large to go below min
        dispatchMouseMove(-200);
        expect(onChange).toHaveBeenLastCalledWith(0);

        dispatchMouseUp();
    });

    it("derives drag sensitivity from range and applies quantization of 10px per unit", () => {
        const { result, onChange } = setup({ value: 0, min: 0, max: 1000 });
        act(() => {
            result.current.dragProps.onMouseDown({ clientX: 0 } as unknown as React.MouseEvent);
        });
        // threshold cross
        dispatchMouseMove(6);
        // range 1000 -> sensitivity floor(1000/100)=10
        // move +50px -> round(50/10)=5; 5 * 10 = 50
        dispatchMouseMove(50);
        expect(onChange).toHaveBeenLastCalledWith(50);
        dispatchMouseUp();
    });
});


