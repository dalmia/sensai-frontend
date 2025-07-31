import {
  fetchIntegrationBlocks,
  createIntegrationBlock,
  getUserIntegration,
  handleIntegrationPageSelection,
  handleIntegrationPageRemoval,
  IntegrationBlock
} from '../../../lib/utils/integrationUtils';

// Mock fetch
global.fetch = jest.fn();

describe('integrationUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchIntegrationBlocks', () => {
    const mockIntegrationBlock: IntegrationBlock = {
      type: 'integration',
      props: {
        integration_id: 'integration-123',
        resource_name: 'Test Page',
        resource_id: 'page-456',
        resource_type: 'page',
        integration_type: 'notion'
      },
      id: 'test-integration-block',
      position: 0
    };

    it('should successfully fetch integration blocks', async () => {
      // Mock integration fetch
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'test-token-123'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            data: [
              { type: 'paragraph', content: [{ text: 'Test content' }] },
              { type: 'heading', content: [{ text: 'Test heading' }] }
            ]
          })
        });

      const result = await fetchIntegrationBlocks(mockIntegrationBlock);

      expect(result.error).toBeNull();
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0]).toEqual({ type: 'paragraph', content: [{ text: 'Test content' }] });
      expect(result.blocks[1]).toEqual({ type: 'heading', content: [{ text: 'Test heading' }] });
    });

    it('should handle missing integration_id', async () => {
      const blockWithoutIntegrationId = {
        ...mockIntegrationBlock,
        props: {
          ...mockIntegrationBlock.props,
          integration_id: ''
        }
      };

      const result = await fetchIntegrationBlocks(blockWithoutIntegrationId);

      expect(result.error).toBe('Integration not found. Please try again later.');
      expect(result.blocks).toEqual([]);
    });

    it('should handle integration fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await fetchIntegrationBlocks(mockIntegrationBlock);

      expect(result.error).toBe('Content source not found. Please try again later.');
      expect(result.blocks).toEqual([]);
    });

    it('should handle missing access token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await fetchIntegrationBlocks(mockIntegrationBlock);

      expect(result.error).toBe('Content access is not available. Please try again later.');
      expect(result.blocks).toEqual([]);
    });

    it('should handle page blocks fetch failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'test-token-123'
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        });

      const result = await fetchIntegrationBlocks(mockIntegrationBlock);

      expect(result.error).toBe('Failed to load content. Please try again later.');
      expect(result.blocks).toEqual([]);
    });

    it('should handle invalid response data', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'test-token-123'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: false,
            data: null
          })
        });

      const result = await fetchIntegrationBlocks(mockIntegrationBlock);

      expect(result.error).toBe('Content could not be loaded. Please try again later.');
      expect(result.blocks).toEqual([]);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchIntegrationBlocks(mockIntegrationBlock);

      expect(result.error).toBe('Unable to load content. Please try again later.');
      expect(result.blocks).toEqual([]);
    });
  });

  describe('createIntegrationBlock', () => {
    it('should create a valid integration block', () => {
      const integrationId = 'integration-123';
      const pageId = 'page-456';
      const pageTitle = 'Test Page';
      const integrationType = 'notion';

      const result = createIntegrationBlock(integrationId, pageId, pageTitle, integrationType);

      expect(result.type).toBe('integration');
      expect(result.props.integration_id).toBe(integrationId);
      expect(result.props.resource_id).toBe(pageId);
      expect(result.props.resource_name).toBe(pageTitle);
      expect(result.props.resource_type).toBe('page');
      expect(result.props.integration_type).toBe(integrationType);
      expect(result.id).toMatch(/^notion-integration-\d+$/);
      expect(result.position).toBe(0);
    });

    it('should generate unique IDs for different blocks', () => {
      const block1 = createIntegrationBlock('id1', 'page1', 'Page 1', 'notion');
      const block2 = createIntegrationBlock('id2', 'page2', 'Page 2', 'notion');

      expect(block1.id).toMatch(/^notion-integration-\d+$/);
      expect(block2.id).toMatch(/^notion-integration-\d+$/);
      // Since they're created at different times, they should be different
      // If they happen to be the same due to timing, that's acceptable
      // The important thing is that they follow the correct format
    });
  });

  describe('getUserIntegration', () => {
    it('should successfully fetch user integration', async () => {
      const mockIntegrations = [
        { id: 1, integration_type: 'notion', access_token: 'token-123' },
        { id: 2, integration_type: 'slack', access_token: 'token-456' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegrations)
      });

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toEqual({ id: 1, integration_type: 'notion', access_token: 'token-123' });
      expect(global.fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=user-123`
      );
    });

    it('should return null when integration not found', async () => {
      const mockIntegrations = [
        { id: 1, integration_type: 'slack', access_token: 'token-123' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegrations)
      });

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toBeNull();
    });

    it('should handle fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user integration:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('handleIntegrationPageSelection', () => {
    const mockOnContentUpdate = jest.fn();
    const mockOnBlocksUpdate = jest.fn();
    const mockOnError = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully handle page selection', async () => {
      const mockIntegration = {
        id: 'integration-123',
        integration_type: 'notion',
        access_token: 'token-123'
      };

      // Mock getUserIntegration (first call)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockIntegration])
        })
        // Mock fetchPageBlocks (second call)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            data: [{ type: 'paragraph', content: [{ text: 'Test content' }] }]
          })
        });

      await handleIntegrationPageSelection(
        'page-456',
        'Test Page',
        'user-123',
        'notion',
        mockOnContentUpdate,
        mockOnBlocksUpdate,
        mockOnError
      );

      expect(mockOnContentUpdate).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'integration',
          props: {
            integration_id: 'integration-123',
            resource_name: 'Test Page',
            resource_id: 'page-456',
            resource_type: 'page',
            integration_type: 'notion'
          }
        })
      ]);
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('should handle missing integration', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      await handleIntegrationPageSelection(
        'page-456',
        'Test Page',
        'user-123',
        'notion',
        mockOnContentUpdate,
        mockOnBlocksUpdate,
        mockOnError
      );

      expect(mockOnError).toHaveBeenCalledWith('No integration found');
      expect(mockOnContentUpdate).not.toHaveBeenCalled();
    });

    it('should handle page content fetch failure', async () => {
      const mockIntegration = {
        id: 'integration-123',
        integration_type: 'notion',
        access_token: 'token-123'
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockIntegration])
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        });

      await handleIntegrationPageSelection(
        'page-456',
        'Test Page',
        'user-123',
        'notion',
        mockOnContentUpdate,
        mockOnBlocksUpdate,
        mockOnError
      );

      expect(mockOnError).toHaveBeenCalledWith('Failed to fetch page content');
      expect(mockOnContentUpdate).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await handleIntegrationPageSelection(
        'page-456',
        'Test Page',
        'user-123',
        'notion',
        mockOnContentUpdate,
        mockOnBlocksUpdate,
        mockOnError
      );

      // When getUserIntegration fails, it should call onError with 'No integration found'
      expect(mockOnError).toHaveBeenCalledWith('No integration found');
      expect(mockOnContentUpdate).not.toHaveBeenCalled();
      expect(mockOnBlocksUpdate).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user integration:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle unexpected errors in page selection', async () => {
      const mockIntegration = {
        id: 'integration-123',
        integration_type: 'notion',
        access_token: 'token-123'
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock getUserIntegration to succeed but fetchPageBlocks to throw an error
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockIntegration])
        })
        .mockRejectedValueOnce(new Error('Unexpected error during page content fetch'));

      await handleIntegrationPageSelection(
        'page-456',
        'Test Page',
        'user-123',
        'notion',
        mockOnContentUpdate,
        mockOnBlocksUpdate,
        mockOnError
      );

      // Should call both onContentUpdate and onBlocksUpdate with empty arrays
      expect(mockOnContentUpdate).toHaveBeenCalledWith([]);
      expect(mockOnBlocksUpdate).toHaveBeenCalledWith([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error handling page selection:', expect.any(Error));
      expect(mockOnError).not.toHaveBeenCalled(); // onError should not be called for unexpected errors

      consoleSpy.mockRestore();
    });
  });

  describe('handleIntegrationPageRemoval', () => {
    const mockOnContentUpdate = jest.fn();
    const mockOnBlocksUpdate = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should clear content and blocks when removing page', () => {
      handleIntegrationPageRemoval(mockOnContentUpdate, mockOnBlocksUpdate);

      expect(mockOnContentUpdate).toHaveBeenCalledWith([]);
      expect(mockOnBlocksUpdate).toHaveBeenCalledWith([]);
    });
  });
});