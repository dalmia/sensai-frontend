import {
  createIntegrationBlock,
  getUserIntegration,
  handleIntegrationPageSelection,
  handleIntegrationPageRemoval,
  fetchIntegrationBlocks
} from '../../../lib/utils/integrationUtils';

// Mock fetch
global.fetch = jest.fn();

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4')
}));

describe('integrationUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createIntegrationBlock', () => {
    it('should create a valid integration block', () => {
      const integrationId = 'integration-123';
      const pageId = 'page-456';
      const pageTitle = 'Test Page';
      const integrationType = 'notion';

      const result = createIntegrationBlock(integrationId, pageId, pageTitle, integrationType);

      expect(result.type).toBe('notion');
      expect(result.props.integration_id).toBe(integrationId);
      expect(result.props.resource_id).toBe(pageId);
      expect(result.props.resource_name).toBe(pageTitle);
      expect(result.content).toEqual([]);
      expect(result.position).toBe(0);
    });

    it('should generate unique IDs for different blocks', () => {
      const block1 = createIntegrationBlock('id1', 'page1', 'Page 1', 'notion');
      const block2 = createIntegrationBlock('id2', 'page2', 'Page 2', 'notion');

      expect(block1.id).toBe('mock-uuid-v4');
      expect(block2.id).toBe('mock-uuid-v4');
    });

    it('should handle optional parameters', () => {
      const blocks = [{ type: 'paragraph', content: [{ text: 'Test' }] }];
      const position = 5;

      const result = createIntegrationBlock('id', 'page', 'title', 'notion', blocks, position);

      expect(result.content).toEqual(blocks);
      expect(result.position).toBe(position);
    });
  });

  describe('getUserIntegration', () => {
    it('should successfully fetch user integration', async () => {
      const mockIntegration = { id: 1, integration_type: 'notion', access_token: 'token-123' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockIntegration])
      });

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toEqual(mockIntegration);
      expect(global.fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=user-123`
      );
    });

    it('should return null when no integration is found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toBeNull();
    });

    it('should return null on fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toBeNull();
    });

    it('should return null on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await getUserIntegration('user-123', 'notion');

      expect(result).toBeNull();
    });
  });

  describe('handleIntegrationPageSelection', () => {
    const mockOnContentUpdate = jest.fn();
    const mockOnBlocksUpdate = jest.fn();
    const mockOnError = jest.fn();

    beforeEach(() => {
      mockOnContentUpdate.mockClear();
      mockOnBlocksUpdate.mockClear();
      mockOnError.mockClear();
    });

    it('should successfully handle page selection', async () => {
      const mockIntegration = { id: 1, integration_type: 'notion', access_token: 'token-123' };
      const mockBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] },
        { type: 'heading', content: [{ text: 'Test heading' }] }
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockIntegration])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            data: mockBlocks
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
          type: 'notion',
          props: {
            integration_id: 1,
            resource_name: 'Test Page',
            resource_id: 'page-456',
          },
          content: mockBlocks
        })
      ]);
      expect(mockOnBlocksUpdate).not.toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('should handle no integration found', async () => {
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
      expect(mockOnBlocksUpdate).not.toHaveBeenCalled();
    });

    it('should handle page content fetch failure', async () => {
      const mockIntegration = { id: 1, integration_type: 'notion', access_token: 'token-123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockIntegration])
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404
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
      expect(mockOnBlocksUpdate).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors in page selection', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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

      // When getUserIntegration fails, it returns null and triggers the "No integration found" path
      expect(mockOnError).toHaveBeenCalledWith('No integration found');
      expect(mockOnContentUpdate).not.toHaveBeenCalled();
      expect(mockOnBlocksUpdate).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user integration:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle exceptions during page content processing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockIntegration = { id: 1, integration_type: 'notion', access_token: 'token-123' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockIntegration])
        })
        .mockRejectedValueOnce(new Error('Network error during page content fetch'));

      await handleIntegrationPageSelection(
        'page-456',
        'Test Page',
        'user-123',
        'notion',
        mockOnContentUpdate,
        mockOnBlocksUpdate,
        mockOnError
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error handling page selection:', expect.any(Error));
      expect(mockOnContentUpdate).toHaveBeenCalledWith([]);
      expect(mockOnBlocksUpdate).toHaveBeenCalledWith([]);
      expect(mockOnError).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('handleIntegrationPageRemoval', () => {
    const mockOnContentUpdate = jest.fn();
    const mockOnBlocksUpdate = jest.fn();

    beforeEach(() => {
      mockOnContentUpdate.mockClear();
      mockOnBlocksUpdate.mockClear();
    });

    it('should clear content and blocks when removing integration', () => {
      handleIntegrationPageRemoval(mockOnContentUpdate, mockOnBlocksUpdate);

      expect(mockOnContentUpdate).toHaveBeenCalledWith([]);
      expect(mockOnBlocksUpdate).toHaveBeenCalledWith([]);
    });
  });

  describe('fetchIntegrationBlocks', () => {
    it('should successfully fetch integration blocks', async () => {
      const mockIntegration = { id: 1, access_token: 'token-123' };
      const mockBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] },
        { type: 'heading', content: [{ text: 'Test heading' }] }
      ];

      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Test Page',
          resource_id: 'page-456',
        },
        position: 0
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIntegration)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            data: mockBlocks
          })
        });

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual(mockBlocks);
      expect(result.error).toBeNull();
    });

    it('should handle missing integration_id', async () => {
      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '',
          resource_name: 'Test Page',
          resource_id: 'page-456',
        },
        position: 0
      };

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual([]);
      expect(result.error).toBe('Integration not found. Please try again later.');
    });

    it('should handle integration fetch failure', async () => {
      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Test Page',
          resource_id: 'page-456',
        },
        position: 0
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual([]);
      expect(result.error).toBe('Content source not found. Please try again later.');
    });

    it('should handle missing access token', async () => {
      const mockIntegration = { id: 1 }; // No access_token

      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Test Page',
          resource_id: 'page-456',
        },
        position: 0
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegration)
      });

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual([]);
      expect(result.error).toBe('Content access not available. Please try again later.');
    });

    it('should handle page content fetch failure', async () => {
      const mockIntegration = { id: 1, access_token: 'token-123' };

      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Test Page',
          resource_id: 'page-456',
        },
        position: 0
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIntegration)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        });

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual([]);
      expect(result.error).toBe('Failed to load content. Please try again later.');
    });

    it('should handle network errors', async () => {
      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Test Page',
          resource_id: 'page-456',
        },
        position: 0
      };

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual([]);
      expect(result.error).toBe('Unable to load content. Please try again later.');
    });
  });
});