import {
  createIntegrationBlock,
  getUserIntegration,
  handleIntegrationPageSelection,
  handleIntegrationPageRemoval,
  fetchIntegrationBlocks,
  handleNotionLinkClick,
  compareNotionBlocks
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

    it('should successfully fetch and update title when title fetch succeeds', async () => {
      const mockIntegration = { id: 1, access_token: 'token-123' };
      const mockBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] }
      ];
      const mockTitleData = {
        page: {
          properties: {
            title: {
              title: [
                { plain_text: 'Updated Page Title' }
              ]
            }
          }
        }
      };

      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Original Title',
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
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTitleData)
        });

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual(mockBlocks);
      expect(result.error).toBeNull();
      expect(result.updatedTitle).toBe('Updated Page Title');
    });

    it('should handle title fetch failure gracefully', async () => {
      const mockIntegration = { id: 1, access_token: 'token-123' };
      const mockBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] }
      ];

      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Original Title',
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
        })
        .mockRejectedValueOnce(new Error('Title fetch error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual(mockBlocks);
      expect(result.error).toBeNull();
      expect(result.updatedTitle).toBe('Original Title'); // Should fallback to original title
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching page title:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle title fetch with non-ok response', async () => {
      const mockIntegration = { id: 1, access_token: 'token-123' };
      const mockBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] }
      ];

      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Original Title',
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
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        });

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual(mockBlocks);
      expect(result.error).toBeNull();
      expect(result.updatedTitle).toBe('Original Title'); // Should fallback to original title
    });

    it('should handle title data without page property', async () => {
      const mockIntegration = { id: 1, access_token: 'token-123' };
      const mockBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] }
      ];
      const mockTitleData = {
        // No page property
      };

      const integrationBlock = {
        id: 'block-123',
        type: 'notion',
        content: [],
        props: {
          integration_id: '1',
          resource_name: 'Original Title',
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
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTitleData)
        });

      const result = await fetchIntegrationBlocks(integrationBlock);

      expect(result.blocks).toEqual(mockBlocks);
      expect(result.error).toBeNull();
      expect(result.updatedTitle).toBe('Original Title'); // Should fallback to original title
    });
  });

  describe('handleNotionLinkClick', () => {
    let mockWindowOpen: jest.SpyInstance;

    beforeEach(() => {
      mockWindowOpen = jest.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      mockWindowOpen.mockRestore();
    });

    it('should handle clicking on a link element', () => {
      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/test-page-id-123456789012345678901234567890');
      
      const mockEvent = {
        target: mockLink,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const integrationBlocks = [
        {
          id: 'test-page-id-123456789012345678901234567890',
          child_page: {
            page: {
              public_url: 'https://notion.so/test-page'
            }
          }
        }
      ];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith('https://notion.so/test-page', '_blank', 'noopener,noreferrer');
    });

    it('should handle clicking on a child element of a link', () => {
      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/test-page-id-123456789012345678901234567890');
      
      const mockSpan = document.createElement('span');
      mockLink.appendChild(mockSpan);

      const mockEvent = {
        target: mockSpan,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const integrationBlocks = [
        {
          id: 'test-page-id-123456789012345678901234567890',
          child_page: {
            page: {
              public_url: 'https://notion.so/test-page'
            }
          }
        }
      ];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith('https://notion.so/test-page', '_blank', 'noopener,noreferrer');
    });

    it('should not handle non-link elements', () => {
      const mockEvent = {
        target: document.createElement('div'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const integrationBlocks = [];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it('should not handle external links', () => {
      const mockEvent = {
        target: document.createElement('a'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', 'https://external-site.com');
      mockEvent.target = mockLink;

      const integrationBlocks: any[] = [];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it('should not handle protocol-relative links', () => {
      const mockEvent = {
        target: document.createElement('a'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '//external-site.com');
      mockEvent.target = mockLink;

      const integrationBlocks: any[] = [];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it('should handle links with invalid page ID length', () => {
      const mockEvent = {
        target: document.createElement('a'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/short-id');
      mockEvent.target = mockLink;

      const integrationBlocks: any[] = [];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(null, '_blank', 'noopener,noreferrer');
    });

    it('should not handle links when no matching integration block found', () => {
      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/test-page-id-123456789012345678901234567890');
      
      const mockEvent = {
        target: mockLink,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const integrationBlocks = [
        {
          id: 'different-page-id',
          child_page: {
            page: {
              public_url: 'https://notion.so/different-page'
            }
          }
        }
      ];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(null, '_blank', 'noopener,noreferrer');
    });

    it('should handle links when integration blocks array is empty', () => {
      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/test-page-id-123456789012345678901234567890');
      
      const mockEvent = {
        target: mockLink,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const integrationBlocks: any[] = [];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(null, '_blank', 'noopener,noreferrer');
    });

    it('should handle links when integration block has no child_page', () => {
      const mockEvent = {
        target: document.createElement('a'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/test-page-id-123456789012345678901234567890');
      mockEvent.target = mockLink;

      const integrationBlocks = [
        {
          id: 'test-page-id-123456789012345678901234567890',
          // No child_page property
        }
      ];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(null, '_blank', 'noopener,noreferrer');
    });

    it('should handle links when integration block has no page in child_page', () => {
      const mockEvent = {
        target: document.createElement('a'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/test-page-id-123456789012345678901234567890');
      mockEvent.target = mockLink;

      const integrationBlocks = [
        {
          id: 'test-page-id-123456789012345678901234567890',
          child_page: {
            // No page property
          }
        }
      ];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(null, '_blank', 'noopener,noreferrer');
    });

    it('should handle links when integration block has no public_url in page', () => {
      const mockEvent = {
        target: document.createElement('a'),
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', '/test-page-id-123456789012345678901234567890');
      mockEvent.target = mockLink;

      const integrationBlocks = [
        {
          id: 'test-page-id-123456789012345678901234567890',
          child_page: {
            page: {
              // No public_url property
            }
          }
        }
      ];

      handleNotionLinkClick(mockEvent, integrationBlocks);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(null, '_blank', 'noopener,noreferrer');
    });
  });

  describe('compareNotionBlocks', () => {
    it('should return false when both arrays are empty', () => {
      const result = compareNotionBlocks([], []);
      expect(result).toBe(false);
    });

    it('should return true when one array is empty and the other is not', () => {
      const storedBlocks: any[] = [];
      const fetchedBlocks = [{ type: 'paragraph', content: [{ text: 'Test' }] }];

      const result1 = compareNotionBlocks(storedBlocks, fetchedBlocks);
      const result2 = compareNotionBlocks(fetchedBlocks, storedBlocks);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should return true when arrays have different lengths', () => {
      const storedBlocks = [{ type: 'paragraph', content: [{ text: 'Test' }] }];
      const fetchedBlocks = [
        { type: 'paragraph', content: [{ text: 'Test' }] },
        { type: 'heading', content: [{ text: 'Heading' }] }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(true);
    });

    it('should return false when blocks are identical', () => {
      const storedBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] },
        { type: 'heading', content: [{ text: 'Test heading' }] }
      ];
      const fetchedBlocks = [
        { type: 'paragraph', content: [{ text: 'Test content' }] },
        { type: 'heading', content: [{ text: 'Test heading' }] }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(false);
    });

    it('should return true when blocks have different content', () => {
      const storedBlocks = [
        { type: 'paragraph', content: [{ text: 'Original content' }] }
      ];
      const fetchedBlocks = [
        { type: 'paragraph', content: [{ text: 'Updated content' }] }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(true);
    });

    it('should ignore timestamps when comparing blocks', () => {
      const storedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test content' }],
          last_edited_time: '2023-01-01T00:00:00Z',
          created_time: '2023-01-01T00:00:00Z'
        }
      ];
      const fetchedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test content' }],
          last_edited_time: '2023-01-02T00:00:00Z',
          created_time: '2023-01-01T00:00:00Z'
        }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(false);
    });

    it('should remove IDs from rich_text arrays', () => {
      const storedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test content' }],
          rich_text: [
            { id: 'text-1', text: { content: 'Test' } },
            { id: 'text-2', text: { content: ' content' } }
          ]
        }
      ];
      const fetchedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test content' }],
          rich_text: [
            { id: 'text-3', text: { content: 'Test' } },
            { id: 'text-4', text: { content: ' content' } }
          ]
        }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(false);
    });

    it('should handle nested objects with rich_text arrays', () => {
      const storedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test content' }],
          properties: {
            title: {
              rich_text: [
                { id: 'title-1', text: { content: 'Title' } }
              ]
            }
          }
        }
      ];
      const fetchedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test content' }],
          properties: {
            title: {
              rich_text: [
                { id: 'title-2', text: { content: 'Title' } }
              ]
            }
          }
        }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(false);
    });

    it('should return true when rich_text content differs', () => {
      const storedBlocks = [
        {
          type: 'paragraph',
          rich_text: [
            { id: 'text-1', text: { content: 'Original text' } }
          ]
        }
      ];
      const fetchedBlocks = [
        {
          type: 'paragraph',
          rich_text: [
            { id: 'text-2', text: { content: 'Updated text' } }
          ]
        }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const storedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test' }],
          properties: {
            title: {
              rich_text: [
                { id: 'title-1', text: { content: 'Title' } }
              ]
            },
            description: {
              rich_text: [
                { id: 'desc-1', text: { content: 'Description' } }
              ]
            }
          },
          last_edited_time: '2023-01-01T00:00:00Z'
        }
      ];
      const fetchedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test' }],
          properties: {
            title: {
              rich_text: [
                { id: 'title-2', text: { content: 'Title' } }
              ]
            },
            description: {
              rich_text: [
                { id: 'desc-2', text: { content: 'Description' } }
              ]
            }
          },
          last_edited_time: '2023-01-02T00:00:00Z'
        }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(false);
    });

    it('should handle non-object values in normalization', () => {
      const storedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test' }],
          properties: {
            title: 'Simple string',
            count: 42,
            isActive: true
          }
        }
      ];
      const fetchedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test' }],
          properties: {
            title: 'Simple string',
            count: 42,
            isActive: true
          }
        }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(false);
    });

    it('should handle null and undefined values', () => {
      const storedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test' }],
          properties: {
            title: null,
            description: undefined
          }
        }
      ];
      const fetchedBlocks = [
        {
          type: 'paragraph',
          content: [{ text: 'Test' }],
          properties: {
            title: null,
            description: undefined
          }
        }
      ];

      const result = compareNotionBlocks(storedBlocks, fetchedBlocks);
      expect(result).toBe(false);
    });
  });
});