# Central de Alertas (/f) — origem dos eventos (diagnóstico somente leitura)

Nada foi alterado: nenhum arquivo, banco, migration, RLS, permissão ou dado.

## 1. Fonte dos alertas

- Tela: `src/routes/f.executivo.alertas.tsx`
- Dados: **não há tabela no banco**. Os alertas vivem no `localStorage` do navegador,
  na chave `atlas:workspace-alerts:v1` (`src/lib/workspace-alerts.ts`).
- Chaves auxiliares no mesmo navegador: `atlas:investor-last-seen:v1`,
  `atlas:workspace-alerts-read:v1`, `velox:journey:v1` (jornadas),
  `velox:events:v1` (barramento de eventos) e a base local de leads.
- Nenhuma server function participa: a Central lê e escreve exclusivamente no navegador.

## 2. Quem cria os alertas

`runWorkspaceAlertEvaluation(session)` em `src/lib/workspace-alerts.ts`, disparado
pela própria página a cada abertura e a cada evento do barramento (com intervalo mínimo
de 5 s). Ela executa cinco avaliadores:

- `evaluateInvestorMovement()` — retorno ao Portal
- `evaluateNewLeads(session)` — "Novo investidor: X" a partir da base local de leads
- `evaluateJourneyAlerts(session)` — percorre `listJourneys()` (localStorage) e gera
  início de jornada, manual concluído, **simulação**, pedido de contato e engajamento
- `evaluateMeetingReminders` / `evaluateMeetingLifecycle` — reuniões

## 3. "Thiago simulou o potencial de receita"

- Código exato: `evaluateJourneyAlerts`, bloco `if (record.counters.simulations > 0)`,
  título `` `${record.name} simulou potencial de receita` `` (workspace-alerts.ts, ~linha 336).
- O nome exibido é o **nome do registro de jornada**, não o do executivo logado. Portanto o
  alerta não afirma que o usuário Thiago simulou: afirma que uma jornada chamada "Thiago" tem
  contador de simulações maior que zero.
- Existem dois leads reais com esse nome no banco: `Thiago Rodrigues` (27/08) e `Thiago`
  (22/08) — o lead preservado do reset.
- O contador vem do registro local em `velox:journey:v1`, criado por `registerJourney` /
  `trackJourney` quando o Portal é aberto **naquele navegador**. Não há registro
  correspondente de `simulator.completed` para nenhum lead "Thiago" em
  `portal_journey_events`: as únicas conclusões de simulador gravadas no banco são de
  22/08, do lead `Daniele` (`ld_mt3w9q2zytov`).
- Conclusão: o evento não tem lastro no banco; ele existe apenas no armazenamento do
  navegador que abriu o Portal em nome de "Thiago" (teste do próprio administrador).

## 4. Lead "Augusto"

- Consulta ao banco: `portal_leads`, `crm_leads` e `group_unit_leads` — **nenhum registro**
  com nome contendo "Augusto".
- Também não existe "Augusto" em nenhum arquivo do repositório (nenhum seed, fixture ou
  demo cita esse nome).
- Origem provável: um nome digitado numa abertura de teste do Portal nesse mesmo navegador,
  que criou um registro em `velox:journey:v1` / base local de leads e, por consequência,
  o alerta "Novo investidor: Augusto".

## 5. Vazamento de demo/homologação/teste

Não há seed, fixture ou gerador de alertas fictícios no código da Central. O que existe é
mais sutil: **qualquer visita de teste ao Portal feita no mesmo navegador do executivo
grava jornada local**, e a Central transforma essa jornada em alerta com aparência
de acontecimento real. Os fixtures de demonstração da Ação do Dia e o laboratório de lotes
`TEST-*` não alimentam esta tela.

## 6. Cache / localStorage

Sim — é a causa estrutural. Tudo (alertas, jornadas, últimos vistos, base local de leads)
é `localStorage` por navegador. Efeitos:

- Alertas antigos (como o de 29/08) permanecem para sempre nesse navegador, mesmo depois de
  o dado de origem deixar de existir no banco.
- Outro executivo, em outro navegador, vê um conjunto diferente de alertas.
- Limpar o navegador apaga o histórico; nenhum outro dispositivo é afetado.

## 7. Duplicações / recriações

Há proteção parcial: `pushAlert` ignora IDs repetidos e "Novo investidor" usa ID estável
por lead (`wa_novo_lead_<id>`). Porém os alertas de jornada (simulação, manual concluído,
engajamento, início de jornada) usam `date: record.lastActivityAt` na composição do ID —
então **cada nova atividade da jornada recria o mesmo tipo de alerta com nova data**. É
por isso que eventos "antigos" reaparecem.

## 8. Causa técnica provável

A Central de Alertas não lê acontecimentos do banco: ela **deriva** alertas de estado local
do navegador. Registros de teste do Portal criados no navegador do administrador viram
alertas indistinguíveis dos reais, ficam presos localmente e são recriados a cada nova
atividade da jornada.

## 9. Correção mínima recomendada (para uma etapa futura, não aplicada)

1. Marcar a origem: alertas derivados de jornada local exibirem a procedência (Portal neste
   navegador) ou serem gerados apenas quando o lead existir na base real do servidor.
2. Estabilizar os IDs dos alertas de jornada (um por lead + tipo, sem a data), eliminando a
   recriação a cada atividade.
3. Médio prazo: mover a Central para leitura server-side (`portal_journey_events`,
   `portal_leads`, `portal_meetings`), tornando o histórico compartilhado e auditável.

Arquivos envolvidos numa futura correção: `src/lib/workspace-alerts.ts`,
`src/lib/journey/engine.ts`, `src/routes/f.executivo.alertas.tsx`.
