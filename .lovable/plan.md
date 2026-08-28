# Auditoria Técnica Pré-Parte B — Estado Real do Projeto

Nenhuma alteração foi feita. Este documento responde às 85 perguntas agrupadas por bloco, com base no código, banco e rotas atuais.

## BLOCO 1 — Reestruturação /F

1-2. Implementada e completa. Existem 37 arquivos de rota sob `/f`: `f.tsx`, `f.$slug`, `f.crm` + `f.crm.index`, `f.remarketing` + `f.remarketing.index`, `f.portal-leads`, `f.executivo` (layout) + `f.executivo.index` e mais 30 telas `f.executivo.*` (administracao, alertas, backups, biblioteca, brain, campanhas, captacao, celebracao, central-backup, configuracoes, criativa, dashboard, greensales, greensales-sync, home, homologacao, identidade, institucional, investidores, kpi, laboratorio, perfil, recursos, relatorios, reunioes, revista, templates, teste-cadencia, usuarios).

3. As rotas antigas são stubs reais: 34 arquivos contêm apenas `beforeLoad` com `throw redirect({ to: "/f/...", replace: true, search })` e `component: () => null`. Não há tela duplicada — a UI existe uma única vez, sob `/f`.

4. Sim, parcialmente. A navegação usa caminhos `/f/...` literais (não caminhos antigos), mas os literais estão espalhados: 153 ocorrências, das quais 24 concentradas em `src/components/executive/executive-shell.tsx`.

5. O helper existe (`src/lib/business-unit.ts`: `unitPath`, `currentUnit`, `isOperationalPath`, `validateExecutiveSlug`) mas `unitPath()` **não é chamado em lugar nenhum** — zero call sites fora do próprio arquivo. Na prática a navegação é string literal.

6. Conceitualmente sim (`BUSINESS_UNITS` com `financeira/solar/seguros`, flag `operational`), operacionalmente não: só `/f` tem rotas; `/s/$slug` e `/seg/$slug` existem apenas como entrada de link público.

7. Não há conflito de resolução: TanStack dá precedência ao segmento estático sobre `$slug`. O risco é de *cadastro*: um executivo com slug `crm` ficaria inacessível.

8. Sim, `validateExecutiveSlug` rejeita (não corrige em silêncio) os `RESERVED_UNIT_SLUGS` = executivo, crm, remarketing, portal-leads. Falta cobrir slugs futuros (`s`, `seg`, `api`, `origem`, `manual`).

9-10. Camada única: `src/components/auth/operational-guard.tsx` aplicado nos layouts `/f/*` com `ssr: false`. Não localizei rota interna sem o guard. Ressalva: o guard é client-side; a proteção real dos dados continua sendo RLS.

## BLOCO 2 — Agenda Operacional

11-13. Global. `agenda-dock.tsx` é montado uma vez em `__root.tsx` e abre como painel sobreposto, sem mudar a rota. Aparece em todos os ambientes onde o root renderiza — Executivo, CRM, Remarketing e Portal dos Leads.

14. Três fontes, em `src/lib/agenda.functions.ts`: `workspace_agenda_events` (compromissos próprios, leitura/escrita), `portal_meetings` (reuniões, **somente leitura**) e a função `agenda_cadence_tasks` (tarefas de cadência).

15. Somente referenciadas. Não há cópia de `portal_meetings` para `workspace_agenda_events`.

16. Vêm do banco via `agenda_cadence_tasks` (SECURITY DEFINER), que lê `crm_cadence_tasks`. A Agenda não inventa ações. **Porém** essa função lê apenas o motor antigo de ligações: as mensagens pendentes do motor novo (`relationship_queue`) são invisíveis na Agenda.

17. Coluna `priority` em `workspace_agenda_events` (maxima/media/minima), com `PRIORITY_META` no dock apenas para cor/rótulo.

18-19. Sim, no banco: extensão `btree_gist` + constraint `EXCLUDE` que impede sobreposição entre eventos de prioridade `maxima` do mesmo dono; o servidor devolve `reason: "conflito"` antes de gravar e o dock exibe o conflito. Reuniões de `portal_meetings` **não** entram na verificação de conflito — só eventos máxima × máxima.

20-21. `workspace_agenda_events`, 11 colunas (id, owner/executive, title, starts_at, ends_at, priority, source, ref_id, notes, created_at, updated_at), com a constraint EXCLUDE citada.

22. 4 políticas (leitura/criação/edição/exclusão) escopadas ao dono/administração.

**Divergência de fuso:** o dock monta janelas e horários com `new Date()` e `toLocaleString` do navegador, enquanto o servidor trabalha em `America/Sao_Paulo`. Máquina fora de -03:00 vê a agenda deslocada.

## BLOCO 3 — Histórico da Jornada / Duplicidade

