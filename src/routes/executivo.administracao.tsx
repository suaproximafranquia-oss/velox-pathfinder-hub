import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Settings,
  Sliders,
  FolderOpen,
  ShieldCheck,
  Users2,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { can } from "@/lib/governance";
import {
  getSettings,
  updateSettings,
  type PlatformSettings,
} from "@/lib/platform-settings";
import {
  createCustomField,
  listCustomFields,
  removeCustomField,
  CUSTOM_FIELD_ENTITY_LABEL,
  CUSTOM_FIELD_TYPE_LABEL,
  type CustomField,
  type CustomFieldEntity,
  type CustomFieldType,
} from "@/lib/custom-fields";
import { onEvent } from "@/lib/events/bus";

export const Route = createFileRoute("/executivo/administracao")({
  head: () => ({
    meta: [
      { title: "Administração — Portal Velox" },
      {
        name: "description",
        content:
          "Central única de administração do Portal Velox: configurações gerais, campos personalizados, base de conhecimento, centro de recursos e governança.",
      },
    ],
  }),
  component: AdministracaoPage,
});

function AdministracaoPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session) return null;
  const role = session.activeRole;

  if (!can(role, "admin.settings.manage") && !can(role, "admin.customFields.manage")) {
    return (
      <ExecutiveShell session={session} title="Administração">
        <div className="max-w-2xl mx-auto py-16 text-center text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mx-auto h-8 w-8 mb-3 text-[color:var(--gold)]" />
          Acesso restrito a Administradores e Gestores.
        </div>
      </ExecutiveShell>
    );
  }

  return (
    <ExecutiveShell session={session} title="Administração">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        <header className="flex items-start gap-3">
          <Settings className="h-6 w-6 text-[color:var(--gold)] mt-1" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Governança
            </p>
            <h1 className="font-display text-3xl">Administração da Plataforma</h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-1 max-w-2xl">
              Camada única de configuração, permissões, campos personalizados,
              base de conhecimento e centro de recursos. Toda alteração é
              registrada na Central de Auditoria.
            </p>
          </div>
        </header>

        <AdminHub role={role} />

        {can(role, "admin.settings.manage") && (
          <GeneralSettingsCard session={session} />
        )}

        {can(role, "admin.customFields.manage") && (
          <CustomFieldsCard session={session} />
        )}
      </div>
    </ExecutiveShell>
  );
}

function AdminHub({ role }: { role: ExecutiveSession["activeRole"] }) {
  const items = [
    {
      to: "/executivo/usuarios",
      icon: Users2,
      title: "Usuários & Perfis",
      desc: "Gestão de usuários, perfis e permissões.",
      show: can(role, "admin.users.manage"),
    },
    {
      to: "/executivo/recursos",
      icon: FolderOpen,
      title: "Centro de Recursos",
      desc: "Ativos institucionais reutilizáveis.",
      show: can(role, "resources.manage"),
    },
    {
      to: "/executivo/configuracoes",
      icon: Sliders,
      title: "Preferências do Workspace",
      desc: "Identidade visual e integrações.",
      show: can(role, "admin.settings.manage"),
    },
  ].filter((i) => i.show);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-4 hover:border-[color:var(--gold)]/50 transition"
        >
          <div className="flex items-start gap-3">
            <it.icon className="h-5 w-5 text-[color:var(--gold)] mt-0.5" />
            <div className="min-w-0">
              <p className="font-display text-base">{it.title}</p>
              <p className="text-xs text-[color:var(--muted-foreground)] mt-1 leading-relaxed">
                {it.desc}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}

