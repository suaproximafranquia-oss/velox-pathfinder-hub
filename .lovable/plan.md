# Central de Alertas (/f) — mapa arquitetural para eliminar o localStorage

Diagnóstico somente leitura. Nada foi alterado: nenhum arquivo, banco, migration, RLS ou dado.

## Como a Central lê hoje

`src/routes/f.executivo.alertas.tsx` → `runWorkspaceAlertEvaluation()` em
`src/lib/workspace-alerts.ts`. **Nenhuma consulta server-side direta.** Toda a leitura é do
navegador; parte desse estado local, porém, é espelho hidratado do servidor:

| Estado local | Chave | É espelho do servidor? |
| --- | --- | --- |
| Alertas | `atlas:workspace-alerts:v1` | Não — só existe no navegador |
| Último visto | `atlas:investor-last-seen:v1` | Não |
| Lidos | `atlas:workspace-alerts-read:v1` | Não (preferência, aceitável) |
| Jornadas | `velox:journey:v1` | Não — gravado por visitas ao Portal naquele navegador |
| Barramento de eventos | `velox:events:v1` | Não |
| Leads | base local (`loadLeads`) | Sim — `replaceLeads` do espelho de `portal_leads` |
| Reuniões | `listMeetings` | Sim — hidratado por `listMeetingsFromServer` |

## Tabelas server-side já existentes e populadas

| Tabela | Conteúdo | Volume atual |
| --- | --- | --- |
| `portal_leads` | leads reais | 123 |
| `portal_journey_events` | eventos do Portal (`module.opened`, `manual.chapter.completed`, `manual.completed`, `simulator.started`, `simulator.completed`, `material.viewed`, `identity.created`) | 127 |
| `portal_engagement` | sessões, retornos, tempo ativo, módulos, primeiro/último acesso | 15 |
| `portal_meetings` | reuniões e ciclo de vida | 1 |
| `crm_timeline` | histórico operacional do card | 1.119 |
| `investor_notes` | notas do executivo | 6 |
| `workspace_e0_actions`, `relationship_queue`, `relationship_events` | motor de relacionamento | — |

## Mapa por tipo de alerta

| Alerta | Evento real | Fonte server-side existente | Depende de localStorage hoje? | Caminho recomendado |
| --- | --- | --- | --- | --- |
| Novo Investidor Identificado | lead criado | `portal_leads.created_at` | Sim (base local, mas é espelho) | Derivar direto de `portal_leads` no servidor |
| Movimentação do Investidor | retorno ao Portal após inatividade | `portal_engagement.last_access_at` / `returns`; `portal_journey_events` | Sim (`atlas:investor-last-seen`) | Comparar acessos no servidor; o "último visto" deixa de ser do navegador |
| Atividade no Portal | abertura de módulo | `portal_journey_events` (`module.opened`) | Sim (jornada local) | Fonte pronta no servidor |
| Manual Concluído | conclusão da leitura | `portal_journey_events` (`manual.completed`) + `portal_leads.journey_completed_at` | Sim | Fonte pronta |
| **Simulação Realizada** | simulação concluída | `portal_journey_events` (`simulator.completed`) — só 2 registros, ambos do lead Daniele | Sim (contador local) | Fonte pronta; hoje o alerta vem do contador do navegador, por isso o caso "Thiago" |
| Contato Solicitado (WhatsApp) | pedido de contato | **Não há registro dedicado** | Sim | Precisa ser persistido (evento de jornada ou coluna própria) |
| Engajamento Elevado | escore de prontidão | Calculável de `portal_engagement` + `portal_journey_events` | Sim (cálculo local) | Recalcular no servidor |
| Lembrete de Reunião | reunião nas próximas 24h | `portal_meetings` | Espelho do servidor | Fonte pronta |
| Reunião solicitada/confirmada/alterada/cancelada | mudança de status | `portal_meetings.status`, `updated_at` | Espelho | Fonte pronta |
| Lead redistribuído / arquivado / reaberto / proprietário alterado | movimentação do card | `lead_ownership_history`, `crm_timeline` | Sim (barramento local) | Fonte pronta |
| Conversa restaurada, Falha operacional | operações internas | Parcial (`crm_timeline`) | Sim | Avaliar caso a caso |

## Sem fonte server-side confiável hoje

1. **Pedido de contato por WhatsApp** — só existe como evento do navegador; precisaria virar
   registro do servidor no momento em que o investidor clica.
2. **Prontidão para contato / engajamento elevado** — não é um acontecimento gravado, é um
   cálculo; deveria ser recalculado no servidor a partir de jornada + engajamento.
3. **O próprio histórico de alertas** — não existe tabela. Hoje ele é por navegador e por
   dispositivo: não é compartilhado entre usuários, não está no banco e some se o
   armazenamento local for limpo.

## Menor caminho arquitetural (proposta, não implementada)

Etapa 1 — **leitura server-side, sem tabela nova e sem migration**: uma server function
autenticada que deriva os alertas, sob demanda, de `portal_leads`, `portal_journey_events`,
`portal_engagement`, `portal_meetings` e `lead_ownership_history`, respeitando o recorte por
executivo responsável. A Central passa a exibir só o que existe no banco; o localStorage vira,
no máximo, marcação de "lido". Isso já elimina os casos "Thiago simulou" e "Augusto", porque
nenhum deles tem registro no servidor.

Etapa 2 — **persistência dos eventos que faltam**: gravar o pedido de contato por WhatsApp
como evento de jornada no servidor (aí sim exigiria uma migration apenas se optarmos por
coluna/tabela própria em vez de reaproveitar `portal_journey_events`).

Etapa 3 — **histórico compartilhado (opcional)**: tabela `workspace_alerts` para estado de
leitura e arquivamento por usuário. Só então haveria migration com GRANT e RLS por executivo.

Arquivos envolvidos numa futura construção: `src/lib/workspace-alerts.ts`,
`src/routes/f.executivo.alertas.tsx`, um novo `*.functions.ts` de alertas e um
`*.server.ts` correspondente. As etapas 1 e 2 (reaproveitando `portal_journey_events`)
**não exigem migration**.
