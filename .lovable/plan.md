# Financeira /f — Segunda construção da cadência (ponte V2 → operação)

Plano fechado com as duas pendências resolvidas. Nada foi alterado ainda.

## Regras confirmadas

1. **Ligação atendida (ATENDEU = SIM)**
   - Cancela as ações restantes da tentativa, inclusive a mensagem daquela etapa.
   - Não gera automaticamente E2/E3/E4.
   - O ciclo entra em **aguardando encaminhamento**.
   - Encaminhamentos válidos: agendamento, mudança de estágio, material efetivamente enviado, compromisso de retorno.
   - **Compromisso de retorno = agendamento formal** (congela a cadência).
   - Sem encaminhamento em **1 dia útil**, o lead vira alerta destacado na Ação do Dia; nunca dispara etapa sozinho.

2. **MATERIAL_ENVIADO**
   - Só é ativado por registro estruturado de envio/disponibilização efetiva.
   - Falar, prometer ou oferecer na ligação não ativa.
   - Nenhuma interpretação de texto/conversa.

3. **E7/E8 na Biblioteca**
   - Eixo de contexto: SEM_CONTATO e MATERIAL_ENVIADO, cada um com variante com nome e sem nome (a variante sem nome já existe no mesmo registro).
   - Slots criados vazios; textos oficiais cadastrados pela gestão. Nenhum texto inventado.
   - Sem texto ativo, a etapa aparece como pendência de conteúdo — nunca envia texto automático.

## Ordem de construção

1. Migration mínima (sem tabela nova):
   - `relationship_queue`: `action_order`, `action_kind`, `theoretical_date`, `origin_date`, `cancel_reason`, status `CANCELLED`.
   - `relationship_cadences`: estado `AGUARDANDO_ENCAMINHAMENTO` + carimbo de início da espera.
   - `relationship_message_library`: coluna de contexto (nulo = etapas sem eixo) e unicidade por etapa+contexto+versão ativa.
2. Leitor de contexto do ciclo (material enviado, atendimento, estágio, agendamento) alimentando o V2.
3. `decide.ts` passa a delegar ao `cadence-v2` como autoridade única — sem segundo tick, sem gerador paralelo.
4. Persistência das ações internas e dos cancelamentos por ligação atendida.
5. Ação do Dia: ordem ligação antes de mensagem, ocultar tentativa cancelada, exibir pendência de encaminhamento e o alerta de 1 dia útil.
6. Biblioteca: seleção de E7/E8 por contexto + variante de nome; slots vazios visíveis para a gestão.
7. Testes: idempotência do tick, cancelamento por atendimento, espera de encaminhamento, congelamento por agendamento, ramo material, R e RE, preservação dos ciclos históricos.

## Preservação

Não altera `/`, `/s`, `/s/portal`, `/seg`, Safety Lock, GreenSales, ownership, KPI, alertas, backups, permissões, Portal. Nenhum histórico, versão, snapshot ou auditoria é apagado. Nenhuma etapa nova (ER/RF) é criada. L2–L4 permanecem sem gerar obrigações novas, com histórico intacto.
