import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MessageSquare,
  CalendarPlus,
  Send,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Link2,
  Sparkles,
  Plus,
  Mic,
  Image as ImageIcon,
  User,
  Trash2,
  Square,
} from "lucide-react";
import { FileText, Clock3 } from "lucide-react";
import { type CrmConversation } from "@/lib/crm/relationships";
import { CRM_RELATIONSHIP_META } from "@/lib/crm/relationship-state";
import { whatsappPresence } from "@/lib/crm/presence";
import { formatCrmMessageDay, formatCrmMessageTime, type CrmMessage } from "@/lib/crm/messages";
import { copyToClipboard } from "@/lib/clipboard";
import {
  CRM_TEMPLATES,
  renderCrmTemplate,
  resolveCrmWindow,
  type CrmWindowStatus,
} from "@/lib/crm/templates";
import { useServerFn } from "@tanstack/react-start";
import { listCrmRelationshipTemplates } from "@/lib/crm/meta-templates.functions";
import type { CrmMetaTemplateOption } from "@/lib/crm/meta-templates";
import { ensureCloudSession } from "@/lib/executive-auth";
const CHATGPT_URL = "https://chatgpt.com/";

/**
 * Templates cadastrados na Central de Templates, visíveis no CRM.
 * Somente leitura — nenhum envio ou automação é acionado.
 */
function useCentralTemplates(active: boolean) {
  const fetchTemplates = useServerFn(listCrmRelationshipTemplates);
  const [items, setItems] = useState<CrmMetaTemplateOption[]>([]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void (async () => {
      try {
        await ensureCloudSession();
        const rows = await fetchTemplates({ data: undefined } as never);
        if (alive) setItems(rows as CrmMetaTemplateOption[]);
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [active, fetchTemplates]);
  return items;
}

/** Contador vivo do cabeçalho — atualiza o rótulo a cada segundo. */
function useSecondTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [active]);
}

/**
 * Badge permanente da Jornada Digital (DEF 2.4.11): o investidor navega
 * pelo Portal, mas o relacionamento comercial ainda não existe.
 */
export function CrmJourneyBadge() {
  return (
    <div className="crm-enter mx-auto mb-4 flex w-full max-w-2xl items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      <p className="text-[11px] leading-relaxed text-amber-800">
        <span className="font-semibold">Aguardando confirmação do WhatsApp</span>
        <br />
        Jornada Digital em validação. O Template Oficial já foi enviado pelo CRM: o histórico
        permanece visível e o envio de mensagens fica bloqueado até a resposta CONFIRMAR do
        investidor.
      </p>
    </div>
  );
}

/** Confirmação obrigatória antes de criar o Relacionamento Comercial. */
export function CrmStartRelationshipDialog({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar relacionamento"
      onClick={onCancel}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="crm-enter w-full max-w-md rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-6"
      >
        <h2 className="text-base font-semibold tracking-[-0.01em]">Iniciar relacionamento?</h2>
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--crm-muted)]">
          Até este momento {name} utilizou apenas a Jornada Digital.
        </p>
        <p className="mt-3 text-xs text-[color:var(--crm-muted)]">Ao continuar:</p>
        <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-[color:var(--crm-muted)]">
          <li>• será criado um Lead comercial;</li>
          <li>• será criado automaticamente o Card no Workspace;</li>
          <li>• a conversa será liberada;</li>
          <li>• esta ação ficará registrada na Auditoria.</li>
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-[color:var(--crm-border)] px-3.5 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--crm-hover)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer rounded-lg bg-[color:var(--crm-accent)] px-3.5 py-2 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
          >
            Iniciar Relacionamento
          </button>
        </div>
      </div>
    </div>
  );
}

