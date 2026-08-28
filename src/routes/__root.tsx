import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { JourneyChrome } from "../components/journey/journey-chrome";
import {
  EditorialShell,
  ExecutiveShellMarker,
  type EditorialVariant,
} from "../components/editorial/editorial-shell";
import { hasPortalSession } from "../lib/portal-session";
import { getPortalSession } from "../lib/portal-session";
import { isPortalUnlocked } from "../lib/portal-verification";
import { moduleForPath } from "../lib/portal-modules";
import { writeEntryContext } from "../lib/portal-entry";
import { WhatsAppFloating } from "../components/shared/whatsapp-floating";
import { JourneyTracker } from "../components/journey/journey-tracker";
import { HomologationGate } from "../components/portal/homologation-gate";
import { Toaster } from "../components/ui/sonner";
import { AgendaDock } from "../components/agenda/agenda-dock";
import { isOperationalPath } from "../lib/business-unit";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Manual do Investidor Velox — Franquia de Soluções Financeiras" },
      {
        name: "description",
        content:
          "Conheça o modelo de franquia Velox de soluções financeiras. Um manual transparente para você avaliar se essa oportunidade faz sentido para o seu momento.",
      },
      { name: "author", content: "Velox" },
      { property: "og:title", content: "Manual do Investidor Velox" },
      {
        property: "og:description",
        content:
          "Um manual completo para você entender a operação, os desafios e tomar uma decisão consciente sobre a franquia Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function resolveShell(pathname: string): EditorialVariant | "executive" {
  if (pathname.startsWith("/f/executivo")) return "executive";
  // O CRM é um ambiente operacional próprio — não herda o tema editorial.
  if (pathname.startsWith("/f/crm")) return "executive";
  // O Portal dos Leads é ambiente operacional do executivo.
  if (pathname.startsWith("/f/portal-leads")) return "executive";
  if (pathname.startsWith("/universo")) return "universo";
  if (pathname === "/") return "portal";
  return "manual";
}

function RootShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      {/*
        O tema editorial é aplicado já no HTML servido (primeiro frame),
        evitando qualquer troca visual perceptível — como a película azul
        do Hero da Home aparecendo depois da imagem.
      */}
      <body data-shell={resolveShell(pathname)}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <HomologationGate>
      <RootRoutes />
    </HomologationGate>
  );
}

function RootRoutes() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isExecutive = pathname.startsWith("/f/executivo");
  const isCrm = pathname.startsWith("/f/crm");
  const isLeadsPortal = pathname.startsWith("/f/portal-leads");
  const isPortal = pathname === "/";
  const isUniverso = pathname.startsWith("/universo");
  const isGateway = pathname === "/entrar";
  // Agenda Operacional Global: disponível em todo ambiente interno da
  // unidade de negócio (/f/executivo, /f/crm, /f/remarketing, /f/portal-leads).
  const showAgenda = isOperationalPath(pathname);

  /**
   * Arquitetura oficial: a Home é a única porta pública do Portal.
   * Qualquer rota interna acessada diretamente pelo navegador devolve o
   * visitante à Home, que executa o Gateway e reabre o módulo
   * solicitado como overlay. Dentro do overlay (iframe) a navegação
   * interna segue normal.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isExecutive || isCrm || isLeadsPortal || isPortal) return;
    const insideOverlay = window.self !== window.top;
    const mod = moduleForPath(pathname);
    if (!mod) return;
    // DEF 2.4.18 — acesso direto por URL nunca pode burlar o bloqueio:
    // apenas o Manual é livre para o Visitante Identificado.
    const unlocked = mod.key === "manual" || isPortalUnlocked(getPortalSession()?.investorId);
    if (insideOverlay && hasPortalSession() && unlocked) return;
    writeEntryContext({ pendingModule: mod.key });
    if (insideOverlay) {
      window.top?.location.replace(`/?m=${mod.key}`);
      return;
    }
    navigate({ to: "/", search: { m: mod.key }, replace: true });
  }, [isCrm, isExecutive, isLeadsPortal, isPortal, navigate, pathname]);

  // Área Executiva permanece isolada do Design System editorial.
  if (isExecutive) {
    return (
      <QueryClientProvider client={queryClient}>
        <ExecutiveShellMarker>
          <Outlet />
          {showAgenda ? <AgendaDock /> : null}
        </ExecutiveShellMarker>
        <Toaster />
      </QueryClientProvider>
    );
  }

  // O CRM de Relacionamento possui identidade própria: sem cabeçalho do
  // Manual, sem índice editorial e sem elementos institucionais.
  if (isCrm || isLeadsPortal) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        {showAgenda ? <AgendaDock /> : null}
        <Toaster />
      </QueryClientProvider>
    );
  }

  // Todos os módulos editoriais herdam o mesmo tema através do
  // componente <EditorialShell>. Novos módulos (Sede, Revista,
  // Experiências, Biblioteca, FAQ, …) recebem a variante correta
  // adicionando uma entrada abaixo — nenhum estilo é duplicado.
  const variant: EditorialVariant = isPortal ? "portal" : isUniverso ? "universo" : "manual";

  const content =
    isPortal || isUniverso || isGateway ? (
      <Outlet />
    ) : (
      <JourneyChrome>
        <Outlet />
      </JourneyChrome>
    );

  return (
    <QueryClientProvider client={queryClient}>
      <EditorialShell variant={variant}>{content}</EditorialShell>
      {!isGateway && <WhatsAppFloating />}
      {/* Registro silencioso da jornada — nunca interfere na navegação. */}
      <JourneyTracker />
      {showAgenda ? <AgendaDock /> : null}
      {/* Avisos de falha de gravação: nada mais é salvo em silêncio. */}
      <Toaster />
    </QueryClientProvider>
  );
}
