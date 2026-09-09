/**
 * Módulos institucionais exibidos na Home da Atlas Platform.
 *
 * A ordem e a rotulagem são intencionalmente genéricas — os fornecedores
 * reais (agenda, reuniões, drive etc.) são detalhes de configuração de
 * cada workspace e não devem vazar para a interface.
 */

import {
  BookOpen,
  Sparkles,
  Users2,
  BarChart3,
  UserCircle2,
  Settings,
  Database,
  Brain,
  Gauge,
  FileBarChart2,
  ShieldCheck,
  Calendar,
  Sliders,
  Wand2,
  Megaphone,
  Radar,
  type LucideIcon,
} from "lucide-react";
import { Archive, Download } from "lucide-react";
import { unitPath, unitPathFor } from "@/lib/business-unit";

export type PlatformModule = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Rota interna quando o módulo já está disponível. */
  to?: string;
  /** URL externa (jornada pública ou integração de terceiros). */
  href?: string;
  /** Quando true, abre `href` em nova aba (integração externa). */
  external?: boolean;
  status: "ativo" | "em_breve";
  /** Perfis mínimos com acesso. `undefined` = todos os perfis autenticados. */
  requiresRole?: Array<"super_admin" | "diretora" | "executivo">;
  /**
   * Recurso do Workspace exigido para exibir o card. Usa exatamente a
   * mesma autorização do menu lateral — nenhuma permissão nova.
   */
  requiresResource?: "revista" | "apresentacao_digital";
};

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "manual",
    name: "Portal do Investidor",
    description:
      "Home do Portal do Investidor. O Manual é apenas o primeiro conteúdo da jornada.",
    icon: BookOpen,
    /** Portal do Investidor da própria unidade (Financeira = /f). */
    href: unitPathFor("financeira", "/").replace(/\/$/, ""),
    external: true,
    status: "ativo",
  },
  {
    id: "revista",
    name: "Revista Velox",
    description:
      "Edições institucionais da Revista Velox, em leitura de página dupla.",
    icon: BookOpen,
    to: unitPath("/executivo/revista"),
    status: "ativo",
    requiresResource: "revista",
  },
  {
    id: "apresentacao-digital",
    name: "Apresentação Digital",
    description:
      "Apresentação vigente do ambiente, com histórico preservado.",
    icon: Sparkles,
    to: unitPath("/executivo/apresentacao-digital"),
    status: "ativo",
    requiresResource: "apresentacao_digital",
  },
];


// Ícones mantidos apenas para compatibilidade de importação — os demais
// módulos vivem exclusivamente no menu lateral, sem duplicar atalhos.
void [
  Sparkles,
  Users2,
  BarChart3,
  UserCircle2,
  Settings,
  Database,
  Brain,
  Gauge,
  FileBarChart2,
  ShieldCheck,
  Calendar,
  Sliders,
  Wand2,
  Megaphone,
  Radar,
  Archive,
  Download,
];
