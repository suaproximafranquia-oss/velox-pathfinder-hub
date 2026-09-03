/**
 * LANDING PAGE INSTITUCIONAL DO GRUPO VELOX (rota `/`).
 *
 * Página única com rolagem vertical. Não é ambiente operacional: sem
 * login, sem Gateway, sem cadência e sem acesso ao Portal do Investidor.
 * Todos os componentes são locais a `src/components/group/landing`.
 */
import { useEffect, useState } from "react";
import { GroupAbout } from "./group-about";
import { GroupCompanies } from "./group-companies";
import { GROUP_SECTIONS } from "./group-content";
import { GroupFooter } from "./group-footer";
import { GroupFranchiseCta } from "./group-franchise-cta";
import { GroupHeader } from "./group-header";
import { GroupHero } from "./group-hero";
import { GroupNumbers } from "./group-numbers";
import { GroupWhy } from "./group-why";

export function GroupLandingPage() {
  const [activeId, setActiveId] = useState<string>(GROUP_SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = GROUP_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-[#050b1a] text-white antialiased">
      <GroupHeader activeId={activeId} />
      <GroupHero />
      <GroupCompanies />
      <GroupWhy />
      <GroupAbout />
      <GroupNumbers />
      <GroupFranchiseCta />
      <GroupFooter />
    </main>
  );
}
