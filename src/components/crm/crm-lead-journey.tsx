import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  History,
  Loader2,
  MessageSquare,
  Phone,
  StickyNote,
} from "lucide-react";
import { CrmRecordSection } from "@/components/crm/crm-conversation";
import { jornadaDoLead, registrarNotaDoLead } from "@/lib/relationship/library.functions";

type JourneyEntry = {
  id: string;
  at: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  origin: string;
  actor?: string | null;
  step?: string | null;
  version?: number | null;
  simulated?: boolean;
};

const ORIGIN_LABEL: Record<string, string> = {
  motor: "Cadência",
  executivo: "Executivo",
  remarketing: "Remarketing",
  portal: "Portal",
  workspace: "Workspace",
  crm: "CRM",
  cadencia: "Cadência",
  portal_leads: "Portal dos Leads",
};

/** Conteúdos curtos aparecem inteiros; longos ganham prévia + expansão. */
const PREVIEW_LIMIT = 120;

function formatMoment(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} — ${hh}:${mi}`;
}

function dotTone(kind: string): string {
  if (kind === "mensagem_enviada" || kind === "e20") return "bg-emerald-500";
  if (kind === "mensagem_recebida") return "bg-sky-500";
  if (kind === "ligacao") return "bg-amber-500";
  if (kind === "nota") return "bg-violet-500";
  if (kind === "remarketing") return "bg-fuchsia-500";
  if (kind === "oportunidade") return "bg-yellow-500";
  return "bg-[color:var(--crm-border)]";
}

function EntryRow({ entry }: { entry: JourneyEntry }) {
  const [open, setOpen] = useState(false);
  const body = (entry.body ?? "").trim();
  const long = body.length > PREVIEW_LIMIT;
  const preview = long ? `${body.slice(0, PREVIEW_LIMIT).trimEnd()}…` : body;

  return (
    <li className="relative pl-5">
      <span
        className={`absolute left-0 top-[6px] h-2 w-2 rounded-full ${dotTone(entry.kind)}`}
        aria-hidden
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-[color:var(--crm-foreground)]">
          {entry.title}
          {entry.version != null ? (
            <span className="ml-1 text-[10px] font-normal text-[color:var(--crm-muted)]">
              v{entry.version}
            </span>
          ) : null}
        </p>
        <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--crm-muted)]">
          {formatMoment(entry.at)}
        </span>
      </div>
      {entry.subtitle && entry.subtitle !== body ? (
        <p className="text-[11px] text-[color:var(--crm-muted)]">{entry.subtitle}</p>
      ) : null}
      {body ? (
        <div className="mt-0.5">
          <p className="whitespace-pre-wrap text-[11px] text-[color:var(--crm-muted)]">
            {open ? body : preview}
          </p>
          {long ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium text-[color:var(--crm-accent)]"
            >
              <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
              {open ? "Recolher" : "Ver mensagem completa"}
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[color:var(--crm-muted)]/70">
        {ORIGIN_LABEL[entry.origin] ?? entry.origin}
        {entry.actor ? ` · ${entry.actor}` : ""}
        {entry.simulated ? " · simulada" : ""}
      </p>
    </li>
  );
}

/**
 * JORNADA CONSOLIDADA — leitura única e cronológica do lead.
 *
 * Reúne Portal, Workspace, Cadência e Remarketing em uma só história.
 * O texto exibido é sempre o SNAPSHOT congelado no envio: editar a
 * Biblioteca no futuro não reescreve o passado.
 */
export function CrmLeadJourney({ investorId }: { investorId: string }) {
  const [entries, setEntries] = useState<JourneyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jornadaDoLead({ data: { leadId: investorId } });
      setEntries(data as JourneyEntry[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a jornada.");
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNote() {
    if (!note.trim() || saving) return;
    setSaving(true);
    try {
      await registrarNotaDoLead({ data: { leadId: investorId, note } });
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a nota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrmRecordSection title="Jornada do investidor" tone="azul" icon={History}>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Nota do executivo…"
            className="min-w-0 flex-1 resize-none rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-2 py-1.5 text-[11px] outline-none focus:border-[color:var(--crm-accent)]"
          />
          <button
            type="button"
            onClick={() => void addNote()}
            disabled={!note.trim() || saving}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <StickyNote className="h-3.5 w-3.5" /> Salvar
          </button>
        </div>

        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}

        {loading ? (
          <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--crm-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando jornada…
          </p>
        ) : entries.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--crm-muted)]">
            <MessageSquare className="h-3.5 w-3.5" /> Nenhum evento registrado até agora.
          </p>
        ) : (
          <ol className="max-h-[420px] space-y-3 overflow-y-auto border-l border-[color:var(--crm-border)] pl-1 pr-1">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}

        <p className="flex items-center gap-1 text-[10px] text-[color:var(--crm-muted)]/70">
          <Phone className="h-3 w-3" /> Ligações e eventos simples ficam compactos; mensagens
          longas abrem o conteúdo exato que foi enviado.
        </p>
      </div>
    </CrmRecordSection>
  );
}
