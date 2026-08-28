# Auditoria Técnica e Funcional — Pré-Parte B

Nada foi implementado, migrado ou alterado. Todas as respostas vêm de leitura de código, consulta ao banco e teste HTTP nesta rodada.

---

## BLOCO 1 — ESTADO REAL DA PARTE A

**1. Reestruturação /f — STATUS: OK**
EVIDÊNCIA: `src/routes/` — 38 arquivos `f.*`.
Layouts: `f.tsx` (neutro), `f.executivo.tsx`, `f.crm.tsx`, `f.remarketing.tsx`, `f.portal-leads.tsx`.
Telas: `f.executivo.index` + administracao, alertas, backups, biblioteca, brain, campanhas, captacao, celebracao, central-backup, configuracoes, criativa, dashboard, greensales, greensales-sync, home, homologacao, identidade, institucional, investidores, kpi, laboratorio, perfil, recursos, relatorios, reunioes, revista, templates, teste-cadencia, usuarios; `f.crm.index`; `f.remarketing.index`; `f.portal-leads`; link público `f.$slug`.

**2. Telas operacionais fora de /f — STATUS: OK**
EVIDÊNCIA: 33 arquivos legados (`executivo.*`, `crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`) — todos com `component: () => null`. Nenhuma renderiza aplicação.

**3. Redirects controlados — STATUS: OK**
EVIDÊNCIA: `src/routes/executivo.index.tsx` e similares: `beforeLoad` lança `redirect({ to: "/f/...", replace: true })`. Teste HTTP: `/executivo` → 307, `/crm` → 307.

**4. Preservação de search/params — STATUS: OK (com ressalva)**
EVIDÊNCIA: `search: search as never` em todos os stubs; `replace: true` evita histórico duplicado.
RESSALVA: os stubs legados não têm segmentos dinâmicos, então não há `params` a preservar — a preservação é só de `search`, o que é suficiente para o conjunto atual.

**5–6. Navegação interna com strings antigas — STATUS: OK**
EVIDÊNCIA: busca por `to="/executivo`, `to="/crm`, `to="/remarketing`, `to="/portal-leads`, `window.open("/executivo…` fora dos stubs: **zero ocorrências**. Nenhum menu, botão ou ação leva a rota antiga.

**7. Helper centralizado — STATUS: DIVERGÊNCIA**
1. Existe: `unitPath()` em `src/lib/business-unit.ts`. 2. Foi pedido uso centralizado. 3. Diferença: o helper **não é chamado em lugar nenhum**; a navegação usa literais `/f/...` (~153 ocorrências). 4. Impacto: baixo hoje (uma unidade), alto quando /s e /seg existirem — cada tela precisará ser tocada. 5. Recomendação: **não migrar em massa agora** (o `to=` do TanStack é tipado por literal e a troca perde verificação de rota em 153 pontos); usar `unitPath()` em código novo e em navegação dinâmica.

**8. Futuro /s e /seg — STATUS: OK**
EVIDÊNCIA: `BUSINESS_UNITS` já declara solar (`s`) e seguros (`seg`) com `operational: false`; `currentUnit()` e `isOperationalPath()` são genéricos por prefixo. A estrutura de rotas é replicável sem reconstrução — o custo é a duplicação dos arquivos de rota e os literais do item 7.

**9. /f representa a unidade? — STATUS: DIVERGÊNCIA CONCEITUAL (leve)**
Hoje `/f` é prefixo de rota com semântica declarada em `business-unit.ts`, mas **nenhuma decisão de dados depende dele**: não há filtro de leads, permissão ou consulta por unidade. Na prática funciona como prefixo. Impacto: nulo agora; quando Solar/Seguros existirem, a unidade precisa virar critério de dado (tabela própria), não só de URL.

