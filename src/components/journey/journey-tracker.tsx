/**
 * Rastreador silencioso da jornada.
 *
 * Monta-se uma única vez no Portal e em todos os módulos editoriais.
 * Nunca bloqueia navegação, leitura, carregamentos ou animações: apenas
 * envia sinais de vida ao Journey Engine, que contabiliza somente tempo
 * EFETIVO de interação.
 */
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getCurrentInvestorId } from "@/lib/portal-session";
import { heartbeat, sweepIdleSessions, trackJourney, type JourneyModule } from "@/lib/journey/engine";
import { startIntegrationBridge } from "@/lib/journey/integrations";

function moduleForPathname(pathname: string): JourneyModule {
  if (pathname.startsWith("/manual")) return "manual";
  if (pathname.startsWith("/universo")) return "material";
  return "portal";
}

export function JourneyTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const moduleRef = useRef<JourneyModule>("portal");
  moduleRef.current = moduleForPathname(pathname);

  useEffect(() => startIntegrationBridge(), []);

  // Abertura de módulo — evento padronizado, nunca específico do módulo.
  useEffect(() => {
    const investorId = getCurrentInvestorId();
    if (!investorId) return;
    trackJourney({
      investorId,
      type: "journey.module.opened",
      module: moduleRef.current,
      detail: `Abriu ${moduleRef.current}`,
    });
    if (moduleRef.current === "material") {
      trackJourney({
        investorId,
        type: "material.viewed",
        detail: "Acessou o Material Institucional",
      });
    }
  }, [pathname]);

  // Sinais de vida: contam apenas quando a aba está visível e houve
  // interação real (mouse, teclado, toque ou rolagem) desde o último tick.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let interacted = true;
    const mark = () => {
      interacted = true;
    };
    const events = ["pointerdown", "keydown", "scroll", "mousemove", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, mark, { passive: true });

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !interacted) return;
      interacted = false;
      const investorId = getCurrentInvestorId();
      heartbeat(investorId, moduleRef.current);
      /**
       * ESPELHO DO SINAL DE LEITURA NO SERVIDOR — somente nos módulos do
       * material. É o que permite medir tempo efetivo de leitura do
       * material depois da disponibilização formal, reutilizando o
       * mesmo registro de jornada já existente (nenhum tracking novo).
       */
      if (investorId && (moduleRef.current === "material" || moduleRef.current === "manual")) {
        void import("@/lib/portal-access").then((m) =>
          m.pushPortalProgress({
            investorId,
            event: "journey.heartbeat",
            module: moduleRef.current,
            detail: "Leitura em andamento",
          }),
        );
      }
    }, 15000);

    const sweep = window.setInterval(() => sweepIdleSessions(), 5 * 60 * 1000);

    return () => {
      for (const e of events) window.removeEventListener(e, mark);
      window.clearInterval(tick);
      window.clearInterval(sweep);
    };
  }, []);

  return null;
}