23-25. A "tempestade" de `Status do Lead atualizado` **não existe no banco**: `crm_lead_events` tem 773 registros `lead_sincronizado` e zero de status. A duplicação é do barramento de eventos em localStorage (`velox:events:v1`, `src/lib/events/bus.ts`, sem deduplicação, teto de 500). Causa: `markLeadViewed` (`src/lib/lead-state.ts`) é chamado incondicionalmente no clique do card e no `useEffect` de montagem do perfil, e emite `lead.status.changed` a cada confirmação, mesmo quando o lead já estava `em_andamento`. Cada remontagem = mais um evento, no mesmo segundo.

26-29. Idempotência na GreenSales existe e é sólida: identidade por `external_source='greensales'` + `external_id`, id interno determinístico `gs_{externalId}`, `upsert(onConflict:'id')` e deduplicação adicional por telefone normalizado. Evento repetido não gera segunda linha.

30-31. No banco, sincronização não cria evento de status. No cliente, sim: qualquer visualização gera o evento, sem comparar estado anterior — é exatamente o problema 23.

32-34. `investor.reactivated` é heurística de cliente (`src/lib/workspace-alerts.ts`, `evaluateInvestorMovement`), baseada em `readLastSeen()` do localStorage. Não é estado persistido, não inicia jornada de reengajamento e é dependente de dispositivo: em outro computador o mesmo lead pode parecer "novo".

35. Não há recriação de card na sincronização; o card é derivado do banco.

36. Parcial. O banco distingue novo / em andamento / encerrado (`viewed_at`, `closed_at`, `set_lead_operational`). **Não existem** como estado persistido: reativado, voltou espontaneamente, em reengajamento — hoje são inferência local.

37. Não, pela chave determinística `gs_{id}`.

38-39. Sim, o ID original da GreenSales é imutável e é a chave de referência.

40-41. Risco residual único: lead criado manualmente no Workspace com o mesmo telefone e depois importado — mitigado pela deduplicação por telefone normalizado, não impedido por constraint no banco.

42-44. A separação existe desde o bloco anterior: `src/server/relationship/journey.server.ts` aplica whitelist de eventos relacionais (Jornada do Investidor) e mantém o restante como Auditoria Técnica. O que ainda vaza é o feed do cliente, não a Jornada do servidor.

45. Recomendação: guarda de mudança real em `markLeadViewed` (só emitir quando o estado efetivamente muda) + deduplicação por chave `tipo+lead+minuto` no bus. Nada é apagado; o histórico legítimo permanece.

## BLOCO 4 — GreenSales / Sincronização

46-50. Fluxo: `src/server/greensales.server.ts` (login, `fetchTodayLeads`, `fetchLeadDetail`, reconciliação contínua) → `src/lib/greensales-sync.functions.ts` normaliza e faz upsert em `portal_leads` (escopo `green_sales`) → `src/server/crm/lead-sync.server.ts` faz a persistência idempotente e o roteamento → estado operacional derivado por `src/lib/lead-state.ts` → jornada montada por `journey.server.ts`. Criar × atualizar é decidido pelo mesmo `upsert` por `id` determinístico; "reativar" não é decidido no servidor (ver 32).

51-53. Polling de ~10s com trava de concorrência e `runSyncMuted` (`src/lib/sync-bus.ts`) e debounce de 1,5s (`src/lib/portal-leads-sync.ts`). Idempotência por chave determinística. Não há lock transacional no banco, mas o upsert torna a corrida inofensiva.

54-55. Parcialmente. `crm_lead_events` e `crm_sync_runs` permitem rastrear a rodada de sincronização, mas os eventos do cliente não têm origem gravada — para os 10 registros iguais do exemplo, hoje **não** é possível dizer qual montagem os criou.

## BLOCO 5 — Notas do Executivo

56. Não existe uma estrutura dedicada "Notas do Executivo". Há `notes` em `portal_leads` (campo único, gravável por `set_lead_operational`) e o desfecho da ligação em `crm_cadence_tasks.note`.

57. Data/hora e resultado sim; **duração não existe**; observação apenas como texto livre em `note`.

58. Mensagens completas existem, mas em outra camada: `relationship_message_sends` com snapshot congelado do texto renderizado.

59-60. Não há diferenciação visual entre nota de ligação e nota de mensagem, nem resumo no card com modal de conteúdo completo.

61. Sim, tudo é vinculado ao ID único do lead.

## BLOCO 6 — Motor de Cadência

62. Existem **dois**: o antigo de ligações (`src/lib/crm/cadence.ts` + `src/server/crm/cadence.server.ts`, tabela `crm_cadence_tasks`) e o novo de relacionamento (`src/lib/relationship/*`, `src/server/relationship/*`, tabelas `relationship_queue`, `relationship_cadences`, `relationship_message_sends`).

63. Sim, `relationship/decide.ts` + `scheduler.server.ts` calculam a próxima ação; o motor antigo calcula por offsets de dias.

64-65. Etapas: `relationship_cadences` / `relationship_step_content_bindings`. Execução: `relationship_queue` e `relationship_message_sends` (novo), `crm_cadence_tasks` (antigo).

66. Parcialmente: há distinção de canal e de envio simulado × real, mas não um campo explícito `automatico | assistido`.

