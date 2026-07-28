import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, MessageSquare, X } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  addMeetingNote,
  createMeeting,
  listMeetings,
  updateMeetingStatus,
  MEETING_STATUS_TONE,
  type Meeting,
  type MeetingStatus,
} from "@/lib/meetings";
import { loadLeads } from "@/lib/leads";
import { InvestorProfilePanel } from "@/components/executive/investor-profile-panel";

export const Route = createFileRoute("/executivo/reunioes")({
  head: () => ({
    meta: [
      { title: "Central de Reuniões — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeetingsPage,
});

const STATUS_FLOW: MeetingStatus[] = [
  "Agendada",
  "Confirmada",
  "Reagendada",
  "Em andamento",
  "Concluída",
  "Cancelada",
];

function MeetingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [items, setItems] = useState<Meeting[]>([]);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Meeting | null>(null);
  const [profileOpen, setProfileOpen] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  const refresh = () =>
    setItems(
      listMeetings(
        session ? { executiveId: session.userId } : undefined,
      ).sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1)),
    );

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Reuniões">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[color:var(--muted-foreground)] max-w-2xl">
          Gestão dos encontros com sua carteira. Toda reunião alimenta automaticamente o
          Perfil Inteligente do Investidor e a Central de Notificações.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 px-4 py-2 text-sm text-[color:var(--foreground)] hover:bg-[color:var(--accent)]"
        >
          <Plus className="h-4 w-4" /> Nova reunião
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-10 text-center text-sm text-[color:var(--muted-foreground)]">
          Nenhuma reunião registrada. Clique em "Nova reunião" para começar.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-[color:var(--gold)]" />
                    <button
                      type="button"
                      onClick={() => setProfileOpen(m.investorId)}
                      className="font-display text-base hover:text-[color:var(--gold)]"
                    >
                      {m.investorName}
                    </button>
                  </div>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {new Date(m.scheduledAt).toLocaleString("pt-BR")}
                  </p>
                  {m.cancelReason && (
                    <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
                      Motivo: {m.cancelReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase tracking-[0.22em] rounded-full px-2 py-1"
                    style={{
                      color: MEETING_STATUS_TONE[m.status],
                      border: `1px solid ${MEETING_STATUS_TONE[m.status]}`,
                    }}
                  >
                    {m.status}
                  </span>
                  <select
                    value={m.status}
                    onChange={(e) => {
                      const next = e.target.value as MeetingStatus;
                      const reason = next === "Cancelada" ? window.prompt("Motivo do cancelamento?") ?? undefined : undefined;
                      updateMeetingStatus(m.id, next, { cancelReason: reason, actorId: session.userId, actorName: session.name });
                      refresh();
                    }}
                    className="rounded-md border border-[color:var(--border)] bg-transparent px-2 py-1 text-xs"
                  >
                    {STATUS_FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setActive(m)}
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> {m.notes.length}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewMeetingDialog
          session={session}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {active && (
        <NotesDialog
          meeting={active}
          session={session}
          onClose={() => setActive(null)}
          onSaved={() => {
            refresh();
            setActive(null);
          }}
        />
      )}

      <InvestorProfilePanel
        investorId={profileOpen}
        open={!!profileOpen}
        onClose={() => setProfileOpen(null)}
      />
    </ExecutiveShell>
  );
}

function NewMeetingDialog({
  session,
  onClose,
  onCreated,
}: {
  session: ExecutiveSession;
  onClose: () => void;
  onCreated: () => void;
}) {
  const leads = useMemo(
    () => loadLeads().filter((l) => !l.responsibleExecutiveId || l.responsibleExecutiveId === session.userId),
    [session.userId],
  );
  const [investorId, setInvestorId] = useState(leads[0]?.id ?? "");
  const [customName, setCustomName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetUrl, setMeetUrl] = useState("");

  function submit() {
    if (!date || !time) return;
    const iso = new Date(`${date}T${time}:00`).toISOString();
    const lead = leads.find((l) => l.id === investorId);
    const inv = lead
      ? { investorId: lead.id, investorName: lead.name }
      : { investorId: `inv_${Date.now().toString(36)}`, investorName: customName || "Investidor" };
    createMeeting({
      ...inv,
      executiveId: session.userId,
      executiveName: session.name,
      scheduledAt: iso,
      meetUrl: meetUrl || undefined,
    });
    onCreated();
  }

  return (
    <Overlay onClose={onClose} title="Nova reunião">
      <div className="space-y-3 text-sm">
        {leads.length > 0 ? (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Investidor</span>
            <select
              value={investorId}
              onChange={(e) => setInvestorId(e.target.value)}
              className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
            >
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="">— Outro (informar nome) —</option>
            </select>
          </label>
        ) : null}
        {(leads.length === 0 || !investorId) && (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Nome do investidor</span>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Data</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2" />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Hora</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2" />
          </label>
        </div>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Link (opcional)</span>
          <input
            value={meetUrl}
            onChange={(e) => setMeetUrl(e.target.value)}
            placeholder="https://meet.google.com/..."
            className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          className="w-full rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm text-[color:var(--navy-deep)] font-medium"
        >
          Agendar reunião
        </button>
      </div>
    </Overlay>
  );
}

function NotesDialog({
  meeting,
  session,
  onClose,
  onSaved,
}: {
  meeting: Meeting;
  session: ExecutiveSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <Overlay onClose={onClose} title={`Pós-reunião · ${meeting.investorName}`}>
      <div className="space-y-3">
        {meeting.notes.length > 0 && (
          <ul className="space-y-2 max-h-[240px] overflow-y-auto">
            {meeting.notes.map((n) => (
              <li key={n.id} className="rounded-md border border-[color:var(--border)] px-3 py-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {n.authorName} · {new Date(n.at).toLocaleString("pt-BR")}
                </p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Resumo, próximos passos, observações..."
          className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => {
            addMeetingNote(meeting.id, { authorId: session.userId, authorName: session.name, text: text.trim() });
            onSaved();
          }}
          className="w-full rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm text-[color:var(--navy-deep)] font-medium disabled:opacity-50"
        >
          Salvar observação
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(3,12,28,0.65)", backdropFilter: "blur(10px)" }} onClick={onClose} />
      <div className="absolute inset-x-4 top-[10vh] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[460px] rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] shadow-2xl">
        <header className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--border)]">
          <p className="font-display">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}