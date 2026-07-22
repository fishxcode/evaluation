import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppShell } from "./components/AppShell";
import { AdminPage } from "./pages/AdminPage";
import { BenchmarksPage } from "./pages/BenchmarksPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExplorerPage } from "./pages/ExplorerPage";
import { LabsPage } from "./pages/LabsPage";
import { ModelDetailPage } from "./pages/ModelDetailPage";
import { PricingPage } from "./pages/PricingPage";
import { normalizeLocale } from "./lib/i18n";

function preferredLocale() {
  const languages =
    typeof navigator === "undefined"
      ? []
      : [navigator.language, ...(navigator.languages ?? [])];
  return languages.some((language) => language?.toLowerCase().startsWith("zh"))
    ? "zh"
    : "en";
}

const rootRoute = createRootRoute({
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({
      to: "/$locale/models",
      params: { locale: preferredLocale() },
    });
  },
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin",
  component: AdminPage,
});

const localeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$locale",
  beforeLoad: ({ params }) => {
    const locale = normalizeLocale(params.locale);
    if (params.locale !== locale) {
      throw redirect({ to: "/$locale/models", params: { locale } });
    }
    return { locale };
  },
  component: Outlet,
});

const localeIndexRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "/",
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$locale/models", params });
  },
});

const modelsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "models",
  component: ExplorerPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "dashboard",
  component: DashboardPage,
});

const modelDetailRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "models/$modelId",
  component: ModelDetailPage,
});

const pricingRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "pricing",
  component: PricingPage,
});

const labsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "labs",
  component: LabsPage,
});

const benchmarksRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "benchmarks",
  component: BenchmarksPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  adminRoute,
  localeRoute.addChildren([
    localeIndexRoute,
    dashboardRoute,
    modelsRoute,
    modelDetailRoute,
    pricingRoute,
    labsRoute,
    benchmarksRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
