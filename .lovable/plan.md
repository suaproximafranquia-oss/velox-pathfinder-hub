# Diagnóstico — Yuri sem card operacional na Financeira /f

Somente leitura de código e registros. Nenhum código, dado, card, tabela ou compromisso foi criado ou alterado. Não foi executada sincronização manual nem teste sobre Yuri. As conclusões usam o dado recebido pelo Portal, não uma consulta direta à API GreenSales.

## A) Onde Yuri existe hoje

O registro encontrado é **Yuri Araújo, external_id `57239`**.

| Representação | Resultado confirmado |
|---|---|
| `crm_leads` | Existe: `fb97b894-51e1-412f-8f67-afe8b969ffd6`, origem `greensales` |
| Estágio sincronizado | `agendamentos` |
| `raw_payload.follow_up` | `2026-09-10 09:10:00`: **10/09/2026 às 09:10, Brasília** |
| Última sincronização registrada do lead | 09/09/2026 às 11:13:08, Brasília; `sync_status=OK`, sem erro |
| `investors` | Existe identidade canônica `d9296fb0-0348-460a-822b-2479fedeeb02` |
| `investor_identifiers` | Existe vínculo `greensales` → `57239` para essa identidade |

**O evento não é apenas hipotético: estágio e follow_up válidos já chegaram ao Portal.**

Uma ressalva sobre a origem da ausência: o histórico registra Yuri como **lead histórico importado sem primeiro contato em 22/08**. A criação na origem é de **29/07/2026**. Portanto, os dados não sustentam descrevê-lo como lead criado depois da regra; confirmam uma importação histórica sem entrada operacional. Não é necessário presumir a data de corte para explicar o bloqueio atual.

## B) Existe portal_lead/card correspondente?

**Não.** A pesquisa por nome, `external_id=57239`, ID esperado `gs_57239` e identidade canônica não encontrou registro em `portal_leads` — nem arquivado.

Também foram encontrados **zero** registros ligados a `gs_57239` em `workspace_e0_actions`, `relationship_cadences` e `relationship_queue`.

A identidade em `investors` não substitui o card operacional: o espelhamento de compromissos procura especificamente `portal_leads.id=gs_57239`.

## C) O que acontece quando chega o follow_up válido?

O caminho atual é:

```text
GreenSales → crm_leads, reconhecido por external_id 57239
          → estágio agendamentos + follow_up válido
          → syncGreenSalesFollowUps seleciona o lead
          → syncOneFollowUp calcula decisão de criar compromisso
          → loadLeadIdentity procura portal_leads.id = gs_57239
          → não encontra
          → retorna ignore: "Lead sem card operacional no Portal."
          → não chega à gravação de portal_meetings
```

A seleção dos compromissos não exige que o lead tenha passado pela E0, nem aplica o corte de entrada da cadência. Entretanto, **a criação efetiva exige o card e um executivo responsável**.

No estado consultado, Yuri tem horário futuro, portanto não cai na regra que ignora compromissos descobertos pela primeira vez já vencidos há mais de 24 horas. Há 31 leads nos estágios elegíveis, abaixo do limite de leitura de 2.000; esse limite não explica a ausência.

Este é o comportamento determinado pelo código e pelos registros atuais; não foi reproduzido chamando a função, pois ela poderia gravar dados reais.

## D) portal_meetings pode existir sem o card?

**Estruturalmente, sim; pelo caminho atual de criação GreenSales, não.**

- O banco não tem chave estrangeira de `portal_meetings.investor_id` para `portal_leads`. Uma linha poderia existir sem esse card, desde que satisfeitos os demais campos, restrições e permissões.
- `syncOneFollowUp`, porém, bloqueia a criação antes da escrita quando o card não existe.
- Para Yuri, **não há compromisso em `portal_meetings`**, nem pelo ID esperado, nem pelos identificadores consultados.
- Caso o fluxo chegasse à criação, usaria `id=gsfu_57239`, `investor_id=gs_57239` e `external_ref=f:greensales:lead:57239:follow_up`. O vínculo operacional não usa o UUID de `crm_leads` nem o UUID canônico de `investors`.

## E) Onde o fluxo para e quais telas são afetadas?

O bloqueio exato está em **`src/server/crm/greensales-followup.server.ts:281–286`**, dentro de `syncOneFollowUp`, ao consultar `loadLeadIdentity`.

| Superfície | Situação atual de Yuri | Se existisse uma reunião sem card |
|---|---|---|
| Portal dos Leads | O espelho em `crm_leads` é pesquisável por Gestão/Admin autorizados; no recorte de colaborador, a ausência de titularidade em `portal_leads` impede incluí-lo como lead próprio | Não depende da reunião para listar o espelho |
| Workspace operacional | Sem card: falta `portal_leads` | A reunião não cria automaticamente o card |
| Central de Reuniões | Não recebe compromisso de Yuri, pois não existe linha em `portal_meetings` | Pode listar a reunião pelos dados próprios dela, respeitando permissões e filtros; isso não fornece a ficha operacional ausente |
| Aviso “Próximo compromisso” | Não encontra compromisso de Yuri | Pode encontrá-lo por executivo, horário e situação, sem consultar o card; o aviso prioriza os próximos horários |
| Ação do Dia | Não recebe compromisso nem ações de cadência de Yuri | Pode montar item `source=meeting`, `kind=reuniao` usando o nome da reunião, mesmo sem identidade do card; telefone ficaria vazio, respeitados responsável, estado e janela temporal |

