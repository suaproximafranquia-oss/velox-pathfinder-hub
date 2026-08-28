# Auditoria Dirigida Pré-Parte B — Diagnóstico

Nada foi alterado: sem código, sem migração, sem banco, sem rotas. Tudo abaixo vem de leitura de arquivos, consulta ao banco e teste HTTP nesta rodada.

---

## BLOCO 1 — REESTRUTURAÇÃO /F

**1. Mapa real das rotas /f — STATUS: OK**
38 arquivos `f.*` em `src/routes/`.
Layouts: `f.tsx` (neutro, só `<Outlet/>`), `f.executivo.tsx`, `f.crm.tsx`, `f.remarketing.tsx`, `f.portal-leads.tsx`.
Telas: `f.executivo.index` + administracao, alertas, backups, biblioteca, brain, campanhas, captacao, celebracao, central-backup, configuracoes, criativa, dashboard, greensales, greensales-sync, home, homologacao, identidade, institucional, investidores, kpi, laboratorio, perfil, recursos, relatorios, reunioes, revista, templates, teste-cadencia, usuarios; `f.crm.index`; `f.remarketing.index`; `f.portal-leads`; público `f.$slug`.
CORRIGIR ANTES? NÃO.

**2. Migração sem reconstrução — STATUS: OK**
As rotas `/f/*` importam os mesmos componentes de `src/components/executive/*`, `src/components/crm/*` e `src/components/remarketing/*`. Não há componente reescrito por causa do prefixo. CORRIGIR ANTES? NÃO.

**3. Duplicação de telas — STATUS: OK**
Os 33 arquivos legados (`executivo.*`, `crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`) têm `component: () => null`. Nenhuma tela duplicada. CORRIGIR ANTES? NÃO.

**4. Rotas antigas só redirecionam — STATUS: OK**
`beforeLoad` lança `redirect({ to: "/f/...", replace: true })`. Teste HTTP: `/executivo` → 307, `/crm` → 307. CORRIGIR ANTES? NÃO.

**5. Preservação de search — STATUS: OK**
`search: search as never` em todos os stubs.

**6. Perda de params — STATUS: OK (por ausência de risco)**
Nenhum stub legado tem segmento dinâmico, então não há `params` a perder. Os dinâmicos (`/f/$slug`, `/s/$slug`, `/seg/$slug`, `/e/$slug`) não foram tocados. Se algum dia um stub dinâmico for criado, `params` precisará ser repassado explicitamente.

**7–8. Referências às rotas antigas — STATUS: OK**
Busca por `to="/executivo`, `to="/crm`, `to="/remarketing`, `to="/portal-leads` e `window.open("/executivo…` fora dos stubs: **zero ocorrências**. Nenhum menu, botão, `navigate()` ou callback aponta para rota antiga.

**9. /f é unidade de negócio? — STATUS: DIVERGÊNCIA CONCEITUAL**
EXISTE: prefixo com semântica declarada em `src/lib/business-unit.ts` e usado por `isOperationalPath()` para decidir onde a Agenda aparece (`__root.tsx:199`).
PEDIDO: unidade de negócio real. DIFERENÇA: **nenhuma decisão de dado ou permissão depende da unidade** — não há filtro de leads, RLS ou consulta por unidade.
IMPACTO: nulo hoje (uma unidade); quando Solar/Seguros existirem, a unidade precisa virar critério de dado (tabela própria), não só de URL.
CORRIGIR ANTES? NÃO. RECOMENDAÇÃO: tratar isso como parte do desenho de Solar/Seguros, não como conserto da Parte A.

**10. Futuro /s e /seg — STATUS: OK**
`BUSINESS_UNITS` já declara `s` e `seg` com `operational: false`; `currentUnit()` e `isOperationalPath()` são genéricos por prefixo. Não exige reconstrução — exige duplicar arquivos de rota e resolver o item 12.

**11. business-unit.ts é usado? — STATUS: DIVERGÊNCIA**
EXISTE: `isOperationalPath()` é usado em `src/routes/__root.tsx:199`; `validateExecutiveSlug()`/`isReservedSlug()` são usados em `f.executivo.usuarios.tsx:147` e `src/lib/executive-auth.ts:345`.
**`unitPath()` não é chamado em lugar nenhum. `currentUnit()` só é chamado internamente, por `isOperationalPath()`.**
IMPACTO: baixo hoje, alto na expansão. CORRIGIR ANTES? NÃO.

