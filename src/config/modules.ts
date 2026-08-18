/**
 * Módulos institucionais exibidos na Home da Atlas Platform.
 *
 * A ordem e a rotulagem são intencionalmente genéricas — os fornecedores
 * reais (agenda, reuniões, drive etc.) são detalhes de configuração de
 * cada workspace e não devem vazar para a interface.
 */

import {
  BookOpen,
  Library,
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
};

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "manual",
    name: "Portal do Investidor",
    description:
      "Home do Portal do Investidor. O Manual é apenas o primeiro conteúdo da jornada.",
    icon: BookOpen,
    href: "/",
    external: true,
    status: "ativo",
  },
  {
    id: "biblioteca",
    name: "Biblioteca Corporativa",
    description:
      "Acervo institucional de arquivos do Portal. Abre a pasta oficial da Conta Google corporativa.",
    icon: Library,
    href: "https://drive.google.com/",
    external: true,
    status: "ativo",
  },
  {
    id: "greensales-sync",
    name: "GreenSales Sync",
    description:
      "Importação somente leitura dos leads criados hoje no GreenSales para o Portal Atlas.",
    icon: Download,
    to: "/executivo/greensales-sync",
    status: "ativo",
    requiresRole: ["super_admin"],
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
];
