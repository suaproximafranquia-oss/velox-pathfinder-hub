# Validação arquitetural — respostas antes do próximo comando de construção

Nada foi implementado. Todas as respostas vêm de leitura do código e de consultas ao banco real.

## 1. Estado operacional do lead

**1.** São dois conceitos distintos, calculados em lugares diferentes:
- Etiqueta operacional do card: `resolveLeadState()` em `src/lib/lead-state.ts` (usa `viewedAt`, `closedAt`, `lastActivity`). Renderizada em `investor-card.tsx:156` e usada também para ORDENAR o Workspace (`f.executivo.dashboard.tsx:223-227`, `stateScore`).
- Status derivado de leitura: `listAllInvestors()` em `src/lib/executive-data.ts:130-138` (`readingPct === 0 ⇒ "novo"`), exibido na tela Investidores via `STATUS_LABEL`.
Não há ponto onde o código os trate como o mesmo campo — a colisão é só de RÓTULO ("Novo" nos dois). Impacto: o executivo lê como se fosse o mesmo status. Recomendação: renomear o segundo para "Sem leitura"/"Não iniciou" (mudança puramente de texto, risco zero).

**2.** Inventário real do barramento (`src/lib/events/bus.ts`):
- Atividade REAL do investidor: `journey.started`, `journey.lead.created`, `journey.session.started/ended`, `journey.returned`, `journey.module.opened`, `journey.progress`, `journey.completed`, `manual.started`, `manual.chapter.completed`, `manual.completed`, `material.viewed`, `simulator.started`, `simulator.completed`, `profile.interests.captured`, `whatsapp.requested`, `ai.query.answered`, `meeting.requested` (quando `origin` é do investidor).
- Exclusivamente executivo/sistema: `lead.status.changed`, `profile.updated` (nota e edição de ficha), `meeting.created/confirmed/rescheduled/completed/cancelled/deleted`, `investor.reactivated`, todos os `admin.*`, `knowledge.*`, `resource.*`, `google.*` e `meeting.google.*`.
- Colunas de servidor que já são atividade real: `journey_last_event_at`, `last_inbound_at`, `last_activity_at` (só avança com atividade informada pelo navegador do investidor — `portal-leads.functions.ts:212-226`).

**3.** Sim: abrir card, editar ficha, adicionar nota, criar/confirmar/reagendar reunião nunca devem mover "última atividade do investidor". Isso já está escrito como regra oficial em `executive-data.ts:103-110` — só que implementado como lista negra de um único tipo. Exceção real única: `meeting.requested` com `origin` do investidor (o investidor pediu a reunião) — nesse caso é atividade dele, e a distinção está disponível no payload (`origin`).

**4.** Só uma: registrar manualmente um contato/resposta recebida do investidor (inbound). O fato é do investidor; o executivo é apenas quem digita. Hoje isso chega por `last_inbound_at` e por `contato_recebido` na timeline — ambos legítimos.

**5.** Sim, sem tocar em identidade, ownership ou GreenSales. Confirmado por busca: nenhuma rotina de servidor grava `viewed_at` além de `set_lead_operational`, e o único ponto que escreve `last_activity_at` na sincronização GreenSales usa `created_at` do lead, nunca `now()` (`greensales-sync.functions.ts:137`). A mudança é isolada no cálculo de `lastActivity` no cliente.

## 2. "NOVO" voltando depois de abrir

**6.** Sim, confirmado. Banco correto: 55 de 56 leads com `viewed_at`; ZERO leads com `last_activity_at`, `journey_last_event_at`, `last_inbound_at` ou `created_at` maiores que `viewed_at`. Logo o retorno a NOVO só pode nascer da parcela local do cálculo: `...events.map(e => e.at)` em `executive-data.ts:154-160`, alimentada por `profile.updated` (`investor-comments.ts:60`, `workspace-lead-edit.ts:135`), `meeting.*` (`meetings.ts`) e `investor.reactivated` (`workspace-alerts.ts:124`, emitido dentro de `pushAlert`).