**10. /f vs /F — STATUS: DIVERGÊNCIA (comportamental)**
EVIDÊNCIA: teste HTTP — `/f/executivo` → 200 e `/F/executivo` → **200 também** (o roteador casa sem diferenciar maiúsculas). `currentUnit()` já aplica `toLowerCase()`.
Impacto: duas URLs distintas servem a mesma tela — ruim para SEO e para links compartilhados, sem risco funcional ou de segurança. Recomendação: se incomodar, normalizar para minúsculo com redirect no layout `/f`; não é bloqueio para a Parte B.

---

## BLOCO 2 — CONFLITO /f/$slug

**11. Resolução do conflito — STATUS: OK**
EVIDÊNCIA: TanStack dá precedência a segmento estático sobre `$slug`. Comprovado: `/f/executivo` retorna a tela (200), não o redirect do link personalizado.

**12–13. Slugs reservados — STATUS: OK**
EVIDÊNCIA: `validateExecutiveSlug()` (`src/lib/business-unit.ts`) normaliza (minúsculo, sem acento) e rejeita `executivo`, `crm`, `remarketing`, `portal-leads`. Chamada na interface (`f.executivo.usuarios.tsx:147`) **e** no ponto central de persistência (`src/lib/executive-auth.ts:345`, `saveUsers`).
RESSALVA: a persistência dos usuários é `localStorage`, não banco — não existe trava equivalente no servidor.

**14. Correção silenciosa — STATUS: OK**
`safeExecutiveSlug` ainda existe, mas como `@deprecated` apontando para `suggestExecutiveSlug`, sem nenhuma chamada no código. A gravação rejeita; a sugestão só é oferecida ao usuário.

**15. Links /f/$slug válidos — STATUS: OK**
`f.$slug.tsx` inalterado: redireciona para `/` com `{ e: slug, m: "manual", o: brand.origin, b: brand.key }`.

**16. /s/$slug, /seg/$slug, /e/$slug — STATUS: OK**
Preservados, cada um com sua marca via `getBrandByPrefix`. Nenhuma alteração de identidade ou ownership.

---

## BLOCO 3 — AUTENTICAÇÃO E PROTEÇÃO

**17–18. Guard e "piscar" — STATUS: OK**
EVIDÊNCIA: `src/components/auth/operational-guard.tsx` — `if (!checked || !session) return null;`, ou seja, nada é renderizado antes da leitura da sessão. Os layouts usam `ssr: false`, então não há quadro de servidor sem sessão. Não há piscar de conteúdo interno.

**19. Acesso sem sessão — STATUS: OK**
Os quatro layouts (`f.executivo.tsx`, `f.crm.tsx`, `f.remarketing.tsx`, `f.portal-leads.tsx`) envolvem o `<Outlet />` no `OperationalGuard`. Sem sessão → `navigate({ to: "/f/executivo", replace: true })`. `/f/executivo` é o único caminho público (tela de acesso).
RESSALVA IMPORTANTE: este guard é de **interface**. A proteção real dos dados é a RLS do banco — o que está correto, mas não confunda uma com a outra.

**20. Login único — STATUS: OK**
Nenhuma segunda lógica: o guard reutiliza `getSession()` de `src/lib/executive-auth.ts` e redireciona para a tela de acesso já existente.

**21. Raiz "/" — STATUS: OK**
`/` continua sendo o Portal/Gateway. O `useEffect` do `__root.tsx` devolve à Home qualquer rota de módulo acessada diretamente. Não há atalho para área interna exposto ao visitante.

---

## BLOCO 4 — AGENDA OPERACIONAL

**22–23. Disponibilidade global — STATUS: OK**
EVIDÊNCIA: `src/routes/__root.tsx:199` — `const showAgenda = isOperationalPath(pathname);` e `<AgendaDock />` renderizado nos três ramos de shell (executivo, CRM/portal-leads/remarketing, e o fallback). `isOperationalPath` cobre exatamente `/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads`.

**24–25. Overlay sem perder a tela — STATUS: OK**
O dock é montado **fora** do `<Outlet />`, no nível do shell. Abrir e fechar não desmonta nem remonta a tela atual; o estado dela permanece.

