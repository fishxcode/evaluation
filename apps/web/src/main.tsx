/**
 * App entry — wires React Query, Theme, Compare providers, and the router.
 * 应用入口——装配 React Query、Theme、Compare Provider 及路由。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router.js';
import { ThemeProvider } from './lib/theme.js';
import { CompareProvider } from './lib/compare.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CompareProvider>
          <RouterProvider router={router} />
        </CompareProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