**7.** Busca completa. Outras fontes possíveis, por ordem de risco:
- `pushAlert()` emite `investor.reactivated` a cada alerta novo — inclusive lembretes de reunião — e cada emissão é um carimbo `now()` no lead.
- Cache local vazio ou parcialmente hidratado: `resolveLeadState` faz `if (!entry?.viewedAt) return "novo"`. Enquanto `pullLeads()` não conclui em uma sessão nova, o fallback é "novo" (efeito transitório; hoje não fica porque `listAllInvestors` também depende do mesmo cache).
- `MAX_PERSIST = 500` no barramento: eventos antigos caem, mas o cálculo usa o MAIOR — descarte não gera falso NOVO.
- Não existe nenhuma rotina de servidor, cron, GreenSales, reconciliação ou remarketing que grave/limpe `viewed_at`. Verificado por busca em `src/server/**`.

**8.** Criar `getInvestorLastActivity()` com lista branca explícita, em módulo próprio, e passar `executive-data.ts` a consumi-la. Menor risco que "retirar eventos": a remoção espalhada exige tocar em cada emissor (comentários, reuniões, alertas), com risco de quebrar consumidores legítimos como a Central de Alertas, que depende dos mesmos eventos. A função concentra a regra em um único ponto testável.

**9.** Manter derivado, com uma correção de fonte: a novidade deve ser calculada comparando `viewed_at` com colunas de atividade que já existem no servidor, não com o barramento `localStorage`. Persistir "NOVO/EM ANDAMENTO/ENCERRADO" como coluna criaria um quarto estado a sincronizar e voltaria o problema clássico de estado derivado desatualizado. `closed_at` e `viewed_at` já são a persistência necessária. Recomendação: expor `last_investor_activity_at` no servidor (coluna ou expressão de leitura) e derivar o rótulo a partir dela.

## 3. Histórico da jornada

**10.** Fontes que alimentam a timeline hoje (`crm_timeline` + `journey.server.ts`):
- Evento real de negócio: `lead_criado`, `contato_recebido`, `atividade_portal`, `oportunidade`, `primeiro_contato`, `cadencia_*`, `reuniao_agendada`, `mensagem_enviada`.
- Estado/snapshot: `mudanca_coluna`, `responsavel_mantido`, `relacionamento_oficial`.
- Evento técnico: `sincronizacao`, `sincronizacao_iniciada`, `sincronizacao_tardia`, `duplicidade_detectada`, `conflito_identificado`, `tempo_expirado`, `janela_reaberta`.
- Administrativo: `nota_executivo`, `conversa_aberta`, `distribuicao_realizada`, `portal_liberado`, `relacionamento_arquivado/restaurado`.
A whitelist já existe (`journey.server.ts:88-98`) e cobre só os relacionais — está correta.

**11.** "Status do Lead atualizado" em rajada vem de `lead.status.changed`, emitido por `markLeadViewed()`/`closeLead()`/`reopenLead()` (`lead-state.ts:112/125/139`) e por `executive-contact-dialog.tsx:81`. Como `markLeadViewed` é chamado em cada abertura de card e em cada montagem da ficha (`investor-profile-view.tsx:267,341`), há uma emissão por montagem. Correção correta: não emitir quando não houve mudança real (já existe `viewed_at` e nada mudou) — guarda no emissor, não filtro no consumidor.

**12.** Além de `lead.status.changed`, não deveriam aparecer como evento de negócio: `sincronizacao*`, `duplicidade_detectada`, `conflito_identificado`, `responsavel_mantido`, `conversa_aberta`, `tempo_expirado`, `janela_reaberta`, `acesso_bloqueado`. Todos já caem em "técnico" pela whitelist do agregador; o que falta é o mesmo critério valer para a exibição local (cache `crm.timeline.v1`).

**13.** "Contato registrado" repetido nasce do mapeamento de cache: `recordCrmEvent` só deduplica contra o ÚLTIMO registro dentro de 60s (`timeline.ts`), então N linhas do cache produzem N entradas. Unidade correta de deduplicação: o FATO — `(investorId, event, ocorrência de origem)`, isto é, um identificador determinístico do acontecimento (id da mensagem, id da tarefa, id do envio), nunca janela temporal.

**14.** Recomendação única: **manter e filtrar**. O cache local não é fonte de auditoria (a auditoria oficial está em `crm_timeline` e nas tabelas `relationship_*`, no servidor), mas limpar destruiria histórico exibível de máquinas específicas sem ganho. Migrar exigiria mapear eventos legados sem identidade determinística; ignorar por data esconderia fatos válidos. Filtrar por camada (relacional x técnico) resolve a exibição e preserva tudo.