**26. Três prioridades — STATUS: OK**
`maxima | media | minima` na interface (`agenda-dock.tsx:21-23`, `291-293`) e no banco (coluna `priority`, padrão `maxima`).

**27. Reunião x compromisso x ação — STATUS: OK**
`AgendaItem.kind` = `compromisso` (base própria) | `reuniao` (`portal_meetings`, somente leitura) | `acao` (cadência). `src/lib/agenda.functions.ts:50, 76, 97`.

**28. Origem das ações — STATUS: OK**
A Agenda **não inventa ação**: lê a função `agenda_cadence_tasks`, que consulta `crm_cadence_tasks` com `status='pendente'` e responsável = `current_executive_id()`.
RESSALVA: ela lê apenas o motor de **ligações**. A fila de mensagens (`relationship_queue`, 24 itens) é invisível para a Agenda — por isso só 5 ações aparecem (`crm_cadence_tasks` tem 5 linhas).

**29–30. Duplicação de reunião — STATUS: OK**
Reuniões vêm de `portal_meetings` com id prefixado (`meeting:${m.id}`), canceladas ignoradas, e nunca são copiadas para `workspace_agenda_events`. Não há caminho de duplicação.

**31–33. Conflito de horário — STATUS: DIVERGÊNCIA PARCIAL**
1. Hoje: a verificação só roda quando `priority === "maxima"` (`agenda.functions.ts:140`); checa reuniões de `portal_meetings` **em código** e compromissos `maxima` **em código**, e o banco reforça com `EXCLUDE USING gist (executive_id =, tstzrange(starts_at, ends_at, '[)') &&) WHERE priority='maxima'`.
2. Pedido: bloquear antes da gravação, considerando reuniões e eventos de prioridade máxima. 3. Diferença: **compromisso x compromisso** está protegido no banco (à prova de corrida); **compromisso x reunião** só está protegido no código. 4. Impacto: duas gravações simultâneas podem produzir um compromisso sobreposto a uma reunião. Probabilidade baixa (um executivo por vez), consequência real (agenda inconsistente). 5. Recomendação: manter como está para a Parte B e, se quiser fechar, criar uma trava de banco por advisory lock no par executivo+dia.
Média e mínima **não bloqueiam** — comportamento correto e alinhado ao pedido.

**34–35. Tabela — STATUS: OK, criada**
`public.workspace_agenda_events`: `id uuid pk default gen_random_uuid()`, `executive_id text NOT NULL`, `title text NOT NULL`, `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`, `priority text NOT NULL default 'maxima'`, `source text NOT NULL default 'agenda'`, `note text`, `created_by uuid`, `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz NOT NULL default now()`. Hoje com **0 linhas**.

**36–37. RLS — STATUS: OK**
Quatro políticas: ver, criar, editar e remover, todas com `has_role(auth.uid(),'admin') OR executive_id = current_executive_id()`. Um executivo não enxerga a agenda de outro; o administrador enxerga tudo sem afrouxar o isolamento entre executivos. A identidade nunca vem do navegador — é resolvida no servidor.

**RESSALVA TRANSVERSAL (fuso horário) — DIVERGÊNCIA**
1. Hoje: o agrupamento por dia usa `America/Sao_Paulo` (`agenda.functions.ts:36`), mas a criação (`new Date("YYYY-MM-DDTHH:mm:00")`) e a exibição (`toLocaleString("pt-BR")` sem `timeZone`) usam o fuso do **navegador**. 2. Pedido: agenda operacional coerente. 3. Diferença: um executivo em outro fuso grava e lê horários deslocados em relação ao agrupamento. 4. Impacto: compromisso pode aparecer no dia errado e o conflito pode ser avaliado no intervalo errado. 5. Recomendação: fixar `America/Sao_Paulo` na criação e na exibição. Custo baixíssimo — a tabela está vazia.

---

## BLOCO 5 — CADÊNCIA ATUAL

