/**
 * AMBIENTE DE TESTE REAL-TIME DA CADÊNCIA — DEFINIÇÕES PURAS.
 *
 * Aqui não há envio, banco nem regra de negócio nova: apenas a
 * identificação do LOTE e o catálogo dos comportamentos que queremos
 * observar. Os leads gerados entram pelo caminho real do sistema e são
 * conduzidos pelo motor de verdade, em tempo real (relógio real, cron
 * real, nenhuma aceleração).
 *
 * SEGURANÇA (regra inegociável): a marcação de teste é TÉCNICA e
 * explícita — `is_test` + `test_batch_id`. Nenhuma heurística por nome,
 * telefone, e-mail, cidade, coluna ou data pode marcar um lead. Lead
 * real jamais recebe marcação, em nenhuma hipótese.
 */

/** Telefone inexistente e não roteável: nenhum aparelho real recebe. */
export const TEST_PHONE_PREFIX = "5500";

export type TestScenarioKey =
  | "silencio_total"
  | "resposta_imediata"
  | "resposta_tardia"
  | "agendamento"
  | "recusa"
  | "reentrada"
  | "sem_acao_humana"
  | "fora_da_janela"
  | "telefone_invalido"
  | "duplicidade";

export type TestScenario = {
  key: TestScenarioKey;
  label: string;
  /** O que o lote deve provar quando este cenário é incluído. */
  expectation: string;
  /** Quem produz o comportamento: o próprio motor ou uma ação humana. */
  driver: "motor" | "humano";
};

export const TEST_SCENARIOS: TestScenario[] = [
  {
    key: "silencio_total",
    label: "Silêncio total",
    expectation:
      "Percorre a cadência completa sem nenhuma resposta e encerra na etapa final de sem-resposta.",
    driver: "motor",
  },
  {
    key: "resposta_imediata",
    label: "Resposta imediata",
    expectation:
      "Ao responder, as etapas pendentes são canceladas na hora e a automação para.",
    driver: "humano",
  },
  {
    key: "resposta_tardia",
    label: "Resposta tardia",
    expectation:
      "Responde depois de algumas etapas; nada do que já saiu é repetido e o restante é cancelado.",
    driver: "humano",
  },
  {
    key: "agendamento",
    label: "Agendamento",
    expectation: "Agendamento registrado interrompe a cadência e muda o estado do lead.",
    driver: "humano",
  },
  {
    key: "recusa",
    label: "Recusa / interrupção manual",
    expectation: "Interrupção manual encerra a cadência e nenhuma etapa nova é criada.",
    driver: "humano",
  },
  {
    key: "reentrada",
    label: "Reentrada em NOVOS",
    expectation:
      "Lead conhecido que volta para NOVOS é tratado como reabertura, sem apagar o histórico.",
    driver: "humano",
  },
  {
    key: "sem_acao_humana",
    label: "Sem ação humana",
    expectation:
      "Permanece em NOVOS: recebe a E0 e nenhuma etapa seguinte, comprovando o gate da E1.",
    driver: "motor",
  },
  {
    key: "fora_da_janela",
    label: "Entrada fora da janela",
    expectation:
      "Entrando entre 22:30 e 07:00, a etapa é preservada e executada na abertura seguinte.",
    driver: "motor",
  },
  {
    key: "telefone_invalido",
    label: "Telefone inválido",
    expectation: "Destinatário sem número válido é bloqueado com motivo registrado, sem travar o lote.",
    driver: "motor",
  },
  {
    key: "duplicidade",
    label: "Duplicidade de evento",
    expectation:
      "O mesmo evento repetido não gera segunda mensagem — idempotência comprovada.",
    driver: "motor",
  },
];

export function scenarioLabel(key: string): string {
  return TEST_SCENARIOS.find((s) => s.key === key)?.label ?? key;
}

/** Identificador do lote: `TEST-AAAAMMDD-A`, `-B`, ... por dia. */
export function buildBatchId(existingIds: string[], now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `TEST-${day}-`;
  const used = new Set(
    existingIds.filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length)),
  );
  for (let i = 0; i < 26; i += 1) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return `${prefix}${letter}`;
  }
  return `${prefix}${Date.now()}`;
}

export type SyntheticLead = {
  externalId: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  scenario: TestScenarioKey;
};

const CITIES = ["Ribeirão Preto", "Taubaté", "Uberlândia", "Curitiba", "Belo Horizonte"];
const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gisele", "Heitor"];
const LAST = ["Teste", "Ensaio", "Simulação", "Laboratório"];

/**
 * Semente numérica determinística e estável a partir do identificador do
 * lote. Garante que lotes diferentes nunca reutilizem o mesmo telefone
 * sintético, evitando a trava real de duplicidade entre lotes distintos.
 */
function batchSeed(batchId: string): number {
  let hash = 0;
  for (let i = 0; i < batchId.length; i += 1) {
    hash = (hash * 31 + batchId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 99_999_990;
}

/**
 * Lead fictício de um lote. O nome carrega a etiqueta visível "[TESTE]"
 * apenas para leitura humana no board — quem decide o que é teste é
 * SEMPRE a marcação técnica, nunca o texto.
 */
export function buildSyntheticLead(
  batchId: string,
  scenario: TestScenarioKey,
  index: number,
): SyntheticLead {
  const first = FIRST[index % FIRST.length];
  const last = LAST[index % LAST.length];
  const suffix = String(index + 1).padStart(2, "0");
  const phone =
    scenario === "telefone_invalido"
      ? "000"
      : `${TEST_PHONE_PREFIX}${String(900_000_000 + batchSeed(batchId) + index).slice(0, 9)}`;
  return {
    externalId: `${batchId}-${suffix}`,
    name: `[TESTE] ${first} ${last} ${suffix}`,
    phone,
    email: `${batchId.toLowerCase()}-${suffix}@teste.velox.local`,
    city: CITIES[index % CITIES.length],
    scenario,
  };
}

/** Payload no MESMO formato que a origem entrega — nada de atalho. */
export function buildIntakePayload(
  lead: SyntheticLead,
  entryTagId: string,
  nowIso: string,
): Record<string, unknown> {
  return {
    id: lead.externalId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    origin: "Ambiente de Teste Real-Time",
    status: "novo",
    created_at: nowIso,
    updated_at: nowIso,
    last_register_at: nowIso,
    tags: [{ id: entryTagId }],
    forms: [{ title: "Lote de teste da cadência" }],
    metas: [
      { meta_key: "cidade", meta_value: lead.city },
      { meta_key: "cenario_teste", meta_value: lead.scenario },
    ],
  };
}
