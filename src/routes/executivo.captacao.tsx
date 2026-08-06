/**
 * Central de Captação — painel de monitoramento das origens de leads.
 *
 * Não é um CRM e não substitui o Workspace: aqui o executivo apenas
 * acompanha de onde os leads estão chegando e administra as origens.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Radar,
  Activity,
  Clock,
  History,
  PlugZap,
  Settings2,
  Users2,
  X,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { onSync } from "@/lib/sync-bus";
import { cn } from "@/lib/utils";
import {
  ACQUISITION_SOURCES,
  buildAcquisitionSnapshot,
  elapsedSince,
  formatDateTime,
  loadSourceConfigs,
  loadSourceHistory,
  logSourceHistory,
  saveSourceConfig,
  sourceTone,
  subscribeAcquisition,
  testSourceConnection,
  type AcquisitionSourceDef,
  type AcquisitionSourceId,
  type SourceConfig,
} from "@/lib/acquisition/sources";

export const Route = createFileRoute("/executivo/captacao")({
  head: () => ({
    meta: [
      { title: "Central de Captação — Atlas Platform" },
      {
        name: "description",
        content:
          "Monitoramento das origens de aquisição de leads do Portal Velox: Meta Ads, TikTok Ads, Google Ads e Portal.",
      },
      { property: "og:title", content: "Central de Captação — Atlas Platform" },
      {
        property: "og:description",
        content: "Painel executivo das origens de captação de leads do Portal Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaptacaoPage,
});

const TONE_CLASS: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  red: "bg-red-500",
};

const TONE_LABEL: Record<string, string> = {
  green: "Recebendo leads",
  amber: "Conectado · sem leads hoje",
  red: "Desconectado",
};

function CaptacaoPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [configs, setConfigs] = useState(() => loadSourceConfigs());
  const [tick, setTick] = useState(0);
  const [configuring, setConfiguring] = useState<AcquisitionSourceDef | null>(null);
  const [historyOf, setHistoryOf] = useState<AcquisitionSourceDef | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  const refresh = useCallback(() => {
    setConfigs(loadSourceConfigs());
    setTick((v) => v + 1);
  }, []);

  useEffect(() => {
    refresh();
    const off = subscribeAcquisition(refresh);
    const offSync = onSync(() => refresh());
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      off();
      offSync();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const snapshot = useMemo(() => buildAcquisitionSnapshot(configs), [configs, tick]);

  if (!session) return null;

  const canManage = session.activeRole === "super_admin" || session.activeRole === "diretora";

  const cards = [
    { label: "Leads hoje", value: String(snapshot.today), icon: Users2 },
    { label: "Leads no mês", value: String(snapshot.month), icon: Activity },
    { label: "Último lead recebido", value: formatDateTime(snapshot.lastLeadAt), icon: Clock },
    {
      label: "Origens ativas",
      value: `${snapshot.activeSources}/${ACQUISITION_SOURCES.length}`,
      icon: PlugZap,
    },
    { label: "Tempo desde o último lead", value: elapsedSince(snapshot.lastLeadAt), icon: Radar },
  ];

  return (
    <ExecutiveShell session={session} title="Central de Captação">
      <p className="mb-8 flex items-center gap-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
        <Radar className="h-4 w-4 text-[color:var(--gold)]" />
        Monitoramento das origens de aquisição de leads. A operação comercial continua
        no CRM — aqui você acompanha de onde os investidores estão chegando.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <section
              key={card.label}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
                <Icon className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                {card.label}
              </p>
              <p className="mt-1 font-display text-xl leading-tight">{card.value}</p>
            </section>
          );
        })}
      </div>

      <h2 className="mt-10 mb-3 font-display text-lg">Origens de captação</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {ACQUISITION_SOURCES.map((def) => {
          const config = configs[def.id];
          const stats = snapshot.bySource[def.id];
          const tone = sourceTone(config, stats);
          return (
            <section
              key={def.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-base">{def.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
                    {def.description}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  <span className={cn("h-2 w-2 rounded-full", TONE_CLASS[tone])} />
                  {config.connected ? "Conectado" : "Desconectado"}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { k: "Hoje", v: String(stats.today) },
                  { k: "No mês", v: String(stats.month) },
                  { k: "Último recebimento", v: formatDateTime(stats.lastLeadAt) },
                  { k: "Último sincronismo", v: formatDateTime(config.lastSyncAt) },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2"
                  >
                    <dt className="text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                      {item.k}
                    </dt>
                    <dd className="mt-0.5 text-sm">{item.v}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">
                {TONE_LABEL[tone]}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => setConfiguring(def)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)] px-4 py-1.5 text-[11px] text-[color:var(--gold)] transition hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] disabled:opacity-40"
                >
                  <Settings2 className="h-3 w-3" /> Configurar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const result = testSourceConnection(def.id);
                    setFeedback(result.message);
                    refresh();
                  }}
                  className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
                >
                  Testar conexão
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOf(def)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
                >
                  <History className="h-3 w-3" /> Histórico
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {feedback ? (
        <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">{feedback}</p>
      ) : null}

      <p className="mt-8 text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
        Estrutura preparada para receber automaticamente leads de Meta Lead Ads, TikTok
        Lead Generation, Google Ads, landing pages e formulários do Portal Velox.
      </p>

      {configuring ? (
        <ConfigDialog
          def={configuring}
          config={configs[configuring.id]}
          onClose={() => setConfiguring(null)}
          onSaved={(message) => {
            setFeedback(message);
            refresh();
          }}
        />
      ) : null}

      {historyOf ? (
        <HistoryDialog def={historyOf} onClose={() => setHistoryOf(null)} />
      ) : null}
    </ExecutiveShell>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="font-display text-base">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full border border-[color:var(--border)] p-1.5 text-[color:var(--muted-foreground)] transition hover:border-[color:var(--gold)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfigDialog({
  def,
  config,
  onClose,
  onSaved,
}: {
  def: AcquisitionSourceDef;
  config: SourceConfig;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(config.values ?? {});
  const [connected, setConnected] = useState(config.connected);

  return (
    <Overlay title={`Configurar ${def.name}`} onClose={onClose}>
      <div className="space-y-3">
        {def.fields.map((field) => (
          <label key={field.id} className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {field.label}
            </span>
            <input
              type={field.secret ? "password" : "text"}
              value={values[field.id] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 pt-1 text-xs text-[color:var(--muted-foreground)]">
          <input
            type="checkbox"
            checked={connected}
            onChange={(e) => setConnected(e.target.checked)}
            className="accent-[color:var(--gold)]"
          />
          Origem ativa (recebendo leads)
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs transition hover:border-[color:var(--gold)]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            saveSourceConfig(def.id, { values, connected });
            logSourceHistory(
              def.id,
              "Configuração salva",
              connected ? "Origem ativada com novos parâmetros." : "Origem desativada.",
            );
            onSaved(`${def.name}: parâmetros salvos.`);
            onClose();
          }}
          className="rounded-full bg-[color:var(--gold)] px-4 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--gold-foreground)] transition hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </Overlay>
  );
}

function HistoryDialog({ def, onClose }: { def: AcquisitionSourceDef; onClose: () => void }) {
  const entries = loadSourceHistory(def.id);
  return (
    <Overlay title={`Histórico · ${def.name}`} onClose={onClose}>
      {entries.length === 0 ? (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Nenhum registro para esta origem ainda.
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-auto pr-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2"
            >
              <p className="text-xs">{entry.action}</p>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">{entry.detail}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                {formatDateTime(entry.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Overlay>
  );
}