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
    id: "comunicacao",
    name: "Central de Comunicação",
    description:
      "Feed de Notícias, templates oficiais e campanhas de relacionamento.",
    icon: Megaphone,
    to: "/executivo/comunicacao",
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
    id: "central-captacao",
    name: "Central de Captação",
    description:
      "Monitoramento das origens de aquisição de leads: Meta Ads, TikTok Ads, Google Ads e Portal Velox.",
    icon: Radar,
    to: "/executivo/captacao",
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
    requiresRole: ["super_admin"],
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
  {
    id: "biblioteca-conteudos",
    name: "Biblioteca de Conteúdos",
    description:
      "Acervo permanente dos materiais de valor usados pelo Motor de Relacionamento, organizados por grupo.",
    icon: Library,
    to: "/executivo/biblioteca",
    status: "ativo",
    requiresRole: ["super_admin", "diretora"],
  },
  {
    id: "central-backup",
    name: "Central de Backup",
    description:
      "Pontos de restauração do estado integral do Portal, com backup automático contínuo e restauração protegida.",
    icon: Database,
    to: "/executivo/central-backup",
    status: "ativo",
    requiresRole: ["super_admin"],
  },
  {
    id: "greensales-sync",
    name: "GreenSales Sync",
    description:
      "POC de importação somente leitura dos leads criados hoje no GreenSales para o Portal Atlas.",
    icon: Download,
    to: "/executivo/greensales-sync",
    status: "ativo",
    requiresRole: ["super_admin"],
  },
];

// Alusão explícita — `BarChart3` foi substituído por `FileBarChart2` para
// Relatórios; mantemos apenas os ícones efetivamente utilizados acima.
void BarChart3;