**12. Literais /f/... — STATUS: RISCO (futuro)**
~153 literais `/f/...` no código. Risco real na expansão para Solar/Seguros, não na Parte B.
RECOMENDAÇÃO: **não migrar em massa agora** — `to=` do TanStack é tipado por literal e a troca por função remove a verificação de rota em 153 pontos, sem ganho funcional. Usar `unitPath()` só em código novo e em navegação dinâmica.

**13. /F versus /f — STATUS: DIVERGÊNCIA (leve)**
EVIDÊNCIA: teste HTTP — `/f/executivo` → 200 e `/F/executivo` → **200 também**. `currentUnit()` aplica `toLowerCase()`, então a Agenda funciona nas duas grafias.
IMPACTO: duas URLs servem a mesma tela — ruim para SEO e para links compartilhados. **Sem impacto de segurança**: o guard é por componente de layout, não por string de path. CORRIGIR ANTES? NÃO.

---

## BLOCO 2 — /f/$slug E LINKS PERSONALIZADOS

**14. Resolução do conflito — STATUS: OK**
O roteador dá precedência a segmento estático sobre `$slug`. Comprovado: `/f/executivo` devolve a tela (200), não o redirect do link personalizado.

**15–16. Validação de slugs reservados — STATUS: OK**
`validateExecutiveSlug()` normaliza (minúsculo, sem acento, sem caractere inválido) e rejeita `executivo`, `crm`, `remarketing`, `portal-leads`. Chamada na criação/edição (`f.executivo.usuarios.tsx:147`) **e** no ponto central de persistência (`src/lib/executive-auth.ts:345`, `saveUsers`).

**17. Como os executivos são persistidos — STATUS: DIVERGÊNCIA (estrutural)**
EVIDÊNCIA: `src/lib/executive-auth.ts` — `saveUsers()` grava em **localStorage**, não no banco. `executive_profiles` existe no banco, mas o cadastro operacional de usuários vive no navegador.
IMPACTO: o cadastro não é compartilhado entre dispositivos nem auditável; a trava de slug reservado é apenas de cliente. CORRIGIR ANTES? NÃO para a Parte B, mas é uma fragilidade estrutural conhecida.

**18. Slug reservado por outro caminho — STATUS: RISCO**
Pelo código atual, não: toda gravação passa por `saveUsers()`, que valida. **Mas**, sendo localStorage, qualquer edição manual do armazenamento do navegador grava o que quiser. `safeExecutiveSlug` continua exportado como `@deprecated`, sem nenhuma chamada — não corrige em silêncio.
RECOMENDAÇÃO: quando os usuários migrarem para o banco, replicar a validação em `CHECK`/trigger.

**19–20. Ownership e brand — STATUS: OK**
`f.$slug.tsx`, `s.$slug.tsx`, `seg.$slug.tsx` e `e.$slug.tsx` mantêm o comportamento anterior: redirecionam para `/` com `{ e: slug, m: "manual", o: brand.origin, b: brand.key }` via `getBrandByPrefix`. Nenhuma alteração de origem, marca ou identificação causada pela estrutura `/f`.

---

## BLOCO 3 — AUTENTICAÇÃO E SEGURANÇA

**21. Guard atual — STATUS: OK**
`src/components/auth/operational-guard.tsx`: lê `getSession()` num `useEffect`; sem sessão e fora de `publicPaths`, `navigate({ to: "/f/executivo", replace: true })`. Aplicado nos quatro layouts `/f/*`, todos com `ssr: false`.

**22–23. Conteúdo antes da validação — STATUS: OK**
`if (!checked || !session) return null;` — nada é renderizado antes da leitura da sessão, e `ssr: false` elimina o quadro de servidor sem sessão. Não há piscar de conteúdo interno.

**24. Segunda lógica de login — STATUS: OK**
Nenhuma. O guard reutiliza `getSession()` de `src/lib/executive-auth.ts` e redireciona para a tela de acesso que já existia.

**25. Coerência frontend x RLS — STATUS: OK, com ressalva importante**
O guard é proteção **visual**; a proteção de dados é a RLS (`current_executive_id()`, `has_role`, `can_access_investor`). São camadas coerentes e complementares.
RESSALVA: a sessão do Workspace é de navegador (localStorage) e **não é a mesma coisa** que a sessão de autenticação usada pela RLS. Contornar o guard no cliente não entrega dado algum — a RLS continua valendo —, mas também significa que o guard não deve ser tratado como controle de acesso.

