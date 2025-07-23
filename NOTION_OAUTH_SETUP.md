# Notion OAuth Setup Guide

This guide explains how to set up Notion OAuth integration for the application.

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Server-side environment variables (for API routes)
NOTION_CLIENT_ID=your_notion_client_id_here
NOTION_CLIENT_SECRET=your_notion_client_secret_here
NOTION_REDIRECT_URI=http://localhost:3000/api/notion/auth/callback

# Client-side environment variables (for frontend)
NEXT_PUBLIC_NOTION_CLIENT_ID=your_notion_client_id_here
NEXT_PUBLIC_NOTION_REDIRECT_URI=http://localhost:3000/api/notion/auth/callback
```

## Your .env.local should look like this:

Based on your credentials, your `.env.local` file should be:

```bash
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_REDIRECT_URI=http://localhost:3000/api/notion/auth/callback
NEXT_PUBLIC_NOTION_CLIENT_ID=
NEXT_PUBLIC_NOTION_REDIRECT_URI=http://localhost:3000/api/notion/auth/callback
```

**Note**: Remove the `OAUTH_` prefix from your variable names. The code expects `NOTION_CLIENT_ID` not `NOTION_OAUTH_CLIENT_ID`.

## Setup Instructions

1. **Create a Notion Integration**
   - Go to [https://developers.notion.com/](https://developers.notion.com/)
   - Click "View my integrations"
   - Click "New integration"
   - Select "Public" as the integration type
   - Fill in your integration details:
     - Name: Your app name
     - Logo: Optional
     - Description: Brief description of your app
     - Website: Your website URL
     - Redirect URI: `http://localhost:3000/api/notion/auth/callback` (for development)

2. **Get Your Credentials**
   - After creating the integration, go to the "Configuration" tab
   - Copy the "OAuth client ID" and "OAuth client secret"
   - Add these to your `.env.local` file

3. **Configure Redirect URI**
   - In your Notion integration settings, make sure the redirect URI matches exactly:
     - Development: `http://localhost:3000/api/notion/auth/callback`
     - Production: Update this to your production domain

## How It Works

1. **Authentication Flow**:
   - User clicks "Connect to Notion" button
   - They're redirected to Notion's OAuth authorization page
   - User selects which pages/databases to share with the app
   - Notion redirects back to your callback URL with an authorization code
   - Your server exchanges the code for an access token
   - The token is stored and used for API requests

2. **Page Selection**:
   - After authentication, the app fetches all accessible pages and databases
   - User can select any page from the dropdown
   - The selected page content is rendered using the existing rendering system

## Testing

1. Start the development server: `npm run dev`
2. Navigate to `/notion-test`
3. Toggle to "OAuth Flow" mode
4. Click "Connect to Notion"
5. Complete the OAuth flow
6. Select a page from the dropdown
7. Click "Fetch Blocks" to render the content

## Security Notes

- Never commit your `.env.local` file to version control
- Use different credentials for development and production
- The client secret should only be used on the server side
- Access tokens should be stored securely (consider using sessions/cookies in production) 