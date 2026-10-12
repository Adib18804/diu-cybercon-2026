// =============================================================================
// NextAuth v5 route handler
// Handles all /api/auth/* NextAuth endpoints (signin, signout, session, etc.)
// =============================================================================

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
