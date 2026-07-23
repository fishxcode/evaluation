/**
 * Router (10.1) — URL prefix (/en|/zh) is the language source of truth. Root
 * '/' redirects to the Accept-Language-matched prefix. Each lang has the same
 * child routes. Search params typed per route.
 * 路由——URL 前缀（/en|/zh）是语言真源。根 '/' 按 Accept-Language 匹配前缀重定向。
 * 每种语言有相同子路由。
 */
import { createRootRoute, createRoute, createRouter, redirect, Outlet } from '@tanstack/react-router';
import type { Lang } from './i18n/translations.js';
import { LangProvider, detectLang } from './i18n/index.js';
import { Layout } from './components/Layout.js';
import { CompareBar } from './components/ModelCard.js';
import { ExplorerPage } from './pages/Explorer.js';
import { DetailPage } from './pages/Detail.js';
import { PricingPage } from './pages/Pricing.js';
import { LabsPage } from './pages/Labs.js';
import { DashboardPage } from './pages/Dashboard.js';
import { ComparePage } from './pages/Compare.js';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

// Root redirect: '/' → '/{detected}/models' (Accept-Language proxy) / 根重定向
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: `/${detectLang()}/models` }); },
});

/** Build the route subtree for one language / 为一种语言构建路由子树 */
function langRoutes(lang: Lang) {
  const langRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: `/${lang}`,
    component: () => (
      <LangProvider lang={lang}>
        <Layout><Outlet /></Layout>
        <CompareBar />
      </LangProvider>
    ),
  });

  const idx = createRoute({ getParentRoute: () => langRoute, path: '/', beforeLoad: () => { throw redirect({ to: `/${lang}/models` }); } });
  const explorer = createRoute({ getParentRoute: () => langRoute, path: 'models', component: ExplorerPage, validateSearch: (s: Record<string, unknown>) => s });
  const detail = createRoute({ getParentRoute: () => langRoute, path: 'models/$lab/$slug', component: DetailPage });
  const pricing = createRoute({ getParentRoute: () => langRoute, path: 'pricing', component: PricingPage });
  const labs = createRoute({ getParentRoute: () => langRoute, path: 'labs', component: LabsPage });
  const dashboard = createRoute({ getParentRoute: () => langRoute, path: 'dashboard', component: DashboardPage });
  const compare = createRoute({ getParentRoute: () => langRoute, path: 'compare', component: ComparePage, validateSearch: (s: Record<string, unknown>) => s });

  return langRoute.addChildren([idx, explorer, detail, pricing, labs, dashboard, compare]);
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  langRoutes('en'),
  langRoutes('zh'),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
