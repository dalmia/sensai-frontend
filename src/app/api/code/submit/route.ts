import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy requests to Judge0 API for code submissions
 * This avoids CORS issues when calling Judge0 directly from the browser
 */
export async function POST(request: NextRequest) {
  throw new Error('Test error');

  // Parse the request body
  const payload = await request.json();
  
  // Forward the request to Judge0
  const response = await fetch(`${process.env.JUDGE0_API_URL}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // If the response wasn't successful, throw an error
  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Judge0 API error: ${response.status} ${errorText}` },
      { status: response.status }
    );
  }

  // Get the JSON response
  const data = await response.json();

  // Return the data from Judge0
  return NextResponse.json(data);

} 