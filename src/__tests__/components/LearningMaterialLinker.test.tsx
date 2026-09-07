import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LearningMaterialLinker, { LearningMaterial } from '../../components/LearningMaterialLinker';

// Mock fetch
global.fetch = jest.fn();

// Mock environment variables

describe('LearningMaterialLinker Component', () => {
    const mockCourseId = '123';
    const mockLinkedMaterialIds: string[] = ['1', '2'];
    const mockOnMaterialsChange = jest.fn();

    // Mock learning materials data
    const mockLearningMaterials: LearningMaterial[] = [
        { id: 1, title: 'Material 1', type: 'learning_material', status: 'published' },
        { id: 2, title: 'Material 2', type: 'learning_material', status: 'published' },
        { id: 3, title: 'Material 3', type: 'learning_material', status: 'published' },
        { id: 4, title: 'Material 4', type: 'learning_material', status: 'published' },
        { id: 5, title: 'Draft Material', type: 'learning_material', status: 'draft' },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockReset();
    });

    it('should render in read-only mode with linked materials', async () => {
        // Mock API response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockLearningMaterials
        });

        render(
            <LearningMaterialLinker
                courseId={mockCourseId}
                linkedMaterialIds={mockLinkedMaterialIds}
                readOnly={true}
                onMaterialsChange={mockOnMaterialsChange}
            />
        );

        // Check if API was called to fetch materials
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                `/api/backend/tasks/course/${mockCourseId}/learning_material`
            );
        });

        // Should display linked materials in read-only mode
        await waitFor(() => {
            expect(screen.getByText('Material 1')).toBeInTheDocument();
            expect(screen.getByText('Material 2')).toBeInTheDocument();
        });

        // Should not display the "Link Learning Material" button in read-only mode
        expect(screen.queryByRole('button', { name: /link learning material/i })).not.toBeInTheDocument();
    });

    it('should render in editable mode with dropdown functionality', async () => {
        // Mock API response for initial load
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockLearningMaterials
        });

        render(
            <LearningMaterialLinker
                courseId={mockCourseId}
                linkedMaterialIds={mockLinkedMaterialIds}
                readOnly={false}
                onMaterialsChange={mockOnMaterialsChange}
            />
        );

        // Wait for initial data load
        await waitFor(() => {
            expect(screen.getByText('Material 1')).toBeInTheDocument();
            expect(screen.getByText('Material 2')).toBeInTheDocument();
        });

        // Mock API response for dropdown load
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockLearningMaterials
        });

        // Check if the dropdown button is present in editable mode
        const addButton = screen.getByRole('button', { name: /link learning material/i });
        expect(addButton).toBeInTheDocument();

        // Click to open the dropdown
        fireEvent.click(addButton);

        // Should fetch materials again when opening dropdown
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        // Should display available materials in dropdown (excluding already linked ones)
        await waitFor(() => {
            expect(screen.getByText('Material 3')).toBeInTheDocument();
            expect(screen.getByText('Material 4')).toBeInTheDocument();

            // Draft materials should not appear
            expect(screen.queryByText('Draft Material')).not.toBeInTheDocument();

            // Already linked materials should not appear in dropdown
            expect(screen.queryAllByText('Material 1').length).toBe(1); // Only in selected list
            expect(screen.queryAllByText('Material 2').length).toBe(1); // Only in selected list
        });
    });

    it('should handle adding a new learning material', async () => {
        // Mock API response
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ // Initial fetch
                ok: true,
                json: async () => mockLearningMaterials
            })
            .mockResolvedValueOnce({ // Dropdown fetch
                ok: true,
                json: async () => mockLearningMaterials
            });

        render(
            <LearningMaterialLinker
                courseId={mockCourseId}
                linkedMaterialIds={mockLinkedMaterialIds}
                readOnly={false}
                onMaterialsChange={mockOnMaterialsChange}
            />
        );

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getByText('Material 1')).toBeInTheDocument();
            expect(screen.getByText('Material 2')).toBeInTheDocument();
        });

        // Open dropdown
        fireEvent.click(screen.getByRole('button', { name: /link learning material/i }));

        // Wait for dropdown to load
        await waitFor(() => {
            expect(screen.getByText('Material 3')).toBeInTheDocument();
            expect(screen.getByText('Material 4')).toBeInTheDocument();
        });

        // Click on material 3 to add it
        fireEvent.click(screen.getByText('Material 3'));

        // Check if onMaterialsChange was called with correct IDs
        expect(mockOnMaterialsChange).toHaveBeenCalledWith(['1', '2', '3']);

        // Material 3 should be added to selected list
        expect(screen.getAllByText('Material 3').length).toBe(1);

        // Material 3 should no longer appear in dropdown
        const dropdownItems = screen.queryAllByRole('button');
        const material3InDropdown = dropdownItems.find(item =>
            item.textContent?.includes('Material 3') &&
            !item.className.includes('bg-[#222]')); // The class used for selected items
        expect(material3InDropdown).toBeUndefined();
    });

    it('should handle removing a learning material', async () => {
        // Mock API response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockLearningMaterials
        });

        render(
            <LearningMaterialLinker
                courseId={mockCourseId}
                linkedMaterialIds={mockLinkedMaterialIds}
                readOnly={false}
                onMaterialsChange={mockOnMaterialsChange}
            />
        );

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getByText('Material 1')).toBeInTheDocument();
            expect(screen.getByText('Material 2')).toBeInTheDocument();
        });

        // Find and click the remove button for Material 1
        const removeButtons = screen.getAllByRole('button');
        const material1RemoveButton = removeButtons.find(btn =>
            btn.parentElement?.textContent?.includes('Material 1') &&
            btn.querySelector('svg')
        );

        fireEvent.click(material1RemoveButton!);

        // Check if onMaterialsChange was called with correct IDs (material 1 removed)
        expect(mockOnMaterialsChange).toHaveBeenCalledWith(['2']);
    });

    it('should filter materials based on search query', async () => {
        // Mock API responses
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockLearningMaterials
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockLearningMaterials
            });

        render(
            <LearningMaterialLinker
                courseId={mockCourseId}
                linkedMaterialIds={['2']} // Only material 2 is linked
                readOnly={false}
                onMaterialsChange={mockOnMaterialsChange}
            />
        );

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getByText('Material 2')).toBeInTheDocument();
        });

        // Open dropdown
        fireEvent.click(screen.getByRole('button', { name: /link learning material/i }));

        // Wait for dropdown to load
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
        });

        // Enter search query that should match Material 1 and Material 4
        const searchInput = screen.getByPlaceholderText(/search/i);
        fireEvent.change(searchInput, { target: { value: '1' } });

        // Only Material 1 should be visible in dropdown (Material 4 doesn't contain "1")
        await waitFor(() => {
            expect(screen.getByText('Material 1')).toBeInTheDocument();
            expect(screen.queryByText('Material 3')).not.toBeInTheDocument();
            expect(screen.queryByText('Material 4')).not.toBeInTheDocument();
        });
    });

    it('should handle API errors gracefully', async () => {
        // Spy on console.error before mocking it
        jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock API failure - use linkedMaterialIds with values to trigger fetchLinkedMaterials
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API error'));

        render(
            <LearningMaterialLinker
                courseId={mockCourseId}
                linkedMaterialIds={['1']} // Include at least one ID to trigger fetchLinkedMaterials
                readOnly={false}
                onMaterialsChange={mockOnMaterialsChange}
            />
        );

        // Component should render without crashing
        expect(screen.getByRole('button', { name: /link learning material/i })).toBeInTheDocument();

        // Console error should have been called
        await waitFor(() => {
            expect(console.error).toHaveBeenCalled();
        });

        // Clean up the mock to avoid affecting other tests
        (console.error as jest.Mock).mockRestore();
    });
}); 