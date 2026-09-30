import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { firebaseAdminAuth } from "@/integrations/firebase/admin.server";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    if (!request?.headers) throw new Error("Unauthorized: No request headers available");

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Bearer token required");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) throw new Error("Unauthorized: No token provided");

    try {
      const decoded = await firebaseAdminAuth.verifyIdToken(token);
      return next({
        context: {
          userId: decoded.uid,
          claims: decoded,
        },
      });
    } catch {
      throw new Error("Unauthorized: Invalid Firebase token");
    }
  },
);
