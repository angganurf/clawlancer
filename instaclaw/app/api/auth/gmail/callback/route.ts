import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Cookie name for the temporary Gmail access token
const GMAIL_TOKEN_COOKIE = "ic_gmail_token";
// Cookie name for CSRF state verification
const GMAIL_STATE_COOKIE = "ic_gmail_state";

// Token cookie max age: 5 minutes (only needed long enough to call insights API)
const TOKEN_MAX_AGE_SECONDS = 300;

/**
 * GET /api/auth/gmail/callback
 *
 * Handles the OAuth callback after the user grants gmail.readonly scope.
 * Exchanges the authorization code for an access token, stores it in a
 * short-lived httpOnly cookie (never in the URL), then redirects back to
 * the Gmail connect page.
 *
 * Security:
 * - Validates the OAuth `state` parameter against the cookie set before
 *   the redirect (CSRF protection).
 * - The access token is stored in an httpOnly, Secure, SameSite=Lax cookie
 *   that the browser cannot read via JavaScript — only our API route can.
 * - The cookie expires after 5 minutes and is cleared after use.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  // ── CSRF: Validate state parameter ──────────────────────────────
  const stateCookie = req.cookies.get(GMAIL_STATE_COOKIE)?.value;
  if (!state || !stateCookie || state !== stateCookie) {
    logger.error("Gmail OAuth CSRF mismatch", {
      hasState: !!state,
      hasCookie: !!stateCookie,
      userId: session.user.id,
      route: "gmail/callback",
    });
    const res = NextResponse.redirect(
      new URL("/gmail-connect?error=csrf_mismatch", req.url)
    );
    // Clear the state cookie
    res.cookies.set(GMAIL_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }

  // User denied the permission
  if (error) {
    logger.warn("Gmail OAuth denied", {
      error,
      userId: session.user.id,
      route: "gmail/callback",
    });
    const res = NextResponse.redirect(new URL("/gmail-connect", req.url));
    res.cookies.set(GMAIL_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }

  if (!code) {
    logger.error("Gmail OAuth callback missing code", {
      userId: session.user.id,
      route: "gmail/callback",
    });
    const res = NextResponse.redirect(new URL("/gmail-connect", req.url));
    res.cookies.set(GMAIL_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/gmail/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      logger.error("Gmail token exchange failed", {
        status: tokenRes.status,
        body: errBody,
        route: "gmail/callback",
      });
      const res = NextResponse.redirect(
        new URL("/gmail-connect?error=token_exchange_failed", req.url)
      );
      res.cookies.set(GMAIL_STATE_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      logger.error("Gmail token exchange returned no access_token", {
        route: "gmail/callback",
      });
      const res = NextResponse.redirect(
        new URL("/gmail-connect?error=no_token", req.url)
      );
      res.cookies.set(GMAIL_STATE_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }

    // ── Store token in httpOnly cookie (NOT in the URL) ───────────
    // This cookie is:
    // - httpOnly: JavaScript cannot read it
    // - secure: Only sent over HTTPS
    // - sameSite: Lax (sent on same-origin navigations)
    // - maxAge: 5 minutes (just long enough to call the insights API)
    const res = NextResponse.redirect(
      new URL("/gmail-connect?gmail_ready=1", req.url)
    );
    res.cookies.set(GMAIL_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE_SECONDS,
      path: "/",
    });
    // Clear the state cookie
    res.cookies.set(GMAIL_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    logger.error("Gmail callback error", {
      error: String(err),
      route: "gmail/callback",
    });
    const res = NextResponse.redirect(
      new URL("/gmail-connect?error=callback_failed", req.url)
    );
    res.cookies.set(GMAIL_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }
}