/** Indicador padronizado do estágio automático do relacionamento. */
export function CrmStateDot({ item }: { item: CrmConversation }) {
  const meta = CRM_RELATIONSHIP_META[item.relationshipState];
  return (
    <span
      className="relative flex h-2 w-2 shrink-0 items-center justify-center"
      title={meta.label}
      aria-label={meta.label}
    >
      {meta.pulse ? (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${meta.dot}`}
          style={{ animationDuration: "2.4s" }}
          aria-hidden
        />
      ) : null}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
    </span>
  );
}

/** Chip discreto do estágio — exibido apenas na Ficha do investidor. */
export function CrmStateChip({ item }: { item: CrmConversation }) {
  const meta = CRM_RELATIONSHIP_META[item.relationshipState];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
      >
        <CrmStateDot item={item} />
        {meta.label}
      </span>
    </span>
  );
}

/** Avatar do investidor — foto quando existir, iniciais como alternativa. */
export function CrmAvatar({
  name,
  initials,
  photoUrl,
  size = 40,
}: {
  name: string;
  initials: string;
  photoUrl?: string;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[color:var(--crm-hover)] text-xs font-medium text-[color:var(--crm-muted)]"
    >
      {initials || "?"}
    </span>
  );
}

export function CrmConversationItem({
  item,
  active,
  unread = false,
  movement,
  onSelect,
}: {
  item: CrmConversation;
  active: boolean;
  unread?: boolean;
  /**
   * DEF 2.4.15 §5 — nenhum alerta sobe a conversa sem informar o motivo.
   * Quando presente, descreve a movimentação que trouxe a conversa ao topo.
   */
  movement?: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={[
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150",
        active ? "bg-[color:var(--crm-accent-soft)]" : "hover:bg-[color:var(--crm-hover)]",
      ].join(" ")}
    >
      <CrmAvatar name={item.name} initials={item.initials} photoUrl={item.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">{item.name}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--crm-muted)]">
            {item.lastActivityLabel}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <CrmStateDot item={item} />
          <span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--crm-muted)]">
            {CRM_RELATIONSHIP_META[item.relationshipState].label}
          </span>
          {unread ? (
            <span
              aria-label="Mensagens novas"
              title="Mensagens novas"
              className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--crm-accent)]"
            />
          ) : null}
        </span>
        {movement ? (
          <span className="crm-enter mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-800">
            <AlertTriangle className="mt-[1px] h-3 w-3 shrink-0" />
            <span className="min-w-0">
              <span className="font-semibold">Movimentação identificada</span>
              {" · "}
              {movement}
            </span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Cabeçalho da conversa (DEF 2.4.10 §7).
 *
 * Nenhum comando duplicado: agendamento, WhatsApp e ficha vivem
 * exclusivamente na Ficha do Investidor. Aqui permanece apenas a
 * identificação e a presença — informação exclusiva da conversa.
 */
export function CrmConversationHeader({
  item,
  window: win,
  windowAnchor,
}: {
  item: CrmConversation;
  window?: CrmWindowStatus;
  /** Âncora da janela de 24h — permite o contador regressivo ao vivo. */
  windowAnchor?: string | null;
}) {
  const presence = whatsappPresence(item.id);
  useSecondTick(Boolean(win?.open));
  const live = win && windowAnchor ? resolveCrmWindow(windowAnchor) : win;
  return (
    <div key={item.id} className="crm-enter flex min-w-0 flex-1 items-center gap-3.5">
      <CrmAvatar name={item.name} initials={item.initials} photoUrl={item.photoUrl} size={42} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{item.name}</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--crm-muted)]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              presence.online
                ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-[color:var(--crm-muted)]/40"
            }`}
            aria-hidden
          />
          {presence.label}
        </span>
      </div>
      {live ? (
        <span
          title={live.hint}
          className={[
            "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            live.open
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
          ].join(" ")}
        >
          <Clock3 className="h-3.5 w-3.5" />
          {live.label}
        </span>
      ) : null}
    </div>
  );
}

export type CrmAttachmentKind = "documento" | "imagem" | "video" | "audio" | "contato";

export type CrmOutgoingAttachment = {
  kind: CrmAttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Conteúdo em base64 puro (sem o prefixo data:). */
  base64: string;
};

async function fileToAttachment(
  file: File,
  kind: CrmAttachmentKind,
): Promise<CrmOutgoingAttachment> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] as number);
  return {
    kind,
    filename: file.name || "anexo",
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    base64: btoa(binary),
  };
}

/**
 * Barra inferior de envio — permanentemente visível na conversa.
 * ENTER envia a mensagem, registra no histórico e atualiza o estágio.
 */
