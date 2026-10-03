import { QueryClient } from '@tanstack/react-query'

/**
 * One cache for server state. Retries are off: every screen renders an explicit error state with
 * its own "Spróbuj ponownie" button, so silent retries would only hide problems and delay feedback.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})