**26. Rota interna sem guard — STATUS: OK**
Toda tela operacional é filha de um dos quatro layouts com `OperationalGuard`. `/f/executivo` é o único caminho público (a própria tela de acesso), por desenho.

**27. Raiz "/" — STATUS: OK**
Continua Portal/Gateway. O `useEffect` de `__root.tsx` devolve à Home qualquer rota de módulo acessada diretamente. Nenhum atalho para área interna exposto ao visitante.

---

## BLOCO 4 — AGENDA OPERACIONAL

**28. Fontes de dados — STATUS: OK**
`src/lib/agenda.functions.ts`, três fontes: (a) `workspace_agenda_events` — compromissos próprios; (b) `portal_meetings` — reuniões, **somente leitura**, canceladas ignoradas; (c) função `agenda_cadence_tasks` — tarefas de `crm_cadence_tasks` com `status='pendente'` e responsável = `current_executive_id()`.

**29. Disponibilidade nos quatro ambientes — STATUS: OK**
`__root.tsx:199` — `showAgenda = isOperationalPath(pathname)`, que cobre exatamente `/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads`. `<AgendaDock />` é renderizado nos três ramos de shell.

**30–31. Overlay preserva a tela — STATUS: OK**
O dock é montado **fora** do `<Outlet />`, no nível do shell: abrir e fechar não desmonta nem remonta a tela atual; o estado permanece.

**32. Três prioridades — STATUS: OK**
`maxima | media | minima` na interface (`agenda-dock.tsx:21-23`, `291-293`) e no banco (coluna `priority`, padrão `'maxima'`).

**33. Compromisso x reunião x ação — STATUS: OK**
`AgendaItem.kind`: `compromisso` (base própria, com horário, editável), `reuniao` (`portal_meetings`, com horário, somente leitura), `acao` (cadência, **sem horário**, prioridade `minima`, faixa própria do dia).

**34–35. Ligação e mensagem — STATUS: DIVERGÊNCIA (confirmada e ainda presente)**
EXISTE: a Agenda lê só `crm_cadence_tasks` (5 linhas hoje) — ligações.
PEDIDO: "Ações do Dia" completas. DIFERENÇA: `relationship_queue` tem **24 itens pendentes hoje** e é invisível para a Agenda.
IMPACTO: o executivo vê uma agenda incompleta e pode concluir o dia com mensagens pendentes.
CORRIGIR ANTES? **É exatamente o escopo da Parte B** — não precisa ser corrigido antes, precisa ser resolvido dentro dela.
Observação de rótulo: o título é montado como `D${t.step_day} · Ligação/Mensagem` (`agenda.functions.ts:96`) — o texto "Mensagem" já existe, mas a fonte de mensagens não.

**36. A Agenda inventa ação? — STATUS: OK**
Não. Só apresenta o que a função de cadência devolve. Nenhuma criação, nenhum horário fabricado (`startsAt/endsAt` nulos para ações).

**37. Duplicação de reunião — STATUS: OK**
Reuniões vêm com id prefixado (`meeting:${m.id}`) e **nunca** são copiadas para `workspace_agenda_events`. Não existe caminho de duplicação.

**38. Compromisso x compromisso — STATUS: OK**
Checado em código antes de gravar e reforçado no banco: `EXCLUDE USING gist (executive_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE priority='maxima'`.

**39–40. Compromisso x reunião — STATUS: DIVERGÊNCIA**
EXISTE: verificação **apenas em código** (`agenda.functions.ts:140-156`), antes do insert. PEDIDO: bloqueio confiável. DIFERENÇA: sem trava de banco, duas operações simultâneas podem gravar um compromisso sobreposto a uma reunião.
IMPACTO: baixa probabilidade (um executivo por vez), consequência real. CORRIGIR ANTES? NÃO. RECOMENDAÇÃO: advisory lock por executivo+dia quando houver folga.
Prioridades média e mínima não bloqueiam — comportamento correto e intencional.

**41–42. Fuso horário — STATUS: DIVERGÊNCIA**
EXISTE: o agrupamento por dia usa `America/Sao_Paulo` (`agenda.functions.ts:36`), mas **a criação** (`new Date("YYYY-MM-DDTHH:mm:00")`, `agenda-dock.tsx:246-247`) e **a exibição** (`toLocaleString("pt-BR")` sem `timeZone`, linhas 127/134/140) usam o fuso do navegador. O armazenamento é `timestamptz` — correto.
IMPACTO: executivo em outro fuso grava e lê horário deslocado do agrupamento; compromisso pode cair no dia errado e o conflito ser avaliado no intervalo errado.
CORRIGIR ANTES? **SIM.** A tabela está vazia (0 linhas) — o custo nunca será menor.

