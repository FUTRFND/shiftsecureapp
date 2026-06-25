import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initNativeShell } from "@/platform/native-shell";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // Native shell boots only inside Capacitor (no-op on web/SSR).
  if (typeof window !== "undefined") {
    void initNativeShell({ router: router as never });
  }

  return router;
};
