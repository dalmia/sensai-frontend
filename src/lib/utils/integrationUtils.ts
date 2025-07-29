// Types for integration
export interface IntegrationBlock {
  type: string;
  props: {
    integration_id: string;
    resource_name: string;
    resource_id: string;
    resource_type: string;
    integration_type: string;
  };
  id: string;
  position: number;
}

export interface IntegrationBlocksResult {
  blocks: any[];
  error: string | null;
}

// Function to fetch blocks from an integration block
export const fetchIntegrationBlocks = async (integrationBlock: IntegrationBlock): Promise<IntegrationBlocksResult> => {
  try {
    const integrationId = integrationBlock.props.integration_id;
    if (!integrationId) {
      return {
        blocks: [],
        error: 'Integration not found. Please try again later.'
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
      return {
        blocks: [],
        error: 'Failed to load content. Please try again later.'
      };
    }

    const data = await response.json();
    if (data.ok && data.data) {
      return {
        blocks: data.data,
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

// Function to create a integration block
export const createIntegrationBlock = (
  integrationId: string,
  pageId: string,
  pageTitle: string,
  integrationType: string
): IntegrationBlock => {
  return {
    type: "integration",
    props: {
      integration_id: integrationId,
      resource_name: pageTitle,
      resource_id: pageId,
      resource_type: "page",
      integration_type: integrationType,
    },
    id: `${integrationType}-integration-${Date.now()}`,
    position: 0
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

    // Create the integration block
    const integrationBlock = createIntegrationBlock(
      integration.id,
      pageId,
      pageTitle,
      integrationType
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