**43–45. RLS — STATUS: OK**
Quatro políticas em `workspace_agenda_events` (ver, criar, editar, remover), todas com `has_role(auth.uid(),'admin') OR executive_id = current_executive_id()`. Um executivo não vê nem altera evento de outro; o administrador vê tudo sem afrouxar o isolamento. A identidade nunca vem do cliente.
Campos: `id uuid pk`, `executive_id text`, `title text`, `starts_at timestamptz`, `ends_at timestamptz`, `priority text default 'maxima'`, `source text default 'agenda'`, `note text`, `created_by uuid`, `created_at`, `updated_at`.

---

## BLOCO 5 — CADÊNCIA / IDENTIDADE DAS ETAPAS

**46–47. Dia x identidade — STATUS: DIVERGÊNCIA**
Convivem dois vocabulários:
- Ligações: `crm_cadence_tasks.step_day` **inteiro**, usado como identidade na chave de conflito `lead_id,channel,cycle_date,step_day` (`cadence.server.ts:196`).
- Mensagens: `step_key` **textual** na Biblioteca, nos envios e nos vínculos de conteúdo.
**Não existe `step_key` textual nas tarefas de ligação.** IMPACTO: o vocabulário E-n da Parte B não tem onde se apoiar do lado das ligações nem da Agenda. CORRIGIR ANTES? **SIM** — é pré-requisito da Parte B.

**48. Agenda mostra D1/D2/D3 — STATUS: DIVERGÊNCIA**
`agenda.functions.ts:96` monta `D${t.step_day}`. Não há como exibir E1/E2/E3 antes do item 47.

**49. E3 independente do dia — STATUS: PARCIAL**
No lado das **mensagens**, sim: a Biblioteca é indexada por chave textual e nada deriva dia do número. No lado das **ligações**, não: a identidade É o dia.

**50. Número interpretado como dia — STATUS: OK**
E12, E20, E27 são chaves de texto; nenhum código converte esse número em dias. O único lugar onde número = dia é `step_day`.

**51. E20/E27 internos — STATUS: OK**
E20 é a apresentação digital (`relationship_e20_occurrences`, token de 24 bytes, validade de 7 dias, checkpoint, encerramento `encerrada_por_nova`, rota `/portal/convite/$token`). E27/FINALIZACAO existem como slots de encerramento. Os três estão **vazios e inativos** na Biblioteca. `relationship_e20_occurrences` tem **0 linhas** — infraestrutura nunca exercida.

**52. Confusão estrutural — STATUS: RISCO (parcial)**
Bem separados: nome/código da etapa (`step_key`, `code`), conteúdo (`relationship_contents` + `relationship_step_content_bindings`) e template (`meta_template_name`, `requires_template`).
Confusos: **dia x etapa** no motor de ligações (item 46) e **ação** — que hoje só significa ligação para a Agenda.
Risco adicional da Parte B: E6/E7 assumirão o papel que hoje é de E20/E27, e essas chaves permanecerão nas colunas e funções.

**53. Renomear sem destruir histórico — STATUS: OK**
Sim, desde que se acrescente em vez de renomear. Recomendação de menor risco: **manter E20/E27 como chave interna e exibir E6/E7 na interface** — evita renomear colunas, funções e a rota do convite.

**54. Congelamento do envio — STATUS: OK**
`relationship_message_sends` grava `rendered_body`, `template_body`, `library_version`, `code`, etapa, lead, ator, conteúdo e canal no instante do envio. Editar a Biblioteca amanhã não altera o passado.

---

## BLOCO 6 — E0 E AUTOMAÇÃO

**55–56. E0 é o único automático — STATUS: OK**
O canal `message` do motor antigo está desligado por configuração (`CADENCE_CONFIG.message.enabled = false`); o motor novo dispara por `dispatch.server.ts` com id de mensagem determinístico (`msg_${step}_${leadId}`), que impede duplicidade mesmo em reentrada. Não há motor concorrente.

