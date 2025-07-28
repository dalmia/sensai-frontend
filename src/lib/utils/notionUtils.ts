// Types for Notion integration
export interface NotionIntegrationBlock {
  type: string;
  props: {
    integration_id: string;
    resource_id: string;
    resource_type: string;
    integration_type: string;
  };
  id: string;
  position: number;
}

export interface NotionBlocksResult {
  blocks: any[];
  error: string | null;
}

// Function to fetch Notion blocks from an integration block
export const fetchNotionBlocks = async (integrationBlock: NotionIntegrationBlock): Promise<NotionBlocksResult> => {
  try {
    const integrationId = integrationBlock.props.integration_id;
    if (!integrationId) {
      return {
        blocks: [],
        error: 'Notion integration not found. Please try again later.'
      };
    }

    // Fetch the integration to get the access_token
    const integrationRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/${integrationId}`);
    if (!integrationRes.ok) {
      return {
        blocks: [],
        error: 'Content source not found. Please try again later.'
      };
    }

    const integration = await integrationRes.json();
    const accessToken = integration?.access_token;
    if (!accessToken) {
      return {
        blocks: [],
        error: 'Content access is not available. Please try again later.'
      };
    }

    // Fetch the Notion page content using the access token
    const notionResponse = await fetch(`/api/notion/fetchPage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: integrationBlock.props.resource_id,
        token: accessToken
      }),
    });

    if (!notionResponse.ok) {
      return {
        blocks: [],
        error: 'Failed to load content. Please try again later.'
      };
    }

    const notionData = await notionResponse.json();
    if (notionData.ok && notionData.data) {
      return {
        blocks: notionData.data,
        error: null
      };
    } else {
      return {
        blocks: [],
        error: 'Content could not be loaded. Please try again later.'
      };
    }
  } catch (error) {
    return {
      blocks: [],
      error: 'Unable to load content. Please try again later.'
    };
  }
};

// Function to create a Notion integration block
export const createNotionIntegrationBlock = (
  integrationId: string,
  pageId: string,
  pageTitle: string
): NotionIntegrationBlock => {
  return {
    type: "integration",
    props: {
      integration_id: integrationId,
      resource_id: pageId,
      resource_type: "page",
      integration_type: "notion",
    },
    id: `notion-integration-${Date.now()}`,
    position: 0
  };
};

// Function to get user's Notion integration
export const getUserNotionIntegration = async (userId: string) => {
  try {
    const integrationsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/integrations/?user_id=${userId}`);
    if (!integrationsResponse.ok) {
      throw new Error('Failed to fetch integrations');
    }

    const integrations = await integrationsResponse.json();
    const notionIntegration = integrations.find((integration: any) => integration.integration_type === 'notion');

    return notionIntegration || null;
  } catch (error) {
    console.error('Error fetching user Notion integration:', error);
    return null;
  }
};

// Function to handle Notion page selection (for editor mode)
export const handleNotionPageSelection = async (
  pageId: string,
  pageTitle: string,
  userId: string,
  onContentUpdate: (content: any[]) => void,
  onBlocksUpdate: (blocks: any[]) => void,
  onError: (error: string) => void
) => {
  try {
    const notionIntegration = await getUserNotionIntegration(userId);
    if (!notionIntegration) {
      onError('No Notion integration found');
      return;
    }

    // Fetch the Notion page content
    const notionResponse = await fetch(`/api/notion/fetchPage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: pageId,
        token: notionIntegration.access_token
      }),
    });

    if (!notionResponse.ok) {
      onError('Failed to fetch Notion page content');
      return;
    }

    // Create the integration block
    const integrationBlock = createNotionIntegrationBlock(
      notionIntegration.id,
      pageId,
      pageTitle
    );

    // Replace all existing content with just the integration block
    const newContent = [integrationBlock];
    onContentUpdate(newContent);

  } catch (error) {
    console.error('Error handling Notion page selection:', error);
    // Don't add any content on error
    onContentUpdate([]);
    onBlocksUpdate([]);
  }
};

// Function to handle Notion page removal
export const handleNotionPageRemoval = (
  onContentUpdate: (content: any[]) => void,
  onBlocksUpdate: (blocks: any[]) => void
) => {
  // Clear all content and blocks when unlinking
  onContentUpdate([]);
  onBlocksUpdate([]);
}; 