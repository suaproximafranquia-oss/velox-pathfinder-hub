# Diagnóstico técnico — 2ª rodada (fechamento de regras)

Somente leitura. Nada foi alterado.

## 1. Regra-mestra da Ação do Dia (posição 1 protegida)

Comportamento atual: `currentDailyAction()` (`daily-actions-gate.server.ts:84`) recalcula a lista, pega o primeiro item automático e, se for item de fila ainda não reivindicado, faz `UPDATE ... status PENDING → PROCESSING` condicionado a `status='PENDING'` (atômico). `actionRank()` devolve 0 para `claimed`, então o item reivindicado fica no topo em qualquer reordenação.

- O claim é suficiente contra concorrência de duas abas, mas **não é o que garante a posição 1** — quem garante é `actionRank(claimed)=0`. Só itens de `relationship_queue` são reivindicáveis; reunião, agenda, encerramento e aviso **nunca** recebem `claimed`.
- Quem pode reordenar depois: `sortDailyActions` via `continuityLeadId` — a continuidade da MESMA lead passa até na frente de um item reivindicado de outra lead (é regra intencional, `daily-actions.ts:266-276`). Nenhum outro caminho remove o item corrente.
- Rank 0 de compromisso (`priorityMax` + `agora`/`atrasada`) **empata** com o item reivindicado; o desempate seguinte é `startsAt`/`dueDate`. Divergência real: **um compromisso com horário anterior pode ficar à frente de um item PROCESSING**. É o único cenário em que a posição 1 pode ser tomada.
- Rank 0,5 (aviso) nunca substitui: `isAutomaticDailyAction` exclui `alerta`.
- Timers: o intervalo de 30 s do overlay (`daily-actions-overlay.tsx:274-290`) reclassifica e recalcula `selectedKey`; ele respeita `transitioningRef` e segura pendência/aviso abertos, mas **pode trocar o card selecionado** se a ordenação mudar. Não há realtime.

Menor alteração: no desempate de `sortDailyActions`, colocar `claimed` antes de qualquer outro rank 0 (comparar `claimed` como critério anterior ao rank). Isolada em `src/lib/crm/daily-actions.ts`. Risco baixo; afeta só `/f`.

## 2. Hierarquia após a posição 1

- Hoje **não existe** distinção entre "prioridade" e "posição protegida": `actionRank` é usado ao mesmo tempo como ordem de fila e como seleção do corrente (`list.find(isAutomaticDailyAction)`).
- Rank 0 é, na prática, "tomar posição 1", porque a seleção é sempre o primeiro automático da lista ordenada.
- A seleção **não** espera o item sair de PROCESSING; ela é recalculada a cada chamada, e só continua correta porque `claimed` também vale 0.
- Função responsável por escolher o próximo: `currentDailyAction()` — é onde a decisão deve morar.
- A hierarquia desejada (compromisso > lead novo > atrasada > hoje > demais) **não bate** com o rank atual: lead novo (E0) é 2 e atrasada é 3, o que já está correto; o problema é só compromisso em `pendente` (7).
- Mudança necessária: **seleção + bucket**, não rank. Isolada em `daily-actions.ts` + `daily-actions-gate.server.ts`.

## 3. Agendamento — T-5, T=0, T+5

Atual (`resolveBucket`, `daily-actions.ts:176-188`): `startsAt > agora + 5min` → `futura`; dentro de ±5 min → `agora`; passou de 5 min → `pendente` (rank 7, fora da seleção automática).