**57–58. Simulação e template — STATUS: DIVERGÊNCIA (bloqueante para envio real)**
`src/lib/crm/e0-simulation.ts:12` — `E0_SIMULATION_ENABLED = true`, consumido em 6 arquivos, entre eles `engine.server.ts:31` (`virtualTemplates`) e `dispatch.server.ts:120` (`simulated = E0_SIMULATION_ENABLED || recipient.isTest`).
`crm_meta_templates` tem **0 linhas**. Hoje **nada sai de verdade**.

**59. Preparado para o template oficial — STATUS: OK**
A linha E0 da Biblioteca tem `meta_template_name` e `requires_template`; desligar a simulação restaura a exigência do template real. Ordem obrigatória: (1) cadastrar o template aprovado na Meta; (2) conferir o vínculo na Biblioteca; (3) só então `E0_SIMULATION_ENABLED = false`; (4) validar com lead `TEST-*`, que continua simulado mesmo com token real. Inverter a ordem bloqueia todo E0.

**60. Risco de disparo duplicado ao ativar — STATUS: OK (baixo)**
Protegido em três camadas: canal antigo desligado, id determinístico da mensagem e trava de ambiente (`recipient.isTest`). O risco real seria reativar o canal `message` do motor antigo — não faça isso.

---

## BLOCO 7 — HISTÓRICO DA JORNADA (DIVERGÊNCIA CRÍTICA)

**DIAGNÓSTICO CENTRAL — STATUS: DIVERGÊNCIA, e a causa NÃO é a GreenSales.**

**a) Quem grava "Status do Lead atualizado"**
É o rótulo do evento `lead.status.changed`, traduzido em `src/lib/investor-profile.ts:48` (`fmt()`) e em `src/lib/executive-data.ts:215`.
O evento é emitido em exatamente quatro lugares: `src/lib/lead-state.ts:113` (`markLeadViewed`), `:126` (`closeLead`), `:140` (`reopenLead`) e `src/components/shared/executive-contact-dialog.tsx:82`.
**Ponto decisivo:** esses eventos vivem no barramento `src/lib/events/bus.ts`, que persiste em **localStorage** (`velox:events:v1`, máximo 500). **Não existe trigger, nem tabela, nem sincronização gravando isso.** Confirmado no banco: `crm_lead_events` só tem `lead_sincronizado`, `lead_criado`, `e0_*`, `etapa_alterada`, `workspace_card_criado`, `CADENCE_TASK_DONE` etc. — **nenhum evento de "status atualizado"**.

**b) O que dispara cada alteração**
Abrir o card (`investor-card.tsx:133`) e abrir o perfil (`investor-profile-view.tsx:267`, dentro do `useEffect` do `LeadStateBadge`). Ou seja, **um único clique produz no mínimo dois eventos**: um do card, outro da montagem do perfil. Qualquer remontagem do badge (troca de aba, re-render com mudança de `investor.id`/`actorId`) emite mais um.

**c) Por que o mesmo status se repete**
`markLeadViewed` **não compara com o estado atual**: se o lead já está "em andamento", ela grava `viewedAt` de novo e emite o evento de novo. Não há condição de mudança efetiva. Isso explica exatamente os três registros em 23:41:26, 23:41:27 e 23:41:40 — são três aberturas/montagens, não três mudanças.

**d) Loop Workspace ↔ GreenSales — NÃO EXISTE.**
Esses eventos nunca saem do navegador. A sincronização escreve `lead_sincronizado` em `crm_lead_events`, que é outra trilha e não alimenta este histórico.

**e) Listener reagindo à própria alteração — RISCO REAL, mas contido.**
`onLeadStateChange` (`lead-state.ts:154`) ouve `lead.status.changed` e o `LeadStateBadge` reage a ele. O ciclo não fecha porque o listener só chama `resolveLeadState` (leitura), sem reemitir. **Mas** `persist()` chama `notifySync("status")`, que dispara atualização de tela; se essa atualização remontar o badge, o `useEffect` chama `markLeadViewed` outra vez. **Este é o mecanismo mais provável da rajada de registros no mesmo segundo.**

**f) Atualização interpretada como novo evento — SIM, no histórico visual**; não na lógica de estado.

**g) `investor.reactivated` repetido — SIM, é possível.**
`workspace-alerts.ts:124` emite dentro de `pushAlert`, que só grava se o `id` for inédito — e o id é `wa_movimentacao_<leadId>_<Date.parse(lastActivity)>`. **Toda nova atividade gera um id novo**, logo um novo evento de reativação. Além disso, `readLastSeen()` é localStorage: em outro navegador, outro dispositivo, ou após limpar o armazenamento, a avaliação recomeça do zero e pode reativar o mesmo lead outra vez. `runWorkspaceAlertEvaluation` tem throttle de 5 s — limita rajadas, não repetição entre sessões.

