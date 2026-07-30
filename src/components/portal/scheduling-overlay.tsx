/**
 * Agendamento de reunião pelo investidor — módulo do Portal.
 *
 * Fluxo completo: escolher dia → escolher horário → confirmar →
 * confirmação com os dados da reunião e o executivo responsável.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import {
  DEFAULT_DURATION_MIN,
  getSchedulingExecutive,
  listAvailability,
  listInvestorMeetings,
  requestInvestorMeeting,
  saveSchedulingDraft,
  getSchedulingDraft,
  getOpenRequest,
  type ScheduleDay,
} from "@/lib/portal-scheduling";
import { getPortalSession } from "@/lib/portal-session";
import type { Meeting } from "@/lib/meetings";

export function SchedulingOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [slots, setSlots] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Meeting | null>(null);
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [pendingRequest, setPendingRequest] = useState<Meeting | null>(null);
  const [restored, setRestored] = useState(false);

  const executive = useMemo(() => (open ? getSchedulingExecutive() : null), [open]);
  const session = useMemo(() => (open ? getPortalSession() : null), [open]);

  useEffect(() => {
    if (!open) return;
    setDays(listAvailability(getSchedulingExecutive()?.id ?? null));
    setUpcoming(listInvestorMeetings());
    setPendingRequest(getOpenRequest());
    setDayIndex(0);
    setError(null);
    setConfirmed(null);
    // Recuperação automática: o investidor retoma exatamente onde parou.
    const draft = getSchedulingDraft();
    setSlots(draft?.slots ?? []);
    setTopic(draft?.topic ?? "");
    setRestored(Boolean(draft && (draft.slots.length > 0 || draft.topic)));
  }, [open]);

  // Continuidade — persistimos o rascunho a cada alteração.
  useEffect(() => {
    if (!open || confirmed) return;
    saveSchedulingDraft({ slots, topic });
  }, [open, confirmed, slots, topic]);

  const toggleSlot = useCallback((iso: string) => {
    setRestored(false);
    setSlots((prev) =>
      prev.includes(iso)
        ? prev.filter((item) => item !== iso)
        : prev.length >= 2
          ? [prev[1], iso]
          : [...prev, iso],
    );
  }, []);

  const submit = useCallback(async () => {
    if (slots.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await requestInvestorMeeting({
      slots,
      topic: topic.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(
        result.reason === "slot-taken"
          ? "Estes horários acabaram de ser reservados. Escolha outros, por favor."
          : result.reason === "duplicate-request"
            ? "Você já tem uma solicitação aguardando confirmação do executivo."
            : result.reason === "invalid-slots"
              ? "Selecione um ou dois horários válidos."
              : result.reason === "no-executive"
              ? "Não localizamos um executivo responsável. Fale conosco pelo WhatsApp."
                : "Sua sessão expirou. Recarregue a página e tente novamente.",
      );
      setDays(listAvailability(getSchedulingExecutive()?.id ?? null));
      setPendingRequest(getOpenRequest());
      return;
    }
    setConfirmed(result.meeting);
    setUpcoming(listInvestorMeetings());
  }, [slots, submitting, topic]);

  const day = days[dayIndex];

  return (
    <PortalOverlayShell open={open} title="Agendar conversa" size="dialog" onClose={onClose}>
      <div className="h-full overflow-y-auto px-6 pr-16 py-8 md:px-10 md:pr-16 md:py-10">
        {confirmed ? (
          <ConfirmationView
            meeting={confirmed}
            executiveName={executive?.name ?? "Velox"}
            onClose={onClose}
          />
        ) : (
          <>
            <p
              className="text-[11px] uppercase tracking-[0.24em]"
              style={{ color: "var(--brand-orange)" }}
            >
              Conversa com um executivo
            </p>
            <h2 className="portal-serif mt-3 text-3xl leading-tight">
              Escolha o melhor momento para conversarmos.
            </h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              {executive
                ? `${executive.name} conduzirá uma conversa consultiva de aproximadamente ${DEFAULT_DURATION_MIN} minutos para compreender seu momento, esclarecer dúvidas e avaliar se existe aderência entre seus objetivos e o modelo de expansão da Velox.`
                : `Uma conversa consultiva de aproximadamente ${DEFAULT_DURATION_MIN} minutos para compreender seu momento, esclarecer dúvidas e avaliar se existe aderência entre seus objetivos e o modelo de expansão da Velox.`}
            </p>

            {upcoming.length > 0 && (
              <div
                className="mt-6 rounded-2xl border p-4 text-sm"
                style={{ borderColor: "var(--paper-edge)" }}
              >
                <span className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                  Você já tem conversa marcada
                </span>
                <ul className="mt-2 space-y-1">
                  {upcoming.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" style={{ color: "var(--brand-orange)" }} />
                      {formatWhen(m.scheduledAt)} · {m.executiveName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendingRequest && (
              <div
                className="mt-6 rounded-2xl border p-4 text-sm"
                style={{ borderColor: "var(--paper-edge)" }}
              >
                <span className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                  Solicitação em análise
                </span>
                <p className="mt-2 leading-relaxed">
                  Você já enviou uma solicitação e {pendingRequest.executiveName} está confirmando o
                  melhor horário. Assim que confirmada, ela aparecerá aqui.
                </p>
              </div>
            )}

            {restored && (
              <p className="mt-6 text-xs text-[color:var(--muted-foreground)]">
                Recuperamos as informações que você havia começado a preencher.
              </p>
            )}

            <div className="mt-8">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                Dia
              </span>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {days.map((d, index) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setDayIndex(index)}
                    className="shrink-0 rounded-2xl border px-4 py-3 text-left transition"
                    style={{
                      borderColor: index === dayIndex ? "var(--brand-orange)" : "var(--paper-edge)",
                      background:
                        index === dayIndex
                          ? "color-mix(in oklab, var(--brand-orange) 10%, transparent)"
                          : "transparent",
                    }}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      {d.weekdayLabel.replace("-feira", "")}
                    </span>
                    <span className="portal-serif text-lg">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                Horários preferenciais — escolha até dois
              </span>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {day?.slots.map((slot) => (
                  <button
                    key={slot.iso}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => toggleSlot(slot.iso)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      borderColor:
                        slots.includes(slot.iso) ? "var(--brand-orange)" : "var(--paper-edge)",
                      background:
                        slots.includes(slot.iso)
                          ? "color-mix(in oklab, var(--brand-orange) 12%, transparent)"
                          : "transparent",
                    }}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-6 block">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                O que você gostaria de entender melhor? (opcional)
              </span>
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[color:var(--brand-orange)]"
                style={{ borderColor: "var(--paper-edge)", background: "transparent" }}
                placeholder="Ex.: investimento inicial, suporte da rede, perfil de operação..."
              />
            </label>

            {error && (
              <p className="mt-4 text-sm" style={{ color: "var(--destructive)" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={slots.length === 0 || submitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--brand-orange)", color: "#fff" }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Enviando..." : "Enviar solicitação"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="mt-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
              {session?.name ? `${session.name}, ` : ""}o executivo responsável confirmará um dos
              horários escolhidos e você receberá o convite com o link da reunião. Nenhum dado
              adicional é solicitado nesta etapa.
            </p>
          </>
        )}
      </div>
    </PortalOverlayShell>
  );
}

function ConfirmationView({
  meeting,
  executiveName,
  onClose,
}: {
  meeting: Meeting;
  executiveName: string;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-start justify-center py-6">
      <CheckCircle2 className="h-10 w-10" style={{ color: "var(--brand-orange)" }} />
      <h2 className="portal-serif mt-5 text-3xl leading-tight">Solicitação enviada.</h2>
      <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-[color:var(--muted-foreground)]">
        {executiveName} foi notificado, confirmará um dos horários escolhidos e enviará o convite
        com o link da reunião. Você pode fechar esta janela e continuar explorando o Portal — sua
        jornada permanece salva.
      </p>
      <dl
        className="mt-7 w-full space-y-3 rounded-2xl border p-5 text-sm"
        style={{ borderColor: "var(--paper-edge)" }}
      >
        <Row
          label="Horários preferenciais"
          value={(meeting.requestedSlots?.length ? meeting.requestedSlots : [meeting.scheduledAt])
            .map(formatWhen)
            .join("  ·  ")}
        />
        <Row label="Duração" value={`${meeting.durationMin ?? DEFAULT_DURATION_MIN} minutos`} />
        <Row label="Executivo responsável" value={meeting.executiveName} />
        <Row
          label="Link da reunião"
          value={meeting.meetUrl ?? "Enviado após a confirmação do executivo"}
        />
      </dl>
      <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Voltar ao Portal
          <ArrowRight className="h-4 w-4" />
        </button>
        <span
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-6 py-3.5 text-xs text-[color:var(--muted-foreground)]"
          style={{ borderColor: "var(--paper-edge)" }}
        >
          <MessageCircle className="h-4 w-4" />
          Precisa antecipar? Use o botão de WhatsApp.
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}