- Diferença semântica: `agora` = trabalho executável; `pendente` = consulta sob demanda, fora da seleção.
- **Não é preciso bucket novo.** Basta o compromisso sem desfecho não cair para `pendente`; ele deve virar `atrasada` (ou permanecer `agora`), mantendo `priorityMax` → rank 0.
- Consumidores que dependem de `pendente` para compromisso: `assertCommitmentAction` (`daily-actions-gate.server.ts:236-250`) aceita explicitamente `bucket==="pendente"` como exceção; `collapseByLead` manda `pendente` para `loose`; `reclassifyDailyActions` força `pendente` quando `followUp.mode === "revisao_24h"`. **Conflito real**: se o compromisso deixar de ser `pendente`, `assertCommitmentAction` deixa de encontrá-lo por esse caminho e passa a depender de ser a ação corrente. Decisão necessária: manter a exceção de `assertCommitmentAction` também para `atrasada`, ou aceitar que o desfecho só ocorra quando o compromisso for o corrente.
- "Atrasado" pode ser apenas propriedade visual: já existe `action.overdue`.
- Reclassificação deveria ser disparada por: abertura da Ação do Dia + conclusão da posição 1 + timer. O timer de 30 s continua útil como rede, mas hoje é o único gatilho entre leituras — daí a sensação de demora.
- Menor alteração: em `resolveBucket`, compromisso com `startsAt` passado e sem desfecho → `atrasada` em vez de `pendente`; e disparar uma reclassificação logo após concluir a posição 1. Arquivos: `src/lib/crm/daily-actions.ts`, `src/components/crm/daily-actions-overlay.tsx`, possivelmente `daily-actions-gate.server.ts` (exceção acima). Compartilhado apenas dentro de `/f`.
- Risco de regressão: itens com `followUp.mode === "revisao_24h"` e a Central de Operações, que lista pendências.

## 4. Aviso do Portal — regra definitiva

Atual (`portal-activity-alerts.server.ts`): `RETURN_GAP_MS = 7d` (intervalo entre acessos que gera novo aviso) e `VISIBLE_WINDOW_MS = 7d` (linha 124: aviso mais velho que 7 dias é descartado).

- O código **já diferencia** as duas coisas, mas aplica as duas. A regra de negócio só quer a primeira.
- Remover `VISIBLE_WINDOW_MS` não afeta a detecção de novos acessos (são constantes independentes). É uma linha.
- Duplicação: não há, a chave `portal_alert:<leadId>:<isoDoEvento>` é determinística e a dedup por `actionKey` já existe.
- Conclusão é idempotente na leitura (conjunto de `actionKey` concluídos), mas **não no banco**: clique duplo insere duas linhas em `relationship_engine_log`. Efeito prático: nenhum, só ruído de log. Aviso concluído não volta após recarregar.
- Não é preciso tabela nova; o identificador estável já existe.
- Rank 0,5 já corresponde exatamente à regra ("atrás da posição 1, acima do resto"). Não precisa mudar.
- Ponto de atenção ao remover a janela: avisos antigos nunca concluídos aparecerão de uma vez. Decisão necessária: aceitar o acúmulo, ou considerar concluídos os anteriores a uma data de corte.

## 5. Aviso do Portal — seleção automática

- Ele fica na seção lateral porque `isAutomaticDailyAction()` exclui `bucket === "alerta"` (`daily-actions.ts:237-243`) — `buildDailyActions` inclui, `currentDailyAction` filtra.
- Razão de negócio original: garantir que um sinal informativo nunca vire obrigação comercial nem seja reivindicado.
- É seguro deixá-lo participar da seleção **desde que** ele nunca seja reivindicado e nunca desloque `claimed`. Como não tem `queueItemId`, o claim não é acionado; o risco é só de ordenação.
- Mudança mínima: permitir `alerta` em `isAutomaticDailyAction` **apenas quando não houver item reivindicado**, ou manter a exclusão e selecionar o aviso na interface quando a posição 1 estiver vazia. A segunda é mais segura (isolada no overlay).
- "Concluído" já retira só aquele aviso (chave por evento).
- Conflito a decidir: se o aviso virar automático, `assertCurrentAction` passa a exigir que ele seja resolvido antes das ações comerciais — o que contraria "não é executável". Recomenda-se resolver na apresentação, não no gate.

## 6. Ligação 2 → Mensagem E0