**h) Confusão "novo" x "reativado" — NÃO.**
`evaluateNewLeads` e `evaluateInvestorMovement` são caminhos distintos, e a movimentação exige uma janela mínima de inatividade.

**i) O card volta indevidamente para "novo"? — NÃO.**
`executive-data.ts:113` remove explicitamente `lead.status.changed` do cálculo de `lastActivity` — a correção anterior está no lugar e funcionando. O ruído é **apenas visual**, no histórico.

**j) Jornada recriada sozinha — NÃO.**
Nada recria jornada. O que se acumula é registro de evento local.

**k–m) Consolidação, debounce, idempotência — NÃO EXISTEM.**
`emitEvent` gera `id` aleatório (`ev_<timestamp>_<random>`) e faz `push` incondicional. Não há chave de idempotência, não há deduplicação, não há debounce. O único limite é o corte em 500 eventos — que, pior, **descarta eventos antigos reais** para dar lugar a ruído de visualização.

**n) Mesmo status vindo de novo da GreenSales — NÃO SE APLICA.**
A sincronização grava `lead_sincronizado` no banco (773 registros; o lead mais repetido tem 12 ao longo de 3 dias — cadência normal de sincronização, não tempestade) e é idempotente por lead. Não produz "Status do Lead atualizado".

**o) Diferença técnica atual entre os estados**
- LEAD NOVO: `viewed_at` nulo, ou `lastActivity > viewed_at` (`resolveLeadState`).
- LEAD ATUALIZADO: **não é um estado** — cai em "novo" pela mesma regra.
- LEAD REATIVADO: alerta de `movimentacao` calculado no cliente por janela de inatividade; **é rótulo de alerta, não estado do lead**.
- LEAD EM CADÊNCIA: pertence a outro eixo — fila do motor (`relationship_queue`) e etapa; não aparece em `LeadState`.
- LEAD FINALIZADO: `closed_at` preenchido (encerramento manual) ou etapa terminal OPORTUNIDADE no motor.
**Divergência conceitual:** hoje há dois eixos paralelos (estado operacional do card x etapa do motor) sem um vocabulário único. A Parte B precisa decidir isso explicitamente.

**p) Fluxo exato até o histórico**
1. GreenSales/portal → `lead-sync.server.ts` / `lead-intake.server.ts` → `resolve_portal_identity` → `portal_leads` → evento `lead_sincronizado`/`lead_criado` em `crm_lead_events` (**servidor, auditável**).
2. Executivo abre o card → `markLeadViewed` → `updateWorkspaceOperational` → `set_lead_operational` grava `viewed_at` (**servidor**) → em caso de sucesso, `emitEvent("lead.status.changed")` (**apenas localStorage**).
3. A ficha monta o histórico em `buildInvestorProfile` misturando leads, reuniões e **os eventos locais** — é aí que o ruído aparece.
Observação: a Jornada do Investidor do CRM (`journey.server.ts`) é outra coisa, tem whitelist relacional e deduplicação; **quem está poluída é a linha do tempo do perfil do Workspace**, que não passou pela mesma correção.

**q) Tempestade vinda da GreenSales — NÃO.** Os números do banco não sustentam isso.

**r) Race condition — SIM, uma, de baixa gravidade.**
`markLeadViewed` não verifica o estado atual e não é serializada: duas montagens quase simultâneas produzem duas gravações e dois eventos. Não corrompe dado (`viewed_at` só avança), mas gera exatamente o padrão de "vários registros no mesmo segundo".

**s) Corrigir antes da Parte B? — SIM, parcialmente.**
Obrigatório antes: **não emitir `lead.status.changed` quando não houve mudança real de estado** — é uma condição de guarda em `markLeadViewed`. Sem isso, a Parte B (Notas do Executivo, Ações do Dia, histórico consolidado) será construída sobre uma linha do tempo poluída e o corte de 500 eventos continuará apagando registros reais.
Desejável, não bloqueante: aplicar na ficha do Workspace a mesma whitelist/deduplicação que a Jornada do CRM já tem, e tornar `investor.reactivated` idempotente por ciclo em vez de por timestamp.
**Nada disso é perda de dado**: os eventos são locais do navegador e não integram trilha forense de servidor.