## 4. Idempotência

**15.** Executado mais de uma vez por montagem/F5/realtime:
- Idempotente: `pullLeads()` (promessa compartilhada + substituição autoritativa), `syncPortalLead` (upsert por `id`), tarefas de cadência (índice único `crm_cadence_tasks_cycle_step_key` em `lead_id, channel, cycle_date, step_day`), fila do motor novo (índice único `relationship_queue_step` em `scope, run_id, lead_id, step`), alertas com id estável (`wa_novo_lead_<id>`).
- NÃO idempotente: `emitEvent()` (id aleatório a cada chamada), `markLeadViewed()` (grava `viewed_at` e emite evento a cada montagem), `recordCrmEvent()` (dedupe só contra o último item em 60s), `pushAlert` com id derivado de `Date.parse(date)` quando a data varia.

**16.** Janela temporal é o pior critério — é o que já falha hoje. A chave deve ser determinística e vinda do fato: `tipo + leadId + id da entidade de origem` (id da tarefa de cadência, id do envio em `relationship_message_sends`, id da reunião, id do lead para eventos únicos como `lead_criado`). O padrão já existe e funciona no projeto: `msg_e0_<cardId>` e `gs_<externalId>`.

**17.** Duplicidade só visual, sem duplicar no banco:
- barramento de eventos (uma emissão por montagem);
- `crm.timeline.v1` local x `crm_timeline` do servidor (mesma ocorrência em duas camadas);
- alertas do Workspace (`velox:workspace:alerts`) regenerados por sessão/navegador;
- Agenda: uma reunião de `portal_meetings` e um compromisso próprio criado manualmente para a mesma reunião aparecem como dois itens.

## 5. Reativação / reengajamento

**18.** **Estado de negócio persistido no servidor.** Hoje depende de `readLastSeen()` em `localStorage` (`workspace-alerts.ts:103-121`), o que significa: muda de máquina, o histórico de reativação some; abre em duas abas, duplica. R0–R3 é fluxo de cadência e não pode depender do dispositivo.

**19.** Regra recomendada: reativação = **atividade real do investidor após um período de silêncio configurado**, restrita a — resposta inbound no WhatsApp, nova entrada/sessão no Portal, novo acesso ao material, ou conclusão de módulo/simulador. "Qualquer atividade" é errado (inclui ação do executivo); "só retorno ao portal" é estreito demais (ignora o inbound, que é o sinal comercial mais forte).

**20.** **NÃO.** Abrir o card é ação do executivo. Hoje isso pode gerar reativação de forma indireta, porque `pushAlert` emite `investor.reactivated` e o próprio cálculo de atividade é contaminado — é o mesmo defeito do item 6.

**21.** **Não.** Mensagem enviada pelo executivo é TENTATIVA de reengajamento, não reativação. Se contar como reativação, a cadência R0–R3 se auto-alimenta: o motor envia, considera reativado, encerra o fluxo e o lead nunca é realmente recuperado.

**22.** **Sim** — é o sinal mais forte. Identificação: chegada de inbound gravada no servidor (`last_inbound_at` / `conversation_window_opened_at` em `portal_leads`, com o evento `contato_recebido` na timeline). Nunca por heurística de cliente.

**23.** **Sim.** O disparo correto é o evento de entrada já registrado no servidor: `journey.entry.registered` em `portal_journey_events` (gravado em `portal-leads.functions.ts` quando um lead existente entra de novo), que é justamente o caso de dedupe já tratado.

**24.** Mínimo para R0–R3 funcionar: **início** (quando o silêncio foi rompido), **origem/gatilho** (inbound, portal, material), **responsável** no momento, **encerramento** com motivo (respondeu, virou oportunidade, expirou) e **histórico append-only** de ocorrências — porque um mesmo lead pode reativar várias vezes. É a mesma modelagem por ocorrências já usada em `relationship_e20_occurrences`.

## 6. Motor de cadência + Agenda

