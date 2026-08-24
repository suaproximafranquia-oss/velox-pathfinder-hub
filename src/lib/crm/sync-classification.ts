/**
 * CLASSIFICAÇÃO EXPLÍCITA DE ENTRADA (plano aprovado — regra central).
 *
 * "Lead inexistente no espelho" NÃO significa "lead novo". Todo lead
 * visto na varredura é classificado ANTES de qualquer ação:
 *
 *   A — entrada recente elegível: lead realmente novo → caminho único
 *       de intake (espelho → card → E0 conforme regras existentes).
 *   B — histórico ausente do espelho: recuperação histórica → upsert
 *       direto com historical:true → SEM E0, SEM cadência, SEM card.
 *   C — existe no espelho e o estágio mudou → só atualiza o espelho.
 *   D — existe no espelho e nada mudou → nenhuma ação.
 *
 * A data que separa A de B é a ENTRADA REAL na origem
 * (last_register_at/register/created_at) — nunca a data de
 * sincronização. Regra pura, sem banco e sem canal.
 */

export type ScanLeadClass = "A" | "B" | "C" | "D";

export type ClassificationInput = {
  /** O lead passou no filtro da janela temporal da sincronização. */
  inWindow: boolean;
  /** O external_id já existe no espelho local. */
  inMirror: boolean;
  /** Estágio atual gravado no espelho (null se ausente). */
  mirrorStage: string | null;
  /** Estágio resolvido agora pelas etiquetas da origem (null = sem evidência). */
  resolvedStage: string | null;
  /** Entrada REAL na origem (last_register_at ?? register ?? created_at). */
  entryAt: string | null | undefined;
  /** Início da janela temporal da sincronização. */
  since: Date;
};

export function classifyScannedLead(input: ClassificationInput): ScanLeadClass {
  if (input.inMirror) {
    // Sem etiqueta de coluna resolvida NÃO há evidência de mudança —
    // jamais rebaixamos um lead por ausência de informação.
    if (input.resolvedStage && input.resolvedStage !== input.mirrorStage) return "C";
    return "D";
  }
  if (input.inWindow) {
    const stamp = input.entryAt ? Date.parse(input.entryAt) : Number.NaN;
    if (!Number.isNaN(stamp) && stamp >= input.since.getTime()) return "A";
  }
  // Ausente do espelho e sem entrada recente comprovada: histórico.
  // Na dúvida (data ausente/inválida), NUNCA tratar como lead novo.
  return "B";
}