---

## BLOCO 8 — REENGAJAMENTO

**62. Como é identificado — STATUS: DIVERGÊNCIA**
Só existe uma heurística de **cliente**: `evaluateInvestorMovement()` compara `lastActivity` com um `lastSeen` guardado em localStorage e, se o intervalo for maior que a janela configurada, cria um alerta de `movimentacao`. **Não há reengajamento como estado no banco.**

**63. Retorno espontâneo x atualização de status — STATUS: OK (por construção)**
Sim, há diferença: `lastActivity` exclui `lead.status.changed` (`executive-data.ts:113`), então uma ação do executivo não conta como retorno do investidor. A base do cálculo está correta.

**64. O que o reengajamento cria — STATUS: OK**
Apenas um alerta. **Não cria nova jornada, não cria novo card, não reabre o lead.**

**65. Update de status virar reengajamento — STATUS: OK**
Bloqueado pelo filtro acima. O risco remanescente é outro: um evento **real** do investidor logo após um período de inatividade sempre gera alerta — inclusive de novo em outro dispositivo, porque `lastSeen` é local.

**66–67. Preservação de histórico e múltiplos ciclos — STATUS: OK**
O histórico de servidor é aditivo: `crm_lead_events`, `relationship_message_sends` (com snapshot congelado), `relationship_e20_occurrences` (ocorrências encerradas ficam com `encerrada_por_nova`). Um mesmo investidor suporta vários ciclos sem destruir o anterior. A única perda possível é no armazenamento local do navegador — que **não é fonte histórica confiável** e não deveria ser exibido como se fosse.

---

## BLOCO 9 — PREPARAÇÃO PARA PARTE B

**68. Obrigatório corrigir antes**
1. `step_key` textual nas tarefas de cadência (mantendo `step_day`) — sem isso E1/E2/E3/E5/E6/E7 não existem no lado das ligações nem da Agenda.
2. Padrão `"SIM"` no desfecho da ligação (`cadence.server.ts:183`, `input.outcome ?? "SIM"`) — grava "atendeu" sem ninguém informar; envenena qualquer regra condicional da E7.
3. Fuso horário da Agenda — fixar `America/Sao_Paulo` na criação e na exibição (tabela vazia; custo mínimo).
4. Guarda em `markLeadViewed` para não emitir evento sem mudança real de estado (Bloco 7).
5. Criar os slots ausentes na Biblioteca — E2, E5, E6, E7, R0 (só os slots; os textos são decisão sua).

**69. Seguro implementar imediatamente**
Notas do Executivo (tabela nova, sem dependência); Central de Templates sobre `relationship_message_library` (versionamento e snapshot já funcionam); Biblioteca de Conteúdo sobre `relationship_contents` + `relationship_step_content_bindings`; botão de geração da apresentação digital chamando `e20.server.ts` (infra pronta, 0 ocorrências, risco baixo).

**70. Dependência ainda não mapeada — SIM, duas**
(a) **Um vínculo ativo por etapa**: `relationship_step_content_bindings` tem índice único — "vários vídeos na E1" não cabe no modelo atual e exige decisão antes de implementar.
(b) **A ficha do Workspace tem uma segunda linha do tempo**, independente da Jornada do CRM já corrigida. Se a Parte B adicionar Notas do Executivo, precisa escolher **qual** das duas passa a ser a oficial — ou nascem dois históricos divergentes.

**71. Tabelas que a Parte B usará ou alterará**
`relationship_message_library` (novos slots), `relationship_step_content_bindings` (regra de múltiplos conteúdos), `crm_cadence_tasks` (coluna `step_key`), `relationship_e20_occurrences` (E6), `workspace_agenda_events` (ações do dia), `relationship_queue` (leitura pela Agenda), + tabela nova de Notas.

**72. NÃO modificar (preservação de histórico)**
`portal_leads` (blindada por gatilhos `guard_lead_delete`/`guard_lead_truncate`), `relationship_message_sends`, `crm_lead_events`, `crm_messages`, `portal_backups`/`portal_backup_blobs`, `portal_lead_guard_log`. Só leitura e inserção; nunca alteração retroativa.

**73. Funções que NÃO devem ser reutilizadas**
`completeCadenceTask` na forma atual (padrão `"SIM"`); `safeExecutiveSlug` (obsoleta); o canal `message` do motor antigo (`src/lib/crm/templates.ts` e afins — textos legados); `resolve_portal_identity` para leads Solar/Seguros (é do domínio financeiro); e o barramento de eventos em localStorage como fonte de histórico oficial.

