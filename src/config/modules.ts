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
  type LucideIcon,
} from "lucide-react";
import { Archive } from "lucide-react";

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
    id: "ia",
    name: "IA Corporativa",
    description: "Assistente corporativo para consultas guiadas ao ecossistema.",
    icon: Sparkles,
    to: "/executivo/ia",
    status: "ativo",
  },
  {
    id: "ia-criativa",
    name: "IA Criativa",
    description:
      "Produção automática de materiais oficiais dentro da identidade visual aprovada.",
    icon: Wand2,
    to: "/executivo/criativa",
    status: "ativo",
  },
  {
    id: "brain",
    name: "Brain Analytics",
    description:
      "Indicadores executivos consolidados a partir dos módulos da plataforma.",
    icon: Brain,
    to: "/executivo/brain",
    status: "ativo",
  },
  {
    id: "kpi",
    name: "KPI Manager",
    description:
      "Fonte oficial de indicadores. Alimenta o Brain, dashboards e a IA.",
    icon: Gauge,
    to: "/executivo/kpi",
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
    description:
      "Ambiente operacional de relacionamento com investidores. Abre em nova aba.",
    icon: Users2,
    href: "/crm",
    external: true,
    status: "ativo",
  },
  {
    id: "central-reunioes",
    name: "Central de Reuniões",
    description:
      "Gestão dos encontros da sua carteira — histórico, status e registros pós-reunião.",
    icon: Calendar,
    to: "/executivo/reunioes",
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
    id: "perfil",
    name: "Meu Perfil",
    description:
      "Dados pessoais, contato e aniversário — usados por reconhecimentos e notificações.",
    icon: UserCircle2,
    to: "/executivo/perfil",
    status: "ativo",
  },
  {
    id: "configuracoes",
    name: "Configurações",
    description:
      "Integrações, identidade visual, permissões e preferências do workspace.",
    icon: Settings,
    to: "/executivo/configuracoes",
    status: "ativo",
    requiresRole: ["super_admin", "diretora"],
  },
  {
    id: "auditoria",
    name: "Central de Auditoria",
    description:
      "Registro completo de ações administrativas — usuários, KPI, investidores e conhecimento.",
    icon: ShieldCheck,
    to: "/executivo/auditoria",
    status: "ativo",
    requiresRole: ["super_admin", "diretora"],
  },
  {
    id: "backups",
    name: "Backup de Conversas",
    description:
      "Registro permanente e somente leitura dos relacionamentos do CRM, com motivo obrigatório de abertura.",
    icon: Archive,
    to: "/executivo/backups",
    status: "ativo",
  },
];

// Alusão explícita — `BarChart3` foi substituído por `FileBarChart2` para
// Relatórios; mantemos apenas os ícones efetivamente utilizados acima.
void BarChart3;