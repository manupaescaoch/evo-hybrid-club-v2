import { createMiddleware } from "@tanstack/react-start";
import { firebaseAuth } from "@/integrations/firebase/client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const user = firebaseAuth.currentUser;
    const token = user ? await user.getIdToken() : null;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
