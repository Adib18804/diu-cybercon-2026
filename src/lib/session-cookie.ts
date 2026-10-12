// =============================================================================
// Session cookie contract — single source of truth.
//
// Auth.js derives the JWT encryption key from the COOKIE NAME itself
// (HKDF salt = options.cookies.sessionToken.name at mint time, and the same
// name at decode time). The middleware's getToken() must therefore be given
// the EXACT same cookie name + salt; otherwise it cannot find/decode the
// session and treats signed-in users as anonymous.
//
// This bit us once: auth.ts used a custom name while middleware relied on the
// library default (`authjs.session-token`), so every protected route bounced
// valid sessions back to /login. Import these constants everywhere instead of
// hardcoding the name.
//
// This module has NO imports — safe for the Edge runtime (middleware).
// =============================================================================

export const USE_SECURE_SESSION_COOKIE = process.env.NODE_ENV === "production"

export const SESSION_COOKIE_NAME = USE_SECURE_SESSION_COOKIE
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token"
