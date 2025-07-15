import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy requests to Judge0 API for checking submission status
 * This avoids CORS issues when calling Judge0 directly from the browser
 */
export async function GET(request: NextRequest) {
  try {
    // Get the token and Judge0 URL from the query parameters
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      );
    }

    // Forward the request to Judge0
    const response = await fetch(
      `${process.env.JUDGE0_API_URL}/submissions/${token}?base64_encoded=true&fields=status_id,stdout,stderr,compile_output,message,time`
    );

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

    // Helper to decode base64 fields
    function decodeBase64Field(field: any) {
      if (typeof field === 'string') {
        try {
          return Buffer.from(field, 'base64').toString('utf-8');
        } catch (e) {
          // If decoding fails, return the original value
          return field;
        }
      }
      return field;
    }

    // Decode relevant fields
    const judge0DecodedResponse = {
      ...data,
      stdout: decodeBase64Field(data.stdout),
      stderr: decodeBase64Field(data.stderr),
      compile_output: decodeBase64Field(data.compile_output),
      message: decodeBase64Field(data.message),
    };

    // Return the decoded data from Judge0
    return NextResponse.json(judge0DecodedResponse);
  } catch (error) {
    console.error('Error in code status API route:', error);
    return NextResponse.json(
      { error: `Server error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 