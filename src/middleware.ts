import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })
  
  // Define authentication paths
  const authRoutes = ['/login']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  
  // Public paths that don't require authentication
  const publicPaths = ['/api/auth']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  
  // If the path is public, allow access
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  // Redirect logic
  if (isAuthRoute) {
    if (token) {
      // Logged in users trying to access login page - redirect to home
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Allow non-logged in users to access auth pages
    return NextResponse.next()
  }
  
  // Protect other routes - redirect to login if not authenticated
  if (!token) {
    // Create login URL with the correct base URL
    const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL);
    
    // Create callback URL with both pathname and search params from the original request
    const callbackUrl = new URL(request.nextUrl.pathname, process.env.NEXT_PUBLIC_APP_URL);
    
    // Copy all search params from the original request to the callback URL
    request.nextUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    
    // Set the complete callback URL (with search params) as a parameter in the login URL
    loginUrl.searchParams.set('callbackUrl', encodeURI(callbackUrl.toString()));
    
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next()
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (for NextAuth.js)
     * - _next/static (for static files)
     * - _next/image (for Next.js Image optimization)
     * - favicon.ico (for favicon)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|images).*)',
  ],
} 