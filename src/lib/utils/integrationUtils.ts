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

    // Update the blocks for rendering
    onBlocksUpdate(fetchedBlocks);

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