- O servidor roda `tickLead` **antes** de responder e `queueAfterOutcome` devolve a fila já atualizada: a Mensagem E0 está persistida quando `result.queue` chega.
- `completeWithStability` (`daily-actions-overlay.tsx:230-256`) descarta `result.queue`, espera 4 000 ms fixos e chama `revalidateCompletion()` (leitura completa). Há ainda `scheduleSettle` com releituras agendadas.
- `result.queue` vem de `currentDailyAction(skipReconcile:true)`, isto é, a lista oficial normalizada — contém a próxima ação do mesmo lead, com continuidade já aplicada no servidor. Cenário de fila incompleta: `skipReconcile` pula a reconciliação de E0 manual, então uma ação que dependa dessa reconciliação pode faltar; e falha de gravação retorna sem `queue`.
- Não há necessidade técnica dos 4 s nem de 1 s. A releitura pode ficar como fallback (quando `result.queue` estiver ausente ou `result.ok === false`).
- O caminho que já consome a fila (`resolveNow` → `onResolved` → `applyResult` → `commitQueue`) pode ser reutilizado tal como está.
- Menor alteração: dentro de `completeWithStability`, se `result.ok && result.queue`, chamar `commitQueue` imediatamente e só então agendar `scheduleSettle`; manter `revalidateCompletion()` apenas no caso contrário. Arquivo único: `src/components/crm/daily-actions-overlay.tsx`. Risco: perder a garantia de "nunca liberar lista não revalidada" — mitigado porque a lista vem do próprio servidor.

## 7. Formulário institucional — Opção B (responsável = Thiago)

Atual: `unit-interest-form.tsx` → `registrarInteresseUnidade` → `group_unit_leads` (+ `group_unit_lead_events`), campo `unit` com a marca, `origin`/`campaign`/`from_group` com a origem, sem responsável, `first_contact_status = pendente`. Solar (`/s`) e Seguros (`/seg`) usam exatamente o mesmo componente e a mesma tabela — só muda o valor de `unit`.

- Mecanismo já existente para entrar no fluxo operacional: `intakeLead()` (`src/server/crm/lead-intake.server.ts`), que já aceita `entryOrigin` (inclusive `PORTAL`), grava origem legível, resolve responsável e dispara E0/RE0 de forma idempotente.
- Comparação das opções: (A) gravar direto em `portal_leads` ignora `intakeLead` e perde cadência/origem padronizada; (B) manter `group_unit_leads` como registro institucional e chamar `intakeLead` na mesma transação lógica é a que **mais reutiliza infraestrutura**, preserva marca e origem e evita duplicidade (a chave de origem do `intakeLead` é idempotente); (C) só criar visão operacional não coloca o lead na cadência; (D) não há outro mecanismo.
- Recomendação técnica: **B**. Marca fica em `group_unit_leads.unit` e pode ser repetida na origem do card; responsável inicial fixo = executivo do Thiago (`usr_thiago`), sem rotação.
- Decisão pendente: o lead deve **iniciar E0 automaticamente** ou apenas nascer como lead novo para o Thiago? O `intakeLead` hoje abre E0; manter isso significa cadência automática para lead institucional. Precisa da sua decisão.
- Segunda decisão: um `entryOrigin` novo (ex.: `INSTITUCIONAL`) ou reaproveitar `PORTAL`. Reaproveitar mistura relatórios; criar um novo toca `src/lib/relationship/origin.ts`, compartilhado.
- Risco em `/f`, `/s`, `/seg`: o formulário é o mesmo componente para as três marcas, então a mudança atinge as três simultaneamente. Leads atuais não são afetados (só novas submissões).

## 8. Link cru — precedência definitiva