function GeneralSettingsCard({ session }: { session: ExecutiveSession }) {
  const [settings, setSettings] = useState<PlatformSettings>(() =>
    getSettings(session.workspaceId),
  );
  const [saved, setSaved] = useState(false);

  function save() {
    const next = updateSettings(session.workspaceId, settings, {
      id: session.userId,
      name: session.name,
      role: session.activeRole,
    });
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const toggle = (key: keyof PlatformSettings["features"]) =>
    setSettings((s) => ({
      ...s,
      features: { ...s.features, [key]: !s.features[key] },
    }));

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sliders className="h-4 w-4 text-[color:var(--gold)]" />
        <h2 className="font-display text-lg">Configurações Gerais</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nome institucional" value={settings.institutionalName}
          onChange={(v) => setSettings({ ...settings, institutionalName: v })} />
        <Field label="E-mail de suporte" value={settings.supportEmail}
          onChange={(v) => setSettings({ ...settings, supportEmail: v })} />
        <Field label="Tagline da IA" value={settings.aiTagline}
          onChange={(v) => setSettings({ ...settings, aiTagline: v })} full />
        <Field label="Disclaimer da IA" value={settings.aiDisclaimer}
          onChange={(v) => setSettings({ ...settings, aiDisclaimer: v })} full textarea />
      </div>
      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
          Funcionalidades ativas
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(settings.features) as (keyof PlatformSettings["features"])[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={[
                "text-xs px-3 py-1.5 rounded-full border transition",
                settings.features[k]
                  ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-[color:var(--foreground)]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
              ].join(" ")}
            >
              {featureLabel(k)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-full bg-[color:var(--gold)] px-5 py-2 text-sm font-medium text-[color:var(--brand-blue-deep)] hover:brightness-105 transition"
        >
          Salvar configurações
        </button>
        {saved && (
          <span className="text-xs text-[color:var(--muted-foreground)]">
            Alterações registradas na auditoria.
          </span>
        )}
      </div>
    </section>
  );
}

function featureLabel(key: keyof PlatformSettings["features"]): string {
  const map: Record<keyof PlatformSettings["features"], string> = {
    iaCorporativa: "IA Corporativa",
    baseConhecimento: "Base de Conhecimento",
    centroRecursos: "Centro de Recursos",
    camposPersonalizados: "Campos Personalizados",
    auditoriaExpandida: "Auditoria Expandida",
  };
  return map[key];
}

function Field({
  label,
  value,
  onChange,
  full,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
  textarea?: boolean;
}) {
  return (
    <label className={"flex flex-col gap-1 " + (full ? "md:col-span-2" : "") }>
      <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--gold)]/60"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--gold)]/60"
        />
      )}
    </label>
  );
}

function CustomFieldsCard({ session }: { session: ExecutiveSession }) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [entity, setEntity] = useState<CustomFieldEntity>("investidor");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [required, setRequired] = useState(false);

  const refresh = () => setFields(listCustomFields(session.workspaceId));

  useEffect(() => {
    refresh();
    return onEvent((e) => {
      if (e.type.startsWith("admin.customField.")) refresh();
    });
  }, [session.workspaceId]);

  const grouped = useMemo(() => {
    const map = new Map<CustomFieldEntity, CustomField[]>();
    for (const f of fields) {
      const list = map.get(f.entity) ?? [];
      list.push(f);
      map.set(f.entity, list);
    }
    return map;
  }, [fields]);

  function add() {
    const clean = label.trim();
    if (!clean) return;
    createCustomField(
      {
        workspaceId: session.workspaceId,
        entity,
        label: clean,
        type,
        required,
        visibility: "restrito",
      },
      { id: session.userId, name: session.name, role: session.activeRole },
    );
    setLabel("");
    setRequired(false);
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks className="h-4 w-4 text-[color:var(--gold)]" />
        <h2 className="font-display text-lg">Campos Personalizados</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Entidade
          </span>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as CustomFieldEntity)}
            className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm"
          >
            {Object.entries(CUSTOM_FIELD_ENTITY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Rótulo
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Perfil de risco"
            className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            Tipo
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm"
          >
            {Object.entries(CUSTOM_FIELD_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-medium text-[color:var(--brand-blue-deep)] hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      <label className="inline-flex items-center gap-2 text-xs text-[color:var(--muted-foreground)] mb-4">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        Campo obrigatório
      </label>

      {grouped.size === 0 ? (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Nenhum campo personalizado cadastrado ainda.
        </p>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([ent, list]) => (
            <div key={ent}>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
                {CUSTOM_FIELD_ENTITY_LABEL[ent]}
              </p>
              <ul className="space-y-1.5">
                {list.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-[color:var(--foreground)]">
                        {f.label}{" "}
                        <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                          · {CUSTOM_FIELD_TYPE_LABEL[f.type]}
                          {f.required ? " · obrigatório" : ""}
                        </span>
                      </p>
                      <p className="text-[10px] text-[color:var(--muted-foreground)]">
                        chave: {f.key}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        removeCustomField(f.id, {
                          id: session.userId,
                          name: session.name,
                          role: session.activeRole,
                        })
                      }
                      className="rounded-full p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--gold)]"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}