**74. Fluxos tecnicamente frágeis**
A rajada de eventos do Workspace (Bloco 7); usuários/slugs em localStorage; conflito compromisso x reunião apenas em código; convivência de dois motores com vocabulários diferentes; corte de 500 eventos no barramento local, que apaga registros reais.

**75. Ordem segura de implementação**
1. Migração de fundação: `step_key` nas tarefas, slots novos da Biblioteca, tabela de Notas. *(Nada de interface depende de decisão ainda; abre o resto.)*
2. Correções sem interface: padrão de `outcome`, fuso da Agenda, guarda do `markLeadViewed`. *(Barato agora, caro depois de gerar dado.)*
3. Central de Templates e Biblioteca de Conteúdo. *(Onde os textos oficiais entram — sem eles nada dispara.)*
4. Ações do Dia unificadas: Agenda passa a ler ligações **e** mensagens, com rótulo E-n. *(Depende de 1 e 3.)*
5. E6 (botão + link de 7 dias) e, em seguida, E7 condicional ao desfecho. *(Depende de 2 e 3.)*
6. Notas do Executivo na ficha, unificando a linha do tempo oficial. *(Por último, sobre um histórico já limpo.)*

---

## SÍNTESE FINAL

**1. 100% PRONTO**
Reestruturação `/f` (38 rotas) e 33 stubs com redirect 1:1 preservando `search`; zero navegação para rotas antigas; precedência de rota estática sobre `/f/$slug`; slugs reservados rejeitados na interface e na persistência; guard único com `ssr: false`, sem piscar, sem segundo login; `/` só institucional; Agenda global nos quatro ambientes como overlay sem perder estado; três prioridades reais; reunião/compromisso/ação diferenciados; sem duplicação de reunião; RLS da agenda por executivo com acesso de administrador; proteção de banco compromisso x compromisso; snapshot imutável dos envios; blindagem de `portal_leads`.

**2. FUNCIONA COM RESSALVA**
`/F` e `/f` ambos respondem; `unitPath()` existe sem uso e 153 literais `/f/...`; usuários e slugs em localStorage; conflito compromisso x reunião só em código; E0 funcional porém em simulação; `evaluateInvestorMovement` correta na lógica mas com memória local por dispositivo.

**3. DIVERGENTE**
Fuso horário da Agenda (navegador x servidor); ausência de `step_key` textual e rótulo `D{n}`; `relationship_queue` invisível para a Agenda (24 itens); padrão `"SIM"` no desfecho; E6/E7/E2/E5/R0 inexistentes; E20/E27/FINALIZAÇÃO vazios; `crm_meta_templates` vazia; `/f` sem efeito sobre dados ou permissões.

**4. QUEBRADO**
Nada quebrado no sentido de indisponibilidade. O mais próximo disso é a linha do tempo da ficha do Workspace: funcional, porém poluída por eventos de visualização sem deduplicação — e com corte em 500 eventos que descarta registros reais.

**5. NÃO FOI POSSÍVEL CONFIRMAR**
Comportamento com dois executivos gravando no mesmo horário (`workspace_agenda_events` vazia); fluxo E6/link de 7 dias ponta a ponta (0 ocorrências); envio real do E0 pela Meta (simulação ligada, `crm_meta_templates` vazia); a sequência exata de cliques que produziu os registros de 23:41 do lead citado — o padrão é totalmente consistente com o mecanismo descrito, mas o barramento é local e não guarda a origem do clique.

**6. CORREÇÕES OBRIGATÓRIAS ANTES DA PARTE B**
`step_key` textual · padrão `"SIM"` no desfecho · fuso da Agenda · guarda no `markLeadViewed` · slots vazios da Biblioteca.

**7. DECISÕES SUAS**
E6/E7 como rótulo sobre E20/E27 ou renomeação real · textos oficiais das etapas · template Meta do E0 e autorização para sair da simulação · Agenda passa a mostrar mensagens? · vários conteúdos por etapa (o modelo hoje permite um) · qual linha do tempo é a oficial na ficha · conflito compromisso x reunião no banco · normalizar `/F` · confirmar que **não** migramos os 153 literais agora.

**8. ORDEM RECOMENDADA**
Conforme o item 75: fundação → correções invisíveis → templates e conteúdo → Ações do Dia → E6/E7 → Notas do Executivo.