export function CrmComposer({
  onSend,
  onSendAttachment,
  disabled = false,
  hint,
  investorName = "",
  executiveName = "",
  portalLink = "",
  window: win,
  prefillText,
  prefillNonce = 0,
  contacts = [],
}: {
  onSend: (text: string, viaTemplate: boolean) => void;
  /** Envio real de anexos e áudios pelo canal oficial. */
  onSendAttachment?: (
    attachment: CrmOutgoingAttachment,
  ) => Promise<{ delivered: boolean; error?: string }>;
  disabled?: boolean;
  hint?: string;
  /** Nome usado na personalização dos templates. */
  investorName?: string;
  /** Executivo responsável — resolve {{nome_executivo}}. */
  executiveName?: string;
  /** Portal do Investidor do executivo — resolve {{link_portal_investidor}}. */
  portalLink?: string;
  /**
   * Vídeo de pós-apresentação do executivo responsável (individual).
   * Ausente ⇒ a ação de Pós-apresentação fica bloqueada com aviso.
   */
  postPresentationVideoUrl?: string | null;
  window?: CrmWindowStatus;
  /** Texto carregado a partir do módulo Templates. */
  prefillText?: string | null;
  /** Muda a cada seleção, permitindo recarregar o mesmo template. */
  prefillNonce?: number;
  /** Contatos reais do CRM, oferecidos no botão "Contato". */
  contacts?: { id: string; name: string; phone: string }[];
}) {
  const [text, setText] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  /** Cadastros vindos da Central de Templates (mesma finalidade e nome). */
  const centralTemplates = useCentralTemplates(templatesOpen);
  const [armedTemplate, setArmedTemplate] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  /** Seletor de contato do CRM (substitui o antigo arquivo .vcf). */
  const [contactsOpen, setContactsOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /** Áudio gravado aguardando revisão — nada é enviado sem confirmação. */
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<{ url: string; blob: Blob } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingKind = useRef<CrmAttachmentKind>("documento");

  const deliver = async (attachment: CrmOutgoingAttachment) => {
    if (!onSendAttachment) return;
    setSending(true);
    setAttachError(null);
    try {
      const result = await onSendAttachment(attachment);
      if (!result.delivered) {
        setAttachError(result.error ?? "O anexo não foi entregue pelo canal oficial.");
      }
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : "Falha ao enviar o anexo.");
    } finally {
      setSending(false);
    }
  };

  const pickFile = (kind: CrmAttachmentKind, accept: string) => {
    pendingKind.current = kind;
    const input = fileRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
    setAttachOpen(false);
  };

  const startRecording = async () => {
    setAttachError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudio({ url: URL.createObjectURL(blob), blob });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setAttachError("Não foi possível acessar o microfone deste dispositivo.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  // Template escolhido no módulo Templates entra direto na caixa,
  // pronto para edição antes do envio.
  useEffect(() => {
    if (!prefillNonce || !prefillText) return;
    setText(prefillText);
    setArmedTemplate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce]);
  /**
   * DEF 2.4.15 §2 — Estado 01: com a Janela de Conversação encerrada a
   * digitação, o foco, o ENTER e o botão Enviar ficam totalmente
   * bloqueados. Somente um Template aprovado pode ser disparado, e o
   * disparo reabre imediatamente a janela (Estado 02).
   */
  const windowClosed = Boolean(win && !win.open);
  /**
   * O botão IA abre o ChatGPT em uma janela flutuante dentro do próprio
   * CRM. Nenhum painel de sugestões, nenhuma integração automática.
   */
  const typingBlocked = disabled || windowClosed;
  const canSend = !disabled && text.trim().length > 0 && (!windowClosed || armedTemplate);
  const submit = () => {
    if (!canSend) return;
    const value = text.trim();
    if (!value) return;
    onSend(value, armedTemplate);
    setText("");
    setArmedTemplate(false);
  };
  return (
    <div className="shrink-0 border-t border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-5 py-3">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          await deliver(await fileToAttachment(file, pendingKind.current));
        }}
      />
      {win && !disabled ? (
        <p
          className={[
            "mb-2 inline-flex items-center gap-1.5 rounded-full py-0.5 text-[11px]",
            win.open ? "text-emerald-700" : "bg-rose-50 px-2 font-medium text-rose-700",
          ].join(" ")}
        >
          {win.open ? null : <Lock className="h-3 w-3 shrink-0" />}
          {win.hint}
        </p>
      ) : null}
      {attachError ? (
        <p className="mb-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">
          {attachError}
        </p>
      ) : null}
      {audio ? (
        <div className="crm-enter mb-2 flex items-center gap-2 rounded-xl border border-[color:var(--crm-border)] px-3 py-2">
          {/* Revisão obrigatória antes do envio do áudio. */}
          <audio src={audio.url} controls className="h-8 flex-1" />
          <button
            type="button"
            aria-label="Descartar áudio"
            onClick={() => {
              URL.revokeObjectURL(audio.url);
              setAudio(null);
            }}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[color:var(--crm-muted)] hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={async () => {
              const buffer = await audio.blob.arrayBuffer();
              const bytes = new Uint8Array(buffer);
              let binary = "";
              for (let i = 0; i < bytes.length; i += 1)
                binary += String.fromCharCode(bytes[i] as number);
              await deliver({
                kind: "audio",
                filename: `audio-${Date.now()}.ogg`,
                mimeType: audio.blob.type || "audio/ogg",
                sizeBytes: audio.blob.size,
                base64: btoa(binary),
              });
              URL.revokeObjectURL(audio.url);
              setAudio(null);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            Enviar áudio
          </button>
        </div>
      ) : null}
      {attachOpen && !disabled ? (
        <div className="crm-enter mb-2 flex flex-wrap gap-1.5">
          {[
            { label: "Documento", icon: FileText, kind: "documento" as const, accept: "*/*" },
            {
              label: "Fotos e vídeos",
              icon: ImageIcon,
              kind: "imagem" as const,
              accept: "image/*,video/*",
            },
            { label: "Áudio", icon: Mic, kind: "audio" as const, accept: "audio/*" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => pickFile(option.kind, option.accept)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)]"
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          ))}
          {/* Contato: escolhe um contato REAL do CRM e envia os dados
              na conversa — nada de arquivos .vcf do computador. */}
          <button
            type="button"
            onClick={() => {
              setContactsOpen((v) => !v);
              setAttachError(
                contacts.length === 0
                  ? "Nenhum contato disponível para compartilhar."
                  : null,
              );
            }}
            aria-expanded={contactsOpen}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)]"
          >
            <User className="h-3.5 w-3.5" />
            Contato
          </button>
        </div>
      ) : null}
      {contactsOpen && !disabled && contacts.length > 0 ? (
        <div className="crm-enter mb-2 max-h-40 overflow-y-auto rounded-xl border border-[color:var(--crm-border)] p-1.5">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => {
                setText(`Contato: ${contact.name} — ${contact.phone}`);
                setContactsOpen(false);
                setAttachOpen(false);
              }}
              className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[11px] hover:bg-[color:var(--crm-hover)]"
            >
              <span className="font-medium">{contact.name}</span>{" "}
              <span className="text-[color:var(--crm-muted)]">{contact.phone}</span>
            </button>
          ))}
        </div>
      ) : null}
      {templatesOpen && !disabled ? (
        <div className="crm-enter mb-2 flex flex-wrap gap-1.5">
          {centralTemplates
            .filter((t) => t.purpose === "primeiro_contato" || t.purpose.startsWith("abertura_conversa_"))
            .map((t) => (
            <button
              key={`meta-${t.id}-${t.language ?? ""}`}
              type="button"
              title={`${t.id}${t.language ? ` · ${t.language}` : ""}`}
              onClick={() => {
                setText(renderCrmTemplate(t.body, { executiveName, portalLink, investorName }));
                setArmedTemplate(true);
                setTemplatesOpen(false);
              }}
              className="cursor-pointer rounded-lg border border-[color:var(--crm-accent)]/40 bg-[color:var(--crm-accent-soft)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--crm-accent)] transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0"
            >
              {t.label}
            </button>
          ))}
          {CRM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setText(renderCrmTemplate(t, { executiveName, portalLink, investorName }));
                setArmedTemplate(true);
                setTemplatesOpen(false);
              }}
              className="cursor-pointer rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)] active:translate-y-0"
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={typingBlocked || !onSendAttachment}
          aria-expanded={attachOpen}
          aria-label="Anexar arquivo"
          title="Anexar"
          onClick={() => {
            setTemplatesOpen(false);
            setAttachOpen((v) => !v);
          }}
          className={[
            "inline-flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[color:var(--crm-border)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40",
            attachOpen
              ? "bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]"
              : "text-[color:var(--crm-muted)]",
          ].join(" ")}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={templatesOpen}
          aria-label="Templates de mensagem"
          title="Templates aprovados"
          onClick={() => {
            setTemplatesOpen((v) => !v);
          }}
          className={[
            "inline-flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[color:var(--crm-border)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
            templatesOpen
              ? "bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]"
              : "text-[color:var(--crm-muted)]",
          ].join(" ")}
        >
          <FileText className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Abrir o ChatGPT em uma nova aba"
          title="Abrir o ChatGPT em uma nova aba"
          onClick={() => {
            setTemplatesOpen(false);
            // Atalho simples: o ChatGPT bloqueia carregamento embutido,
            // então abrimos uma nova aba e mantemos o Portal aberto.
            window.open(CHATGPT_URL, "_blank", "noopener,noreferrer");
          }}
          className={[
            "inline-flex h-[42px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[color:var(--crm-border)] px-3 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
            "text-[color:var(--crm-muted)]",
          ].join(" ")}
        >
          <Sparkles className="h-4 w-4" />
          IA
        </button>
        <input
          value={text}
          disabled={disabled}
          readOnly={windowClosed}
          onMouseDown={(e) => {
            // DEF 2.5.2 §5 — com a janela encerrada o clique na barra abre
            // a lista oficial de Templates em vez do teclado.
            if (!windowClosed || disabled) return;
            e.preventDefault();
            setTemplatesOpen(true);
          }}
          onFocus={(e) => {
            if (windowClosed) {
              e.currentTarget.blur();
              if (!disabled) setTemplatesOpen(true);
            }
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (typingBlocked) {
              e.preventDefault();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled
              ? (hint ?? "Conversa indisponível")
              : windowClosed
                ? "Janela encerrada — escolha um Template para reabrir"
                : "Digite uma mensagem..."
          }
          aria-label="Digite uma mensagem"
          className="min-w-0 flex-1 rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[color:var(--crm-muted)] focus:border-[color:var(--crm-accent)] disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-not-allowed read-only:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[color:var(--crm-accent)] px-3.5 py-2.5 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <Send className="h-3.5 w-3.5" />
          Enviar
        </button>
        <button
          type="button"
          disabled={typingBlocked || !onSendAttachment}
          aria-label={recording ? "Parar gravação" : "Gravar áudio"}
          title={recording ? "Parar gravação" : "Gravar áudio"}
          onClick={() => (recording ? stopRecording() : void startRecording())}
          className={[
            "inline-flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40",
            recording
              ? "border-rose-300 bg-rose-50 text-rose-600"
              : "border-[color:var(--crm-border)] text-[color:var(--crm-muted)] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)]",
          ].join(" ")}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/**
 * Histórico completo da conversa — ordem cronológica, rolagem automática
 * e separação visual entre mensagens enviadas e recebidas.
 */
export function CrmThread({ item, messages }: { item: CrmConversation; messages: CrmMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, item.id]);

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]">
          <MessageSquare className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium">
          {item.name} ainda não possui histórico de relacionamento.
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-[color:var(--crm-muted)]">
          As mensagens desta conversa serão exibidas aqui.
        </p>
      </div>
    );
  }

  let lastDay = "";
  return (
    <div key={item.id} className="crm-enter mx-auto flex w-full max-w-2xl flex-col gap-1.5 pb-1">
      {messages.map((m) => {
        const day = formatCrmMessageDay(m.at);
        const showDay = day !== lastDay;
        lastDay = day;
        const sent = m.direction === "enviada";
        return (
          <div key={m.id} className="flex flex-col">
            {showDay ? (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-[color:var(--crm-hover)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--crm-muted)]">
                  {day}
                </span>
              </div>
            ) : null}
            {/* DEF 2.5.2 §1 — Executivo à direita, Investidor à esquerda. */}
            <div className={sent ? "flex justify-end" : "flex justify-start"}>
              <div
                className={[
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
                  sent
                    ? "rounded-br-md bg-[color:var(--crm-accent)] text-white"
                    : "rounded-bl-md border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] text-[color:var(--crm-foreground)]",
                ].join(" ")}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <span
                  className={[
                    "mt-1 block text-right text-[10px] tabular-nums",
                    sent ? "text-white/70" : "text-[color:var(--crm-muted)]",
                  ].join(" ")}
                >
                  {formatCrmMessageTime(m.at)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

/** Botão de cópia real de link (área de transferência) com confirmação. */
export function CrmCopyLinkButton({
  url,
  label = "Copiar link",
}: {
  url?: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const value = url?.trim();
  return (
    <button
      type="button"
      disabled={!value}
      onClick={() => {
        if (!value) return;
        void copyToClipboard(value).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
      {copied ? "Link copiado" : label}
    </button>
  );
}

/** Pequenos detalhes corporativos por bloco da ficha. */
export type CrmRecordTone =
  | "azul"
  | "verde"
  | "roxo"
  | "laranja"
  | "azul-claro"
  | "vermelho"
  | "neutro";

const TONE: Record<CrmRecordTone, { icon: string; bar: string }> = {
  azul: { icon: "bg-blue-50 text-blue-600", bar: "bg-blue-500" },
  verde: { icon: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" },
  roxo: { icon: "bg-violet-50 text-violet-600", bar: "bg-violet-500" },
  laranja: { icon: "bg-amber-50 text-amber-600", bar: "bg-amber-500" },
  "azul-claro": { icon: "bg-sky-50 text-sky-600", bar: "bg-sky-400" },
  vermelho: { icon: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
  neutro: {
    icon: "bg-[color:var(--crm-hover)] text-[color:var(--crm-muted)]",
    bar: "bg-[color:var(--crm-muted)]/40",
  },
};

/** Bloco categorizado da Ficha Operacional (painel direito). */
export function CrmRecordSection({
  title,
  hint,
  tone = "neutro",
  icon: Icon,
  children,
}: {
  title: string;
  hint?: string;
  tone?: CrmRecordTone;
  icon?: typeof MessageSquare;
  children?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <section className="rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${t.icon}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className={`h-3.5 w-[3px] rounded-full ${t.bar}`} aria-hidden />
        )}
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--crm-muted)]">
          {title}
        </h3>
      </div>
      <div className="mt-3 space-y-2.5 text-sm">
        {children ?? (
          <p className="text-xs leading-relaxed text-[color:var(--crm-muted)]">
            {hint ?? "Em preparação para as próximas etapas."}
          </p>
        )}
      </div>
    </section>
  );
}

export function CrmRecordRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-[color:var(--crm-muted)]">{label}</span>
      <span className="min-w-0 truncate text-xs font-medium">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

/** Linha do WhatsApp — clique copia o número, sem abrir conversa/navegador. */
export function CrmCopyRow({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = value?.trim();
  if (!text) return <CrmRecordRow label={label} value="—" />;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-[color:var(--crm-muted)]">{label}</span>
      <button
        type="button"
        title="Copiar número"
        aria-label={`Copiar ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(
            () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            },
            () => undefined,
          );
        }}
        className="group flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium transition-colors hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)]"
      >
        <span className="min-w-0 truncate">{text}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-[color:var(--crm-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>
    </div>
  );
}

/** Bloqueio: investidor pertencente a outro Executivo. */
export function CrmBlockedRelationship({ item }: { item: CrmConversation }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Lock className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">Este investidor já possui um relacionamento ativo.</p>
      <dl className="w-full space-y-1.5 rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-4 py-3 text-left">
        <CrmRecordRow label="Responsável" value={item.ownerName} />
        <CrmRecordRow label="Origem" value={item.originLabel} />
        <CrmRecordRow label="Status" value={item.statusLabel} />
      </dl>
      <p className="text-xs leading-relaxed text-[color:var(--crm-muted)]">
        Solicite contato com o Executivo responsável para prosseguir. Nenhuma informação privada
        deste relacionamento é exibida.
      </p>
    </div>
  );
}

/** Visão administrativa do Gestor — sem qualquer conteúdo privado. */
export function CrmSupervisionView({ item }: { item: CrmConversation }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">Visão administrativa</p>
      <dl className="w-full space-y-1.5 rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-4 py-3 text-left">
        <CrmRecordRow label="Responsável" value={item.ownerName} />
        <CrmRecordRow label="Origem" value={item.originLabel} />
        <CrmRecordRow label="Status do relacionamento" value={item.statusLabel} />
        <CrmRecordRow label="Situação operacional" value={item.stateLabel} />
        <CrmRecordRow label="Última movimentação" value={item.lastActivityLabel} />
        <CrmRecordRow label="Workspace" value={item.workspaceLabel} />
      </dl>
      <p className="text-xs leading-relaxed text-[color:var(--crm-muted)]">
        Mensagens, notas, Timeline e demais conteúdos privados entre Executivo e Investidor não são
        exibidos nesta visão.
      </p>
    </div>
  );
}

/** Aviso de duplicidade detectada automaticamente. */
export function CrmDuplicateNotice({ item }: { item: CrmConversation }) {
  if (!item.duplicate) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-xs leading-relaxed text-amber-900">
        Duplicidade identificada por {item.duplicate.matchedBy}: já existe relacionamento ativo de{" "}
        {item.duplicate.investorName} sob responsabilidade de {item.duplicate.ownerName}.
      </p>
    </div>
  );
}
