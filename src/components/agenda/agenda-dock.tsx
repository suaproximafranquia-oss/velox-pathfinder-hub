import { useCallback, useEffect, useState } from "react";
import { CalendarClock, X, Plus, Loader2, Lock } from "lucide-react";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  listAgenda,
  createAgendaEvent,
  deleteAgendaEvent,
} from "@/lib/agenda.functions";
import type { AgendaItem, AgendaPriority } from "@/lib/agenda-types";
import { toast } from "sonner";

/**
 * AGENDA OPERACIONAL GLOBAL — botão lateral fixo + painel deslizante.
 *
 * Abre SOBRE o ambiente atual: o executivo nunca sai da tela em que
 * está trabalhando. A Agenda apenas apresenta o que já existe
 * (compromissos próprios, reuniões e ações do motor de cadência).
 */

const PRIORITY_META: Record<AgendaPriority, { label: string; color: string }> = {
  maxima: { label: "Prioridade máxima", color: "var(--gold)" },
  media: { label: "Prioridade média", color: "#7aa2d6" },
  minima: { label: "Prioridade mínima", color: "#6b7280" },
};

function dayRange(days = 7) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  to.setHours(23, 59, 59, 999);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

export function AgendaDock() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { fromISO, toISO } = dayRange();
      // A identidade do executivo é resolvida NO SERVIDOR.
      const data = await listAgenda({ data: { fromISO, toISO } });
      setItems(data);
    } catch {
      toast.error("Não foi possível carregar a Agenda.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  if (!session) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Agenda"
        className="fixed right-0 top-1/2 z-[60] -translate-y-1/2 rounded-l-xl border border-r-0 border-[color:var(--gold)]/40 bg-[color:var(--navy-deep,#0b1220)] px-2 py-4 text-[10px] uppercase tracking-[0.28em] text-[color:var(--gold)] shadow-lg transition hover:bg-[color:var(--accent)]"
        style={{ writingMode: "vertical-rl" }}
      >
        <CalendarClock className="mx-auto mb-2 h-4 w-4 rotate-90" />
        Agenda
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-[color:var(--border)] bg-[color:var(--card,#0b1220)] text-[color:var(--foreground)] shadow-2xl">
            <header className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
                  Agenda Operacional
                </p>
                <h2 className="font-display text-lg">Próximos 7 dias</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar Agenda"
                className="rounded-lg border border-[color:var(--border)] p-2 hover:bg-[color:var(--accent)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <p className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda…
                </p>
              ) : items.length === 0 ? (
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  Nenhum compromisso ou ação para o período.
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                            {item.startsAt ? (
                              <>
                                {new Date(item.startsAt).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {item.endsAt
                                  ? ` — ${new Date(item.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                                  : ""}
                              </>
                            ) : (
                              /* Ações do dia não têm horário: nenhum é inventado. */
                              <>
                                {new Date(`${item.dateISO}T12:00:00`).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                })}{" "}
                                · Ação do dia (sem horário)
                              </>
                            )}
                          </p>
                          {item.note ? (
                            <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                              {item.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]"
                            style={{
                              color: PRIORITY_META[item.priority].color,
                              border: `1px solid ${PRIORITY_META[item.priority].color}55`,
                            }}
                          >
                            {PRIORITY_META[item.priority].label}
                          </span>
                          {item.readOnly ? (
                            <span
                              className="text-[color:var(--muted-foreground)]"
                              title="Registro de outro módulo — somente leitura"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                              onClick={async () => {
                                const res = await deleteAgendaEvent({ data: { id: item.id } });
                                if (res.ok) {
                                  toast.success("Compromisso removido.");
                                  void reload();
                                } else {
                                  toast.error("Não foi possível remover.");
                                }
                              }}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-[color:var(--border)] px-5 py-4">
              {creating ? (
                <AgendaForm
                  onCancel={() => setCreating(false)}
                  onCreated={() => {
                    setCreating(false);
                    void reload();
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--gold)]/40 px-4 py-2 text-sm text-[color:var(--gold)] hover:bg-[color:var(--accent)]"
                >
                  <Plus className="h-4 w-4" /> Novo compromisso
                </button>
              )}
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function AgendaForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [priority, setPriority] = useState<AgendaPriority>("maxima");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const field =
    "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-sm";

  async function submit() {
    setSaving(true);
    try {
      const res = await createAgendaEvent({
        data: {
          title,
          startsAt: new Date(`${date}T${start}:00`).toISOString(),
          endsAt: new Date(`${date}T${end}:00`).toISOString(),
          priority,
          note: note.trim() || null,
        },
      });
      if (res.ok) {
        toast.success("Compromisso registrado.");
        onCreated();
        return;
      }
      if (res.reason === "conflito") {
        toast.error(
          `Conflito de horário: já existe "${res.conflictWith}" às ${new Date(
            res.conflictAt,
          ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
        );
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Não foi possível gravar o compromisso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        className={field}
        placeholder="Título do compromisso"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" className={field} value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="time" className={field} value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <select
        className={field}
        value={priority}
        onChange={(e) => setPriority(e.target.value as AgendaPriority)}
      >
        <option value="maxima">Prioridade máxima — compromisso com horário</option>
        <option value="media">Prioridade média — atenção</option>
        <option value="minima">Prioridade mínima — acompanhamento</option>
      </select>
      <textarea
        className={field}
        rows={2}
        placeholder="Observação (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="flex-1 rounded-xl border border-[color:var(--gold)]/40 px-4 py-2 text-sm text-[color:var(--gold)] hover:bg-[color:var(--accent)] disabled:opacity-60"
        >
          {saving ? "Gravando…" : "Gravar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--muted-foreground)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