**38–39. Identidade das etapas — STATUS: DIVERGÊNCIA**
Convivem dois vocabulários:
- Motor de **ligações**: `crm_cadence_tasks.step_day` (inteiro), usado como identidade na chave de conflito `lead_id,channel,cycle_date,step_day` (`cadence.server.ts:196`) e no rótulo da Agenda `D${t.step_day}` (`agenda.functions.ts:96`).
- Motor de **mensagens**: `step_key` textual na Biblioteca, nos envios e nos vínculos de conteúdo.
Ou seja: **não existe hoje separação entre "dia da cadência" e "identidade da etapa"** no motor de ligações. Impacto: o vocabulário E-n da Parte B não tem onde se apoiar no lado das ligações e da Agenda. Recomendação: acrescentar `step_key` textual às tarefas mantendo `step_day` como está (nada de reescrever histórico).

**40. Número tratado como dia — STATUS: OK no lado das mensagens**
E12, E20, E27 etc. são **chaves de texto** na Biblioteca; nada no código deriva dia a partir do número. O único lugar onde número = dia é `step_day`, do motor de ligações.

**41. E6 daqui a seis meses — STATUS: OK conceitualmente, mas não implementado**
O modelo da Biblioteca (chave textual) suporta etapa independente de dias. O que não existe é a etapa E6.

**42. Nova contagem de 7 dias na E6 manual — STATUS: OK (infraestrutura pronta)**
`relationship_e20_occurrences` já grava geração, `expires_at` de exatamente 7 dias corridos, `checkpoint_due_at` e encerramento da ocorrência anterior (`encerrada_por_nova`), com o executivo que gerou. Tabela hoje **vazia** — nunca foi exercida em produção.

**43. E6 e E7 — STATUS: DIVERGÊNCIA**
**Não existem** no código nem na Biblioteca. Busca por `"E6"`/`"E7"` no `src`: zero ocorrências. Etapas ativas na Biblioteca hoje (17, todas V1): E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1. E20, E27 e FINALIZACAO existem como slots **vazios e inativos**. Também não existem E2, E5 e R0.

**44. Confusão E6↔E20 / E7↔E27 — STATUS: OK hoje, RISCO amanhã**
Hoje não há confusão possível, porque E6 e E7 não existem. O risco nasce na Parte B: E20/E27 são as chaves internas de "apresentação digital" e "desfecho", exatamente o papel que E6/E7 vão assumir na nova nomenclatura. Recomendação de menor risco: **manter E20/E27 como chave interna e exibir E6/E7 na interface**, evitando renomear colunas, funções e a rota do convite.

**45. Histórico preservado — STATUS: OK**
`relationship_message_sends` congela `rendered_body`, `template_body`, `library_version` e `code` no instante do envio. Renomear ou versionar uma etapa hoje não altera nenhum registro passado.

---

## BLOCO 6 — E0 E AUTOMAÇÃO

**46. E0 como único disparo automático — STATUS: OK**
Texto ativo na Biblioteca; caminho de envio pronto (`dispatch.server.ts` → `renderFromLibrary` → `crm_messages` com id determinístico anti-duplicidade); o canal `message` do motor antigo está desligado por configuração. Não há um segundo motor concorrendo.

**47–48. Template Meta e simulação — STATUS: DIVERGÊNCIA (bloqueante para envio real)**
`crm_meta_templates` tem **0 linhas**. `src/lib/crm/e0-simulation.ts:12` — `export const E0_SIMULATION_ENABLED = true`. Consumido em 6 arquivos, entre eles `engine.server.ts:31` (`virtualTemplates: E0_SIMULATION_ENABLED`) e `dispatch.server.ts:120` (`const simulated = E0_SIMULATION_ENABLED || recipient.isTest`).
Impacto: **nada sai de verdade hoje** — todo E0 é simulado e registrado como tal.