- A precedência proposta (identidade oficial da sessão > responsável oficial > slug do link > navegador > genérico) é implementável e **é o inverso da atual** em `getSessionResponsibleExecutive` (`src/lib/portal/session-responsible.ts:18-19`), que consulta primeiro o slug de `localStorage`.
- Fluxo legítimo do slug: investidor **ainda não reconhecido** entrando por link personalizado — aí o slug é a única informação disponível e deve valer. Por isso a precedência não deve ser removida, apenas rebaixada para depois do responsável oficial.
- `ensurePortalToken()` (`src/lib/portal-token.ts:57-69`) já tenta a sessão, mas só depois de `loadLeads()`; inverter a ordem é seguro porque a validação é server-side (`portal-token.server.ts`).
- Dependência legítima do cache local que permanece: visitantes **sem** identidade reconhecida (pré-conversão) — aí `loadLeads()`/sessão local são as únicas fontes.
- Arquivos: `session-responsible.ts` e `portal-token.ts`. Compartilhado com `/s/portal` (mesmo componente), logo a mudança atinge Solar também — mas o efeito é o mesmo desejado.

## 9. Editor transversal

- Faltam slots para as imagens institucionais das marcas em `src/assets/brands/*` usadas por `BrandPage`: hero e card de Financeira, Solar e Seguros — **cerca de 5 a 6 slots** (`financeira-hero`, `solar-hero`, `solar-card`, `seguros-hero`, `seguros-card`), a confirmar contra `brand-content.ts` no momento da construção.
- Essas imagens podem usar a infraestrutura atual diretamente: basta entrada em `PORTAL_ASSET_SLOTS` + `usePortalAsset` no ponto de render.
- Não devem ser editáveis: logotipos das marcas e imagens da Revista (pipeline próprio).
- A autorização (`recurso "revista"`) serve para todas as marcas sem alteração; `unit` é suficiente para isolamento (único `(unit, asset_key)`), e não há risco de override da Financeira aparecer na Solar ou Seguros, desde que cada página passe seu `unit`.
- Montagem: montar no shell global exigiria que o shell conhecesse o `unit`, o que não existe em `/financeira` `/solar` `/seguradora`. **Menor risco: montar por área**, passando `unit` explicitamente, como já é feito em `/f` e `/universo`.

## 10. Simulador

- O padrão de ocultar já existe: `whatsapp-floating.tsx` faz `if (insideOverlay) return null;` e `if (reading) return null;` (linhas 79-81).
- Reutilizável: sinalizar "simulador aberto" pelo mesmo mecanismo já usado para revista/iframe.
- Menor alteração: acrescentar essa condição; nada da lógica do Simulador é tocado.
- Risco no comportamento global do WhatsApp: baixo, desde que a supressão seja apenas enquanto o modal estiver aberto. O componente é compartilhado com `/s/portal`.

## 11. Central de Homologação

- O item é `PortalEditorSection()` em `src/routes/f.executivo.configuracoes.tsx`: bloco estático com um link para `/f?modo=editor`. Sem estado e sem permissão própria — a autorização acontece ao abrir `/f`.
- Pode ser movido sem qualquer alteração de lógica; basta reutilizar o mesmo bloco na Central de Homologação.

## 12. Itens que não devem ser mexidos

Confirmado: matching de identidade, nome não bloqueante, prevenção de duplicidade, autorização server-side do Editor, isolamento por `unit`, claim atômico, criação server-side da Mensagem E0, motor de cadência, GreenSales, Revista, CRM em funcionamento, Central de Operações, Central de Reuniões, Central de Alertas e Backup.

Dependências diretas a registrar: a correção do compromisso toca `assertCommitmentAction` (proteção da posição 1 / gate); a Opção B do formulário depende de `intakeLead` (motor de cadência) e de permissões do Thiago (leitura, sem alteração de matriz).

## 13. Resposta final

**1. Regras confirmadas** — posição 1 protegida por `claimed`; aviso nunca vira ação comercial; conclusão de aviso já é definitiva; identidade oficial vence o nome digitado; isolamento por `unit`; Mensagem E0 já existe no servidor ao responder.

