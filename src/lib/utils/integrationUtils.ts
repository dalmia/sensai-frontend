import { v4 as uuidv4 } from 'uuid';

// Types for integration
export interface IntegrationBlock {
  id: string;
  type: string;
  content: any[];
  props: {
    integration_id: string;
    resource_name: string;
    resource_id: string;
  };
  position: number;
}

export interface IntegrationBlocksResult {
  blocks: any[];
  error: string | null;
  updatedTitle?: string;
}

// Function to fetch blocks from an integration block
export const fetchIntegrationBlocks = async (integrationBlock: IntegrationBlock): Promise<IntegrationBlocksResult> => {
  try {
    const integrationId = integrationBlock.props.integration_id;
    if (!integrationId) {
      return { blocks: [], error: 'Integration not found. Please try again later.' };
    }

    // Fetch the integration to get the access_token
    const integrationRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/${integrationId}`);
    if (!integrationRes.ok) {
      return { blocks: [], error: 'Content source not found. Please try again later.' };
    }

    const integration = await integrationRes.json();
    const accessToken = integration?.access_token;
    if (!accessToken) {
      return { blocks: [], error: 'Content access not available. Please try again later.' };
    }

    // Fetch the page content using the access token
    const response = await fetch(`/api/integrations/fetchPageBlocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: integrationBlock.props.resource_id,
        token: accessToken
      }),
    });

    if (!response.ok) {
      return { blocks: [], error: 'Failed to load content. Please try again later.' };
    }

    const data = await response.json();
    const fetchedBlocks = data.ok && data.data ? data.data : [];

    // Also fetch the current page title
    let updatedTitle = integrationBlock.props.resource_name; // Fallback to existing title
    try {
      const titleResponse = await fetch(`/api/integrations/fetchPage?token=${encodeURIComponent(accessToken)}&pageId=${encodeURIComponent(integrationBlock.props.resource_id)}`);
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        if (titleData.page) {
          updatedTitle = titleData.page.properties?.title?.title?.[0]?.plain_text || integrationBlock.props.resource_name;
        }
      }
    } catch (error) {
      console.error('Error fetching page title:', error);
      // Keep the existing title if fetch fails
    }

    return {
      blocks: fetchedBlocks,
      error: fetchedBlocks ? null : 'Content could not be loaded. Please try again later.',
      updatedTitle: updatedTitle
    };
  } catch {
    return { blocks: [], error: 'Unable to load content. Please try again later.' };
  }
};

// Function to create a integration block
export const createIntegrationBlock = (
  integrationId: string,
  pageId: string,
  pageTitle: string,
  integrationType: string,
  blocks?: any[],
  position?: number
): IntegrationBlock => {
  return {
    id: uuidv4(),
    type: integrationType,
    content: blocks || [],
    props: {
      integration_id: integrationId,
      resource_name: pageTitle,
      resource_id: pageId,
    },
    position: position || 0
  };
};

// Function to get user's integration
export const getUserIntegration = async (userId: string, integrationType: string) => {
  try {
    const integrationsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=${userId}`);
    if (!integrationsResponse.ok) {
      throw new Error('Failed to fetch integrations');
    }

    const integrations = await integrationsResponse.json();
    const integration = integrations.find((integration: any) => integration.integration_type === integrationType);

    return integration || null;
  } catch (error) {
    console.error('Error fetching user integration:', error);
    return null;
  }
};

// Function to handle page selection (for editor mode)
export const handleIntegrationPageSelection = async (
  pageId: string,
  pageTitle: string,
  userId: string,
  integrationType: string,
  onContentUpdate: (content: any[]) => void,
  onBlocksUpdate: (blocks: any[]) => void,
  onError: (error: string) => void
) => {
  try {
    const integration = await getUserIntegration(userId, integrationType);
    if (!integration) {
      onError('No integration found');
      return;
    }

    // Fetch the page content
    const response = await fetch(`/api/integrations/fetchPageBlocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: pageId,
        token: integration.access_token
      }),
    });

    if (!response.ok) {
      onError('Failed to fetch page content');
      return;
    }

    const data = await response.json();
    const fetchedBlocks = data.ok && data.data ? data.data : [];

    // Create the integration block with the fetched blocks
    const integrationBlock = createIntegrationBlock(
      integration.id,
      pageId,
      pageTitle,
      integrationType,
      fetchedBlocks,
    );

    // Replace all existing content with just the integration block
    const newContent = [integrationBlock];
    onContentUpdate(newContent);

  } catch (error) {
    console.error('Error handling page selection:', error);
    // Don't add any content on error
    onContentUpdate([]);
    onBlocksUpdate([]);
  }
};

// Function to handle page removal
export const handleIntegrationPageRemoval = (
  onContentUpdate: (content: any[]) => void,
  onBlocksUpdate: (blocks: any[]) => void
) => {
  // Clear all content and blocks when unlinking
  onContentUpdate([]);
  onBlocksUpdate([]);
};

// Function to handle Notion link clicks
export const handleNotionLinkClick = (
  event: React.MouseEvent,
  integrationBlocks: any[]
) => {
  const target = event.target as HTMLElement;
  
  // Check if the clicked element is a link
  if (target.tagName === 'A' || target.closest('a')) {
    const link = target.tagName === 'A' ? target as HTMLAnchorElement : target.closest('a') as HTMLAnchorElement;
    
    if (link) {
      const href = link.getAttribute('href');
      
      // Check if this is a relative link that should be treated as external
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        const pageId = href.replace(/^\//, '');
        
        if (pageId) {
          event.preventDefault();
          event.stopPropagation();
          
          let notionUrl = null;
          if (integrationBlocks && integrationBlocks.length > 0) {
            for (const block of integrationBlocks) {
              if (block.id === pageId && block.child_page && block.child_page.page && block.child_page.page.public_url) {
                notionUrl = block.child_page.page.public_url;
                break;
              }
            }
          }
          
          // Open the link in a new tab
          window.open(notionUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      }
    }
  }
};

// Function to compare Notion blocks and detect changes
export const compareNotionBlocks = (
  storedBlocks: any[],
  fetchedBlocks: any[]
): boolean => {
  // Handle empty arrays
  if (storedBlocks.length === 0 && fetchedBlocks.length === 0) {
    return false;
  }
  
  if ((storedBlocks.length === 0) !== (fetchedBlocks.length === 0)) {
    return true;
  }
  
  if (storedBlocks.length !== fetchedBlocks.length) {
    return true;
  }
  
  // Normalize blocks to ignore timestamps and IDs
  const normalizeBlocks = (blocks: any[]) => {
    return blocks.map(block => {
      const normalized = { ...block };
      delete normalized.last_edited_time;
      delete normalized.created_time;
      
      // Remove all IDs from any rich_text arrays in any block type
      const removeIdsFromRichText = (obj: any) => {
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(key => {
            if (key === 'rich_text' && Array.isArray(obj[key])) {
              obj[key] = obj[key].map((text: any) => {
                const normalizedText = { ...text };
                delete normalizedText.id;
                return normalizedText;
              });
            } else if (typeof obj[key] === 'object') {
              removeIdsFromRichText(obj[key]);
            }
          });
        }
      };
      
      removeIdsFromRichText(normalized);
      return normalized;
    });
  };
  
  const normalizedStored = normalizeBlocks(storedBlocks);
  const normalizedFetched = normalizeBlocks(fetchedBlocks);
  
  return JSON.stringify(normalizedStored) !== JSON.stringify(normalizedFetched);
}; 