Portanto, **a falha principal acontece antes das telas, não na renderização delas**. O horário de Yuri estaria dentro das janelas atuais de leitura do aviso e da Ação do Dia se a reunião existisse, sem dispensar os demais filtros e a classificação de compromisso futuro.

**Existe detecção, mas não recuperação:** a condição “sem card” tem uma mensagem técnica e incrementa `summary.ignored`. Não há, nesse caminho, criação da representação faltante ou pendência individual persistida. `runLeadSync` incorpora apenas `followUps.errors`; o motivo de ignore não vira erro de sincronização. Isso explica como o lead pode estar com sincronização `OK` e continuar sem compromisso espelhado.

## F) A hipótese está correta?

**Parcialmente, com uma diferença decisiva.**

- Confirmado: Yuri existe no espelho GreenSales, tem compromisso informado e não tem representação operacional.
- Confirmado: essa ausência interrompe o fluxo de espelhamento.
- Não confirmado — e contrário ao estado atual: “o compromisso pode até ter sido criado e apenas não aparece”. **No caso de Yuri, ele não foi criado.**
- Não seria correto afirmar que todas as telas precisam do card para listar uma reunião já existente: Central, aviso e Ação do Dia conseguem ler a própria reunião.

## G) Menor correção possível — somente análise

Para cumprir a regra proposta, a alternativa mais localizada é **garantir a representação mínima no próprio caminho de criação do compromisso**, reutilizando `ensureWorkspaceCard`, antes da consulta de identidade impedir a escrita.

Condições da eventual alteração:

1. Restringir à Financeira e à origem GreenSales, preservando o isolamento de testes.
2. Agir somente quando a regra existente decidir `create`: AGENDAMENTOS/VÍDEO, follow_up válido e não descartado pela regra de histórico vencido.
3. Resolver o executivo responsável com identidade oficial antes de prosseguir; nunca atribuir ao dono do cron ou inventar responsável.
4. Se o card estiver realmente ausente, reutilizar `ensureWorkspaceCard` com os dados sincronizados e o ID determinístico existente. Não restaurar, substituir nem alterar cards já existentes.
5. Reutilizar o vínculo canônico já existente por `linkCanonicalInvestor`, sem criar outro investidor.
6. Seguir para a criação idempotente do mesmo `portal_meetings`, pelas regras atuais.
7. Não passar pelo fluxo completo de `intakeLead`, nem criar E0, cadência, mensagem ou obrigação de ligação apenas para representar a reunião.

**Bloqueador adicional confirmado para Yuri:** o payload armazenado não contém `vendedor_id` nem `vendedor.id`, campos usados por `resolveResponsibleByVendorId`. Existe `user_id=37193`, mas o resolvedor atual não trata esse campo como vendedor; não há base para presumir equivalência.

Assim, **criar um card vazio não basta**: sem responsável oficial, a condição seguinte também retorna ignore (“Lead sem executivo responsável — compromisso não espelhado”). A menor solução completa precisa esclarecer a origem oficial desse responsável, sem alterar a atribuição por suposição.

Essa abordagem reutiliza sincronização, card, identidade e agenda existentes: **não exige tabela, segundo motor, segunda fila, segunda agenda ou nova fonte de verdade**. Também não cria cards indiscriminadamente para leads antigos. É análise de viabilidade, não autorização ou execução da mudança.

## H) Arquivos e funções envolvidos — detalhes técnicos

| Arquivo | Função/ponto relevante |
|---|---|
| `src/server/crm/lead-sync.server.ts:494–510` | `runLeadSync`: chama espelhamento após sincronizar leads; incorpora erros, não motivos de ignore |
| `src/server/crm/lead-intake.server.ts:200–265` | `intakeLead`: criação normal de card condicionada à entrada elegível |
| `src/server/crm/workspace-card.server.ts:45–96` | `ensureWorkspaceCard`: representação `gs_<external_id>`, reutilizável sem chamar a cadência |
| `src/lib/crm/greensales-followup.ts:137–197` | `planFollowUpSync`: elegibilidade, horário, criação/atualização/cancelamento |
| `src/server/crm/greensales-followup.server.ts:189–217, 238–338, 427–498` | `loadLeadIdentity`, `syncOneFollowUp`, `syncGreenSalesFollowUps`: bloqueio por ausência do card, gravação e agregado de ignores |
| `src/server/crm/responsible.server.ts:42–69` | `resolveResponsibleByVendorId`, `greenSalesVendorId`: resolução oficial do responsável |
| `src/server/crm/identity.server.ts:212–236` | `linkCanonicalInvestor`: vínculo com identidade existente |
| `src/lib/crm/leads.functions.ts:175–230` | `ownExternalIds`, `listCrmLeads`: Portal dos Leads e recorte por titularidade |
| `src/lib/meetings.functions.ts:35–45`; `src/lib/meetings.ts:119–154`; `src/routes/f.executivo.reunioes.tsx` | Leitura, hidratação e apresentação da Central de Reuniões |
| `src/lib/agenda.functions.ts:225–251`; `src/components/crm/next-commitment-alert.tsx` | `listNextCommitments` e aviso de próximo compromisso |
| `src/server/crm/daily-actions.server.ts:116–165, 212–245` | `buildDailyActions`: leitura e representação independente dos compromissos |

Nenhuma correção foi implementada; nenhum outro ambiente ou comportamento foi alterado.
