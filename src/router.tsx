import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // NOTE: native-shell init is intentionally NOT called here. Mutating
  // <html> classes synchronously at router-create time (before React
  // hydration) caused a hydration mismatch on the root element, which made
  // React throw away the tree on first interaction — inputs lost focus
  // after one keystroke and click handlers stopped firing inside the
  // Capacitor WebView. The shell is now booted from <RootComponent> in a
  // useEffect, after hydration completes.
  return router;
};