**49. O que é preciso para produção, com segurança — ordem obrigatória**
1. Cadastrar em `crm_meta_templates` o template oficial aprovado pela Meta, com nome exato, idioma e corpo (sem inventar texto — precisa vir do painel oficial).
2. Conferir que a linha E0 da Biblioteca aponta para esse `meta_template_name` e que `requires_template` está coerente.
3. Só então trocar `E0_SIMULATION_ENABLED` para `false`.
4. Validar em homologação com lead `TEST-*` — a trava `recipient.isTest` continua simulando lote de teste mesmo com token real, então esse teste é seguro.
Inverter a ordem (desligar a simulação antes do cadastro) faz o motor exigir template inexistente e bloquear todo E0.

---

## MAPA DE PRONTIDÃO PARA A PARTE B

### A) PRONTO — não precisa mexer
- Reestruturação `/f` (38 rotas) e 33 stubs legados com redirect 1:1 preservando `search`.
- Ausência total de navegação interna para rotas antigas.
- Precedência de rota estática sobre `/f/$slug`; links `/f`, `/s`, `/seg`, `/e` intactos.
- Slugs reservados rejeitados na interface **e** na persistência; sem correção silenciosa.
- Guard único com `ssr: false`, sem piscar, sem segunda lógica de login; `/` só institucional.
- Agenda global nos quatro ambientes, como overlay, sem perder o estado da tela.
- Três prioridades reais; reunião/compromisso/ação diferenciados; sem duplicação de reunião.
- `workspace_agenda_events` criada com RLS por executivo e acesso de administrador.
- Proteção de banco contra sobreposição compromisso x compromisso (prioridade máxima).
- Snapshot imutável dos envios — histórico preservado sem renomear nada.

### B) CORRIGIR ANTES DA PARTE B
1. **Fuso horário da Agenda** — fixar `America/Sao_Paulo` na criação e na exibição (tabela vazia, custo mínimo).
2. **Identidade textual da etapa** — adicionar `step_key` às tarefas de cadência, mantendo `step_day`; sem isso o vocabulário E-n não existe do lado das ligações nem da Agenda.
3. **Rótulo `D{n}` na Agenda** — substituir pelo identificador de etapa, depois do item 2.
4. **Padrão `"SIM"` no desfecho de ligação** (`cadence.server.ts:183`, `input.outcome ?? "SIM"`) — grava "atendeu" sem ninguém ter informado; corrigir antes de qualquer regra condicional de E7.
5. **Criar os slots ausentes na Biblioteca** — E2, E5, E6, E7, R0 (só os slots; textos são decisão sua).

### C) PRECISA DE DECISÃO SUA
1. **E6/E7 x E20/E27** — manter E20/E27 como chave interna e mostrar E6/E7 na interface (recomendado), ou renomear de fato.
2. **Textos oficiais** de E2, E5, E6, E7, R0 e dos slots vazios E20, E27 e FINALIZAÇÃO — nada será inventado.
3. **Template Meta do E0** — enviar o template aprovado para cadastro e autorizar a saída da simulação.
4. **Agenda x mensagens** — a Agenda passa a mostrar também a fila de mensagens (24 itens hoje invisíveis) ou continua só com ligações?
5. **Conflito compromisso x reunião no banco** — fechar a corrida ou aceitar a checagem em código.
6. **Normalização `/F` → `/f`** — corrigir ou aceitar as duas grafias.
7. **`unitPath()` x 153 literais** — confirmo a recomendação de não migrar em massa agora?

### D) NÃO FOI POSSÍVEL CONFIRMAR
1. Comportamento com dois executivos gravando simultaneamente no mesmo horário — a tabela está vazia e não há registro real para observar.
2. Fluxo real da E6/link de 7 dias ponta a ponta — `relationship_e20_occurrences` tem 0 ocorrências; o código está pronto, mas nunca foi exercido.
3. Envio real do E0 pela Meta — impossível verificar enquanto a simulação estiver ligada e `crm_meta_templates` estiver vazia.
4. Trava de slug reservado no servidor — os usuários são persistidos em `localStorage`, então não há como validar do lado do banco.