67. A infraestrutura suporta, **mas a nomenclatura atual é numérica por dia**: as tarefas usam `step_day` (inteiro) e o rótulo exibido é `D{n}`. Falta um `step_key` textual (E0…E7, R0…R3).

68-69. Sim — o acoplamento etapa↔dia existe em `src/lib/crm/cadence.ts` (`CADENCE_CONFIG.offsets`, D1–D7/D12) e em `crm_cadence_tasks.step_day`, além do rótulo `D{n}` na UI e na função `agenda_cadence_tasks`.

70. Hoje não. Com `step_day` como chave, "E6 daqui a seis meses" não é representável, e a contagem de E7 a partir da geração de E6 não existe. Isso é pré-requisito da Parte B.

## BLOCO 7 — Regra de Negócio Crítica

71. Sim, existe caminho automático no motor novo (`dispatch.server.ts`, `auto-reply.server.ts` com resposta 24h restrita), guardado por ambiente.

72. Sim, "Ligações do Dia" / Ação do Dia apresentam a ação para execução manual.

73. Existe na prática, não como campo de dados — a distinção é por caminho de código, não por atributo consultável.

74. E0 está preparado para automático/template, porém **em modo simulação**: `src/lib/creative/e0-simulation.ts` ativo e `crm_meta_templates` vazia. Sem templates Meta cadastrados, não há disparo real.

75. Só a resposta automática de 24h; o restante exige ação explícita. As travas de ambiente (homologação nunca chama a Meta) estão ativas.

76-77. Risco real de duplicidade em "Ações do Dia": a Agenda lê apenas `crm_cadence_tasks`, o motor novo grava em `relationship_queue`; quando as duas fontes forem unificadas sem chave comum, a mesma etapa pode aparecer duas vezes. Há idempotência por tarefa concluída no motor antigo (`status`), mas não uma chave única `lead+etapa+instância` compartilhada entre os motores.

## BLOCO 8 — Conclusão

### A) Correto e preservar
Stubs de redirecionamento e as 37 rotas `/f`; `OperationalGuard` único com `ssr: false`; identidade determinística GreenSales (`gs_{id}` + external_id) e deduplicação por telefone; constraint EXCLUDE de conflito de agenda; separação Jornada × Auditoria Técnica no servidor; blindagem de exclusão de leads (`portal_lead_guard_log`); versionamento imutável da biblioteca e snapshot de mensagens; travas de ambiente de disparo.

### B) Incorreto e precisa corrigir
1. `markLeadViewed` sem guarda de mudança real → tempestade de eventos no feed local (`src/lib/lead-state.ts`).
2. Fuso do dock da Agenda no relógio do navegador em vez de `America/Sao_Paulo` (`src/components/agenda/agenda-dock.tsx`).
3. Desfecho padrão `?? "SIM"` em `completeCadenceTask` (`src/server/crm/cadence.server.ts`) — grava resultado não informado como positivo.
4. `unitPath()` morto com 153 literais `/f/` (24 em `executive-shell.tsx`).
5. Reativação apenas em localStorage (`workspace-alerts.ts`) — dependente de dispositivo.

### C) Incompleto e precisa implementar
`step_key` textual (E0–E7 / R0–R3) desacoplado de dias, com contagem relativa à geração da etapa anterior; Agenda enxergando `relationship_queue` (hoje cega para 24 mensagens pendentes); Notas do Executivo com tipo (ligação/mensagem), duração e modal de conteúdo; campo explícito automático × assistido; estados persistidos de reativado/reengajamento; templates Meta cadastrados antes de sair da simulação do E0.

### D) Risco técnico
Unificar as duas fontes de "Ações do Dia" sem chave única compartilhada (duplicidade de ação); desativar a simulação do E0 com `crm_meta_templates` vazia (disparo indevido ou falha); mexer no barramento local sem preservar o histórico já gravado (perda de histórico); ampliar a checagem de conflito para `portal_meetings` sem definir a regra (pode bloquear agendamentos legítimos).

### E) Decisões necessárias antes da Parte B
1. Qual motor de cadência é o oficial daqui em diante — e o destino das tarefas legadas em `crm_cadence_tasks`.
2. Vocabulário definitivo: `E-n`/`R-n` substitui `D{n}` na UI, ou convivem?
3. Reuniões de `portal_meetings` devem bloquear conflito de prioridade máxima?
4. Reativação: estado persistido no banco (e quem o grava) ou permanece alerta visual?
5. Desfecho de ligação sem resposta: obrigatório ou "não informado"?
6. Notas do Executivo: tabela própria ou extensão da timeline existente?

## Ordem segura recomendada para a Parte B
1. Fundação: `step_key` textual + chave única de ação.
2. Correções invisíveis: guarda de visualização, fuso da Agenda, remoção do padrão "SIM".
3. Unificação da Agenda com o motor novo.
4. Notas do Executivo.
5. Etapas E6/E7 e reengajamento persistido.
6. Saída da simulação do E0, somente após cadastro dos templates Meta.