**25.** `crm_cadence_tasks` = motor ANTIGO, tarefas de LIGAÇÃO sobre `crm_leads`, chave por ciclo/dia (`cycle_date`, `step_day` numérico), montado em `src/server/crm/cadence.server.ts`. `relationship_queue` = motor NOVO, fila de decisão do motor de relacionamento, com `scope`, `run_id` (homologação x produção), `flow`, `step` textual (E1, E3, E4), `due_at`, `priority`, `attempts`, executado por `src/server/relationship/scheduler.server.ts`.

**26.** Dados de hoje: fila nova em produção tem E1 (7 executadas, 4 pendentes), E3 (6 executadas, 1 pendente) e E4 (6 pendentes) — nenhuma delas aparece na Agenda, porque a função `agenda_cadence_tasks` lê apenas `crm_cadence_tasks`. O motor antigo tem 5 tarefas de ligação, todas `DONE`. Ou seja: 17 ações do motor oficial são invisíveis na Agenda hoje.

**27.** Motor oficial = **`relationship_queue`** (motor de relacionamento). Motivos: tem etapa textual, escopo produção/homologação, tentativas, prioridade, decisão auditável e é o único que suporta E0–E7/R0–R3 e a Biblioteca de Mensagens.

**28.** Estratégia recomendada: **somente leitura + descontinuar**. As 5 tarefas existentes estão todas concluídas — não há nada a migrar. Congelar a escrita em `crm_cadence_tasks`, manter a tabela para histórico/auditoria e passar a criar toda ação nova na fila oficial. Migrar dados seria trabalho sem lastro; manter os dois escrevendo viola a regra de "nunca dois motores ativos".

**29.** Chave única de uma ação: `scope + instância da jornada + leadId + step`. É exatamente o índice já existente `relationship_queue_step (scope, run_id, lead_id, step)` — falta apenas o conceito de instância (item 30), porque hoje `run_id` só separa homologação de produção.

**30.** **Sim, precisa.** Sem instância, a reentrada futura do mesmo lead em E1 colide com o E1 da primeira jornada e o índice único rejeita a nova ação — o lead reentrante ficaria sem cadência. Recomendação: um identificador de ciclo/jornada (`cadence_id` ou `journey_instance`) participando da chave, em vez de reaproveitar `run_id`.

**31.** A Agenda deve **consumir** o motor, sem tabela própria de tarefas. Ela já é assim: `agenda.functions.ts` lê três fontes — `workspace_agenda_events` (compromissos próprios, editáveis), `portal_meetings` (reuniões, somente leitura) e a função `agenda_cadence_tasks` (ações). A única mudança necessária é a função apontar para a fila oficial.

**32.** Sim. A representação já está definida no tipo: `kind: "acao"` com `startsAt`/`endsAt` nulos, exibida em faixa "Ações do dia" e prioridade mínima (`src/lib/agenda-types.ts:12-30`). Nenhum horário é fabricado — decisão já tomada e implementada.

## 7. Agenda e conflitos

**33.** Sim, a reunião existente deve bloquear compromisso de prioridade máxima: as duas ocupam a mesma pessoa no mesmo horário. Uma agenda que só protege contra si mesma não protege nada.

**34.** Hoje o banco **não** garante isso. O índice `workspace_agenda_events_no_overlap` é um `EXCLUDE` restrito a `WHERE priority = 'maxima'` dentro de `workspace_agenda_events`; `portal_meetings` é outra tabela e não participa. Para garantir no banco é preciso uma checagem que enxergue as duas fontes (validação transacional em função, ou espelho das reuniões na mesma tabela). Mudança necessária — não é ajuste de UI.

**35.** Prioridade média pode ter horário (a coluna `starts_at`/`ends_at` é NOT NULL para todo compromisso). Recomendação: média **não** participa da regra de bloqueio, apenas exibe aviso de sobreposição — bloquear tudo torna a agenda impraticável.

**36.** Confirmado: mínima é a faixa das ações derivadas do motor (`kind: "acao"`), sem horário. Definido em `agenda-types.ts`.

**37.** Somente visualizar. `portal_meetings` chega com `readOnly: true` (`agenda.functions.ts:76`) e a edição pertence ao módulo de reuniões — duas telas escrevendo na mesma reunião é fonte garantida de divergência.

**38.** Sim, automaticamente, e a fonte correta é `portal_meetings.status` — a Agenda é leitora. Não deve existir cópia do cancelamento em `workspace_agenda_events`.