**2. Regras que precisam de decisão**
- Compromisso fora de `pendente`: manter a exceção de desfecho em `assertCommitmentAction`?
- Remover a janela de 7 dias: aceitar o acúmulo de avisos antigos ou aplicar corte inicial?
- Aviso participar da seleção: pela apresentação (recomendado) ou pelo gate?
- Formulário institucional: iniciar E0 automaticamente ou nascer como lead novo?
- Formulário institucional: origem nova (`INSTITUCIONAL`) ou reaproveitar `PORTAL`?

**3. Divergências entre regra e código** — (a) compromisso vira `pendente` após T+5 e sai da fila; (b) compromisso rank 0 pode empatar/ultrapassar item reivindicado; (c) aviso nunca é selecionado automaticamente; (d) janela de 7 dias esconde aviso aberto; (e) frontend descarta `result.queue` e espera 4 s; (f) CTA prioriza navegador sobre responsável oficial; (g) token consulta cache antes da sessão; (h) lead institucional não entra no fluxo operacional; (i) imagens institucionais sem slot; (j) botão flutuante sobre o Simulador.

**4. Menor alteração por divergência** — descrita ao final de cada seção acima.

**5. Arquivos** — `src/lib/crm/daily-actions.ts`; `src/server/crm/daily-actions-gate.server.ts`; `src/server/crm/portal-activity-alerts.server.ts`; `src/components/crm/daily-actions-overlay.tsx`; `src/lib/portal/session-responsible.ts`; `src/lib/portal-token.ts`; `src/lib/group/unit-leads.functions.ts` + `src/server/crm/lead-intake.server.ts`; `src/lib/portal/asset-overrides.ts` + `src/components/group/brand/brand-page.tsx`; `src/components/shared/whatsapp-floating.tsx`; `src/routes/f.executivo.configuracoes.tsx`.

**6. Funções** — `resolveBucket`, `actionRank`, `sortDailyActions`, `isAutomaticDailyAction`, `normalizeDailyActions`, `currentDailyAction`, `assertCommitmentAction`, `listPortalActivityAlerts`, `concludePortalActivityAlert`, `completeWithStability`, `revalidateCompletion`, `getSessionResponsibleExecutive`, `ensurePortalToken`, `registrarInteresseUnidade`, `intakeLead`, `usePortalAsset`.

**7. Tabelas/estruturas** — `relationship_queue`, `portal_meetings`, `workspace_agenda_events`, `portal_journey_events`, `relationship_engine_log`, `portal_leads`, `group_unit_leads`, `portal_asset_overrides`.

**8. Risco de impacto cruzado** — Ação do Dia, compromissos e avisos: só `/f`. CTA, token e Simulador: `/f` e `/s/portal` (componentes comuns). Formulário institucional e slots de marca: `/`, `/financeira`, `/solar`, `/seguradora`, `/s`, `/seg`.

**9. Dependências** — compromisso ↔ gate de posição 1; aviso automático ↔ `isAutomaticDailyAction` (usada também pela continuidade); formulário ↔ `intakeLead` e permissões do Thiago; Editor ↔ `PORTAL_ASSET_SLOTS` e `unit`.

**10. Ordem recomendada**

ETAPA 1 — Ação do Dia e operação imediata
1. Consumo imediato de `result.queue` (remover a espera de 4 s).
2. Compromisso sem desfecho deixa de virar `pendente`; reclassificação ao concluir a posição 1.
3. `claimed` vence qualquer empate de rank 0.
4. Aviso do Portal: remover a janela de 7 dias e apresentá-lo automaticamente quando a posição 1 estiver livre.

ETAPA 2 — Identidade, captação e jornada
5. Precedência do responsável oficial no CTA.
6. `ensurePortalToken` usando a identidade oficial antes do cache.
7. Formulário institucional → fluxo operacional com responsável fixo Thiago (após as decisões do item 2).
8. Percentual da Jornada lido do servidor em outro aparelho.

ETAPA 3 — Editor, Simulador e ajustes visuais
9. Slots das imagens institucionais das marcas e montagem do Editor por área.
10. Ocultar o botão flutuante enquanto o Simulador estiver aberto.
11. Mover o acesso ao Editor para a Central de Homologação.
