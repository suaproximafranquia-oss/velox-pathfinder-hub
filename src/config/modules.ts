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
  Calendar,
  Video,
  BarChart3,
  Download,
  UserCircle2,
  Settings,
  Database,
  type LucideIcon,
} from "lucide-react";

export type PlatformModule = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Rota interna quando o módulo já está disponível. */
  to?: string;
  /** URL externa quando o módulo aponta para a jornada pública. */
  href?: string;
  status: "ativo" | "em_breve";
  /** Perfis mínimos com acesso. `undefined` = todos os perfis autenticados. */
  requiresRole?: Array<"super_admin" | "diretora" | "executivo">;
};

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "manual",
    name: "Manual do Investidor",
    description:
      "Material educativo para preparar o investidor antes do contato consultivo.",
    icon: BookOpen,
    href: "/",
    status: "ativo",
  },
  {
    id: "biblioteca",
    name: "Biblioteca Corporativa",
    description: "Acervo institucional de documentos, políticas e materiais oficiais.",
    icon: Library,
    status: "em_breve",
  },
  {
    id: "ia",
    name: "IA Corporativa",
    description: "Assistente corporativo para consultas guiadas ao ecossistema.",
    icon: Sparkles,
    to: "/executivo/ia",
    status: "ativo",
  },
  {
    id: "conhecimento",
    name: "Central de Conhecimento",
    description:
      "Base Oficial do Workspace — documentos que alimentam a IA e os módulos.",
    icon: Database,
    to: "/executivo/conhecimento",
    status: "ativo",
    requiresRole: ["super_admin", "diretora"],
  },
  {
    id: "crm",
    name: "CRM",
    description: "Gestão comercial e relacionamento com investidores e clientes.",
    icon: Users2,
    status: "em_breve",
  },
  {
    id: "agenda",
    name: "Agenda",
    description: "Organização de compromissos e agendamentos corporativos.",
    icon: Calendar,
    status: "em_breve",
  },
  {
    id: "reunioes",
    name: "Reuniões",
    description: "Sala virtual integrada para encontros consultivos e internos.",
    icon: Video,
    status: "em_breve",
  },
  {
    id: "relatorios",
    name: "Relatórios",
    description: "Indicadores e relatórios operacionais consolidados.",
    icon: BarChart3,
    status: "em_breve",
  },
  {
    id: "downloads",
    name: "Downloads",
    description: "Central de arquivos e materiais disponibilizados pelo workspace.",
    icon: Download,
    status: "em_breve",
  },
  {
    id: "perfil",
    name: "Meu Perfil",
    description: "Preferências pessoais, dados de acesso e ajustes individuais.",
    icon: UserCircle2,
    status: "em_breve",
  },
  {
    id: "configuracoes",
    name: "Configurações",
    description: "Parâmetros administrativos e preferências do workspace.",
    icon: Settings,
    status: "em_breve",
  },
];