**39.** Sim: `America/Sao_Paulo` sempre, independentemente do navegador. Já é a regra no servidor e na `agenda_cadence_tasks`; a divergência remanescente está na formatação do cliente (`agenda-dock.tsx`), que ainda usa o fuso do dispositivo.

## 8. Notas do executivo

**40.** Não atendem. `portal_leads.notes` é um campo TEXTO único, sobrescrito a cada edição (`workspace-lead-edit.ts:81-87`) — sem autor, sem data, sem histórico. `crm_cadence_tasks.note` pertence ao motor que será descontinuado. Nenhum dos dois suporta múltiplas ocorrências.

**41.** Estrutura recomendada: **uma tabela de notas com tipo**, suportando todos os casos — nota geral do lead, nota de ligação (com desfecho), nota de mensagem (vinculada ao envio) e ocorrência histórica. Um tipo + um vínculo opcional à entidade de origem cobre tudo sem criar quatro tabelas.

**42.** Sim, obrigatoriamente: data/hora e executivo autor. Sem isso não existe auditoria nem atribuição de responsabilidade.

**43.** Sim, pode ser editada, com versionamento imutável — o mesmo padrão já adotado na Biblioteca de Mensagens (editar cria nova versão, o conteúdo enviado fica congelado). Coerência com uma decisão já tomada no projeto.

**44.** A nota deve aparecer na jornada como entrada de tipo `nota` — já previsto na whitelist (`nota_executivo`, `timelineKind → "nota"`). A separação correta não é "aparece x não aparece", e sim CAMADA: nota é fato relacional do executivo, entra na jornada; ruído técnico continua na auditoria.

## 9. Rotas /f

**45.** Não, os 153 casos não precisam todos de conversão. Literal é tecnicamente apropriado em: stubs de redirecionamento legados (o destino é fixo por definição), strings de `createFileRoute` (têm de casar com o nome do arquivo) e testes. Precisam de `unitPath()` os links e navegações de tela — hoje 76 arquivos `.tsx` contêm `"/f/`.

**46.** Podem escapar: `navigate({ to: ... })` com template string, redirects em `beforeLoad`, URLs montadas para abrir nova aba (`window.open` no Remarketing/CRM), links copiados/compartilhados gerados no cliente e qualquer URL persistida em banco ou mensagem.

**47.** A fundação está pronta (`BUSINESS_UNITS`, `unitPath`, `currentUnit`, `isOperationalPath`), mas continua acoplada à Financeira em: 38 arquivos de rota fisicamente nomeados `f.*.tsx`, `DEFAULT_UNIT = "financeira"` usado como padrão implícito em toda chamada, e `RESERVED_UNIT_SLUGS` global (não por unidade). Abrir `/s` hoje exigiria duplicar arquivos de rota — a arquitetura de caminho está pronta, a de arquivos não.

**48.** Confirmado: não houve duplicação de componentes. As rotas antigas são stubs que apenas redirecionam (`executivo.investidores.tsx` é o padrão) e as telas existem uma única vez sob `/f`.

**49.** Os stubs preservam `search` (`throw redirect({ to, replace: true, search })`). Rotas legadas com parâmetros dinâmicos precisam ser verificadas caso a caso — o padrão do stub que li não repassa `params`.

**50.** Sim, há links internos ainda com literal — a checagem correta antes de construir é varrer `"/f/` e `to="/executivo` nos componentes; `unitPath()` continua com zero call sites.

## 10. Segurança / ownership

**51.** Proteção única e consistente confirmada nos quatro layouts: `f.executivo.tsx`, `f.crm.tsx`, `f.remarketing.tsx` e `f.portal-leads.tsx` — todos usando `OperationalGuard` (`src/components/auth/operational-guard.tsx`).

**52.** Nenhuma rota operacional ficou fora: `OperationalGuard` aparece exatamente nesses quatro layouts, e todo `/f/*` operacional é filho de um deles. O que fica fora do guard, por desenho, é `/f/$slug` (link público personalizado) — correto.

**53.** Sim. `/f/$slug` não altera identidade nem ownership: o slug só resolve o executivo do link; a preservação do proprietário está no servidor (`preservedOwner` e o bloco que impede rebaixamento de escopo `redistribuicao` em `portal-leads.functions.ts`). Unidade de negócio vem do prefixo da rota.

**54.** A lista atual (`executivo`, `crm`, `remarketing`, `portal-leads`) cobre as rotas estáticas existentes. Faltam previsíveis: `agenda`, `api`, `admin`, `auth`, `login`, `home`, `app`, `assets`, `public`, `s`, `seg`, `f`. Recomendação: derivar a lista automaticamente dos segmentos estáticos registrados na árvore de rotas, mais uma lista fixa de termos reservados.

## 11. Princípio de implementação

**55. Seguras agora, sem nova decisão:**
1. `getInvestorLastActivity()` com lista branca — corrige o NOVO regressivo.
2. Guarda em `markLeadViewed` para não emitir `lead.status.changed` sem mudança real — acaba com a tempestade do histórico.
3. Fixar `America/Sao_Paulo` na formatação do `agenda-dock`.
4. Renomear o rótulo "Novo" da tela Investidores para "Sem leitura".
5. Filtrar camada técnica na exibição local da timeline (manter e filtrar).

**56. Dependem de decisão:**
1. Motor oficial e descontinuação do motor antigo.
2. Chave única da ação com instância de jornada.
3. Reativação persistida (modelo de ocorrências R0–R3).
4. Bloqueio de conflito reunião × compromisso máximo no banco.
5. Estrutura das Notas do Executivo.
6. Conversão dos literais `/f/` e lista de slugs reservados.

**57. Ordem de dependência:**
```text
1. atividade real do investidor (whitelist)
        └─> 2. reativação persistida (usa a mesma definição de atividade)
                └─> 3. motor oficial + chave com instância de jornada
                        └─> 4. Agenda lendo a fila oficial
                                └─> 5. Notas vinculadas a ação/mensagem
6. rotas /f e slugs reservados (independente, pode correr em paralelo)
```
Erro em 1 obriga a refazer 2 e 3. Erro na chave de 3 obriga a refazer 4 e 5. Fechar 1 e 3 antes de qualquer código é o que evita retrabalho.

**58. Arquitetura recomendada:** servidor como fonte única de fatos, cliente como projeção. Concretamente: (a) atividade do investidor é uma grandeza do servidor, derivada de colunas e eventos persistidos, nunca do `localStorage`; (b) um único motor de cadência (`relationship_queue`) com etapa textual e chave `scope + instância + lead + step`, servindo E0–E7 e R0–R3 pelo mesmo mecanismo; (c) Agenda e Workspace são LEITORES do motor, sem inteligência própria; (d) todo fato tem identidade determinística vinda da origem, o que torna toda reexecução idempotente; (e) conteúdo sempre versionado com snapshot no envio; (f) navegação sempre por `unitPath()`, para que `/s` e `/seg` sejam configuração e não cópia. Motivo: cada regressão desta rodada (NOVO voltando, tempestade de histórico, reativação por dispositivo, ações invisíveis na Agenda) tem a mesma raiz — estado de negócio derivado no navegador.

**59. Não alterar agora:** sincronização GreenSales e reconciliação (funcionando e sensível a dados reais); blindagem de exclusão de leads e gatilhos de guarda; `set_lead_operational` e a política de `portal_leads`; fluxo E0 e simulação de homologação; renomeação física em massa das rotas `f.*.tsx`; limpeza do `localStorage` histórico. Em todos, o risco de regressão supera o ganho imediato.

**60. DECISÕES NECESSÁRIAS ANTES DO PRÓXIMO COMANDO DE CONSTRUÇÃO**
1. Confirmar a lista branca de atividade real do investidor (item 2) e se `meeting.requested` de origem do investidor entra nela.
2. Confirmar `relationship_queue` como motor oficial e o motor antigo como somente leitura.
3. Definir o conceito de instância de jornada na chave da ação (reentrada do mesmo lead na mesma etapa).
4. Definir se a reativação vira estado persistido no servidor, com o gatilho da regra do item 19.
5. Definir se reunião existente bloqueia compromisso de prioridade máxima no banco (item 34).
6. Aprovar a estrutura única de Notas do Executivo com tipo, autor, data e versionamento.
7. Aprovar a lista definitiva de slugs reservados.
