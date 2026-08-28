# Auditoria Técnica Profunda — Estado Real do Projeto antes da PARTE B

Nenhuma alteração foi feita: código, banco, rotas e componentes intactos.
Tudo abaixo veio de leitura de arquivos e consultas ao banco nesta rodada.

---

## BLOCO 1 — ARQUITETURA ATUAL

**1–2. Estrutura de rotas** — STATUS: EXISTE, PARCIALMENTE MIGRADA
Sob `/f`: `f.tsx` (layout neutro), `f.executivo.*` (33 telas), `f.crm.tsx` + `f.crm.index.tsx`, `f.portal-leads.tsx`, `f.remarketing.tsx` + `f.remarketing.index.tsx`, `f.$slug.tsx`.
Na raiz continuam: `index.tsx` (Portal do Investidor), `entrar.tsx`, `universo.tsx`, `origem.$channel.tsx`, `portal.convite.$token.tsx`, `e.$slug.tsx`, `s.$slug.tsx`, `seg.$slug.tsx`, `oauth.google.$connector.tsx`, `manual/`, `api/`, mais 34 stubs legados (`executivo.*`, `crm.tsx`, `portal-leads.tsx`, `remarketing.tsx`).

**3–4. Unidade de negócio** — EXISTE, MAS PRECISA SER ALTERADO
`src/lib/business-unit.ts` declara as três unidades (`f`, `s`, `seg`), `unitPath()`, `currentUnit()`, `isOperationalPath()`, lista de slugs reservados e `validateExecutiveSlug()`. Porém `unitPath()` tem **zero uso real** — só a própria definição. Há **153 caminhos `/f/...` literais** no código.
IMPACTO: mudar o prefixo hoje exigiria edição manual em massa. RECOMENDAÇÃO: não migrar em bloco (quebraria a tipagem de `Link to=`); usar o helper em código novo.

**5. Financeira/Solar/Seguros** — PARCIAL, hoje é declarativo
As três existem em `business-unit.ts` e em `portal-brands`, e há `s.$slug.tsx`/`seg.$slug.tsx` (que só redirecionam para `/` com contexto de marca). Não existe ambiente operacional, tabela, fila nem policy própria para Solar/Seguros.

**6–7. Duplicação x redirecionamento** — PRONTO
Não há tela duplicada: os 34 arquivos legados são stubs de `beforeLoad → redirect` com `replace: true` preservando `search`. Cobrem `/executivo/*` (todas as 33), `/crm`, `/portal-leads`, `/remarketing` → equivalentes em `/f/...`.

**8. Conflito `/f/$slug`** — SEM RISCO
O roteador do TanStack dá precedência a segmentos estáticos sobre `$slug`; além disso `f.$slug.tsx` só redireciona para `/`, não renderiza módulo.

**9–10. Slugs reservados** — PRONTO
`RESERVED_UNIT_SLUGS = [executivo, crm, remarketing, portal-leads]`; `validateExecutiveSlug()` normaliza (minúsculo, sem acento) e **rejeita**, com sugestão separada. Aplicado na UI (`f.executivo.usuarios.tsx:147`) e no ponto de persistência (`src/lib/executive-auth.ts:345`). `safeExecutiveSlug` sobrou apenas como alias deprecado, sem uso.

---

## BLOCO 2 — AUTENTICAÇÃO E SEGURANÇA

**11–12. Autenticação interna** — PARCIAL
Sessão do Workspace vive no navegador (`src/lib/executive-auth.ts`, `getSession()`), lida por `OperationalGuard` nos layouts `/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads`, todos com `ssr: false`. É guard único de UI, mas **não é a autorização real** — esta vive em RLS do Supabase (`can_access_investor`, `current_executive_id`, `has_role`).

**13–14. Acesso sem sessão / flash de conteúdo** — PROTEGIDO na UI
`OperationalGuard` não renderiza nada até checar (`if (!checked || !session) return null`), então não há Workspace parcialmente pintado antes do redirect. Sem sessão vai para `/f/executivo`. Ressalva: a proteção é client-side; os dados continuam protegidos apenas pela RLS.

**15–16. Raiz `/`** — EXISTE, MAS PRECISA SER ALTERADO
`/` é o Portal do Investidor Financeiro (`src/routes/index.tsx`), com overlays (Simulador, Gateway, Revista, Estrutura, Princípios). Não é gateway institucional. Não há botão público apontando para Workspace/CRM; o acesso interno é por URL direta + sessão.

**17. Ownership** — PRESERVADO
Links personalizados gravam contexto (`?e=slug&b=marca&o=origem`) e a propriedade é resolvida em `src/lib/portal/ownership.ts`; canais TikTok/Meta têm carteira própria e nunca entram no escopo GreenSales.

---

## BLOCO 3 — GRUPO VELOX / DOMÍNIO

**18–19. portalvelox.com.br** — NÃO EXISTE diferenciação por host
Qualquer host serve o mesmo `/`. O único uso de host é `src/server/environment.server.ts` (`getRequest().headers.get("host")`) para decidir homologação x produção.

**20–21. Três empresas na institucional** — NÃO EXISTE
Só há a declaração de unidades e as marcas de link. Nenhuma página institucional de grupo. É perfeitamente viável tornar o institucional independente de `/f`, `/s`, `/seg`, pois eles são prefixos de rota isolados.

**22–23. Acesso institucional a ambiente interno** — NÃO EXISTE (bom)

**24–25. Origem por modalidade** — PARCIAL
Existe captura de origem por canal (`/origem/tiktok`, `/origem/meta` → `?ch=`) e por marca (`f`/`s`/`seg` em `portal-brands`). Não existe registro de clique em "Saiba Mais" por modalidade nem persistência de modalidade no lead.

---

## BLOCO 4 — LEADS E ORIGEM

**26–29. Criação e identificador** — EXISTE
Formulário → `src/server/crm/lead-intake.server.ts` → grava em `portal_leads` (56 linhas hoje). O identificador é interno (`ld_...`); o vínculo com a origem externa é feito por campos do próprio `portal_leads` (id externo + telefone normalizado), com identidade resolvida atomicamente no servidor (`resolve_portal_identity`).

**30–32. Origens e duplicidade** — PARCIAL
Reconhece GreenSales, Portal, TikTok e Meta. **Não reconhece Solar nem Seguros.** Deduplicação por telefone normalizado já existe (`deduplicated` no intake): entrada repetida é ignorada em vez de criar um segundo lead.

**33–35. Pertencimento a unidade** — NÃO EXISTE
Não há coluna de unidade/modalidade em `portal_leads` e não há tabela `group_leads` (zero referências no código, tabela inexistente no banco). Hoje um lead Solar/Seguros cairia dentro do universo financeiro. Não existe ambiente separado para visualizá-los.

---

## BLOCO 5 — PORTAL DOS LEADS / AÇÕES DO DIA

**36–38. "Ligações do Dia"** — EXISTE
`src/components/crm/daily-calls-overlay.tsx`, sobreposto ao Portal dos Leads; lista fila de hoje separada da fila atrasada (atrasada nunca vira ligação de hoje). Estruturalmente é uma lista alimentada por `listCadenceQueue({channel})` — o parâmetro de canal já existe, então transformar em "Ações do Dia" é ampliar, não reconstruir.

**39–45. Motor de ações** — PARCIAL
Existem dois: o de ligações (`src/lib/crm/cadence.ts` + `src/server/crm/cadence.server.ts`, tabela `crm_cadence_tasks`, 5 linhas) e o de mensagens (`src/lib/relationship/*`, `relationship_queue`, 24 linhas). O canal `message` está **desligado por configuração** no motor antigo, justamente para não haver dois motores disparando a mesma finalidade.
Conclusão: distinção ligação x mensagem existe; conclusão de ação existe (`completeCadenceTask`, status DONE + `outcome` + evento em `crm_lead_events`); a próxima ação é calculada a partir do histórico real (âncora = data da ligação executada, não a prevista); e há travas de incompatibilidade (OPORTUNIDADE é terminal; L2=NÃO e L3=NÃO encerram o ciclo).

---

## BLOCO 6 — CADÊNCIA

**46–48. Etapas conhecidas** — PARCIAL / vocabulário misto
Na Biblioteca (`relationship_message_library`, 20 linhas, todas V1): E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1, E20, E27, FINALIZACAO. **Não existem E2, E5, E6, E7 nem R0.**
No motor de ligações a identificação é numérica (`step_day` 1..5, rotulada L1–L5 / D-n). Ou seja, hoje convivem três vocabulários: E-n (mensagens), L-n/D-n (ligações) e nomes legados (E12, E20, E27).

**49–50. Etapa x dia** — CONFUNDIDOS no motor antigo
`crm_cadence_tasks.step_day` é ao mesmo tempo ordinal da tentativa e chave de conflito (`lead_id,channel,cycle_date,step_day`). No motor novo, etapa é texto (`step_key`/`step`), corretamente separada da data.

**51–52. E6 manual e E7 em +7 dias corridos** — PARCIAL
Emissão manual com data/hora e +7 dias corridos já existe no fluxo E20 (`src/server/relationship/e20.server.ts`: `generated_at`, `expires_at`, `checkpoint_due_at` em +7 dias, finalização no dia útil seguinte). Falta amarrar isso a uma ação de ligação subsequente.

**53–55. Cancelamento condicional pela ligação** — NÃO EXISTE como fluxo
As peças existem: `crm_cadence_tasks.outcome` (SIM/NAO), "sem registro" distinguível (status ≠ DONE e `outcome` nulo), checkpoint em +7 dias na E20 e trava terminal em OPORTUNIDADE. Falta o encadeamento E6 → ligação em +7 → cancelar/liberar E7.
**RISCO CRÍTICO:** em `completeCadenceTask` o desfecho tem **padrão `"SIM"`** quando não informado — para a regra da E7 isso significaria assumir atendimento que não houve.

---

## BLOCO 7 — MENSAGENS

**56–57. Onde vivem** — NO BANCO (com semente em código)
`relationship_message_library` é a fonte oficial; `src/lib/relationship/messages.ts` só serviu de semente da V1. Há ainda `src/lib/crm/templates.ts` (textos legados) — não é a fonte do motor novo.

**58–59. Central de Templates** — EXISTE, com finalidade distinta
`/f/executivo/templates` trabalha com `crm_meta_templates` = templates **oficiais da Meta**. A biblioteca operacional é outra tabela. A separação está correta. Atenção: `crm_meta_templates` está **vazia (0 linhas)** — E0 como template Meta automático hoje não tem template cadastrado.

**60–61. Versão e histórico** — PRONTO
Colunas `version`, `active`, `supersedes_id`; editar cria a versão seguinte e desativa a anterior; uma única ativa por etapa (índice único).

**62. Automática x assistida** — PARCIAL
`relationship_message_sends.origin` distingue `motor | executivo | remarketing | portal`, mas não há um atributo declarado na própria etapa dizendo "esta é manual".

**63–67. Nome do investidor** — PRONTO e conservador
`src/lib/relationship/names.ts`: `normalizeName`, `firstName`, `isPlausibleName`, `looksLikeName`, tratamento de nome composto, `NEUTRAL_TREATMENT`, e resolução de `{{nome_investidor}}` **somente com nome confirmado**. Uso real em `src/server/crm/automation.server.ts:101`: primeiro nome só se plausível, senão tratamento neutro. Não há dicionário de nomes comuns nem adivinhação. Risco de "Olá, Tiago" indevido é baixo, restrito a um nome plausível porém errado na origem.

---

## BLOCO 8 — BIBLIOTECA DE CONTEÚDO

**68–70. Onde e vínculo por etapa** — EXISTE
`relationship_contents` (17 itens) + `relationship_step_content_bindings` + `src/server/relationship/step-media.server.ts`. O vínculo é **declarado**, nunca inferido por nome de arquivo ou posição — o motor pergunta "qual conteúdo está vinculado à etapa X".

**71–72. Vários conteúdos por etapa** — PRECISA SER ALTERADO
Há índice único que permite **apenas um vínculo ativo por etapa**. Sem vínculo, o motor sorteia dentro do grupo de conteúdo autorizado. Para "E1 → vários conteúdos" é preciso relaxar a unicidade e declarar a regra de seleção.

**73–76. Ativo/inativo, troca de link e efeito** — PRONTO
Há `active` no vínculo e no conteúdo; trocar o conteúdo vinculado à E3 muda o próximo envio E3 sem tocar no texto da mensagem, porque mensagem e conteúdo são registros separados.

---

## BLOCO 9 — NOTAS DO EXECUTIVO

**77–80. Ambiente de notas** — PARCIAL
Não existe um bloco "Notas do Executivo" no card. Existe registro estruturado de eventos: `crm_lead_events` (tipo, mensagem, `data` JSON, data/hora — ex.: `CADENCE_TASK_DONE` com canal, etapa, desfecho) e `crm_timeline`, além da Jornada consolidada (`src/server/relationship/journey.server.ts`, com whitelist relacional e separação Jornada x Auditoria Técnica). Falta: nota livre escrita pelo executivo e o executivo responsável explicitamente carimbado em todo evento.

**81. Mensagem completa armazenada** — PRONTO
`relationship_message_sends.rendered_body` guarda o texto exato enviado, com `library_version`, `library_code`, etapa, `actor_name`, conteúdo e canal.

**82–85. Interface de cards / modal** — PARCIAL
`src/components/crm/crm-lead-journey.tsx` já exibe a jornada com alternador Jornada/Auditoria, mas não há card clicável abrindo a mensagem completa em modal com altura fixa. É trabalho de apresentação, sem dependência de banco.

---

## BLOCO 10 — APRESENTAÇÃO DIGITAL / E6

**86–93. Link, token, validade e expiração** — PRONTO como infraestrutura
`src/server/relationship/e20.server.ts`: token URL-safe aleatório de 24 bytes, `relationship_e20_occurrences` (lead, token, `generated_at`, `expires_at` = +7 dias corridos, `checkpoint_due_at`, `finalization_due_on`, status, `close_reason`) e `relationship_e20_accesses` (aberturas). A rota `/portal/convite/$token` (`ssr: false`) valida no servidor e, quando inválido/vencido, mostra explicação legível na própria página — não existe página separada de "link expirado", e o conteúdo interno não é entregue.

**94–97. Botão no card e etapa** — NÃO EXISTE
Não há botão "Gerar apresentação digital" no card, nem o estado pós-geração ("copiar link/mensagem"). Data/hora de geração já é registrada. A etapa E20 está associada ao fluxo, mas o **texto oficial da E20 está vazio e inativo** na Biblioteca (o motor bloqueia o envio em vez de inventar mensagem).
Compatibilidade: `relationship_e20_occurrences` está com **0 linhas** — nenhum link foi emitido, logo reaproveitar a estrutura para a E6 não quebra nada em circulação.

---

## BLOCO 11 — REENGAJAMENTO / RETOMADA / FINALIZAÇÃO

**98–101.** Existem na Biblioteca, todos com texto ativo: R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1. **R0 não existe.** RF0/RF1 são a retomada/follow-up (reabertura de conversa após o ciclo), distinta do reengajamento RE0–RE3 (lead que voltou pela origem). A distinção é hoje semântica, expressa nas chaves e nos textos, não em uma máquina de estados separada.

**103–106. Estados e paradas** — EXISTE
`src/lib/relationship/closing.ts`: `NON_AUTOMATED_STAGES = [novos, agendamento, video, oportunidade]` e `TERMINAL_STAGES = [oportunidade]`. Existe estado de agendamento e OPORTUNIDADE encerra tudo. Regras de parada: etapa terminal, fim da sequência de tentativas, e L2=NÃO + L3=NÃO. Não existe sequência específica disparada por "agendamento não respondido".

---

## BLOCO 12 — AGENDA

**107–109.** EXISTE. `src/components/agenda/agenda-dock.tsx` montado no `__root.tsx`, visível globalmente nos caminhos operacionais.

**110–111.** `workspace_agenda_events` existe (11 colunas): id, executive_id, title, starts_at, ends_at, priority, source, note, created_at/updated_at. **0 linhas — nunca foi usada.**

**112–113. RLS** — PRONTO
Quatro políticas para `authenticated` (ver/criar/editar/remover apenas os próprios compromissos); identidade resolvida no servidor por `current_executive_id()`, nenhum identificador aceito do cliente.

**114–115. Reuniões** — PRONTO
`portal_meetings` é lida em modo somente leitura, com id prefixado (`meeting:`) e canceladas ignoradas. Sem duplicação e sem escrita.

**116–117. Conflitos** — PARCIAL
No banco: `EXCLUDE USING gist (executive_id =, tstzrange(starts_at, ends_at, '[)') &&) WHERE priority = 'maxima'`, mais `ends_at > starts_at`. Conflito **evento x reunião** é verificado só em código (`agenda.functions.ts`), antes da gravação — sujeito a corrida concorrente.

**118–119. Prioridades** — PRONTO
`maxima | media | minima` com check no banco. Ações de cadência entram como `minima`, sem horário (`startsAt/endsAt` nulos), em faixa própria do dia — nenhum horário é fabricado.

**Divergência de fuso (crítica):** o agrupamento por dia no servidor usa `America/Sao_Paulo`, mas o `agenda-dock.tsx` cria o compromisso com `new Date("YYYY-MM-DDTHH:mm:00")` e exibe com `toLocaleString("pt-BR")` **sem `timeZone`** — ambos no fuso do navegador.

**Divergência de fonte:** a Agenda lê ações via a função `agenda_cadence_tasks`, que lê `crm_cadence_tasks` e devolve `step_day`, rotulado `D{n}`. Ou seja, a Agenda enxerga apenas o motor antigo (5 tarefas) e ignora as 24 da fila do motor novo.

---

## BLOCO 13 — PONTOS DE ATENÇÃO

**120. Dez pontos mais importantes**
1. `outcome` com padrão `"SIM"` em `completeCadenceTask` — assumiria atendimento inexistente na regra da E7.
2. Agenda lendo apenas o motor antigo (`step_day`/D-n), invisível para a maior parte da operação real.
3. Vocabulário de etapa triplicado (E-n, L-n/D-n, legados E12/E20/E27) sem chave única.
4. Fuso da Agenda dependente do navegador na criação e na exibição.
5. `group_leads` inexistente — Solar/Seguros contaminariam `portal_leads`.
6. E2, E5, E6, E7 e R0 não existem na Biblioteca.
7. E20/E27/FINALIZAÇÃO são slots vazios e inativos: nenhum envio ocorre sem os textos oficiais.
8. `crm_meta_templates` vazia — E0 automático sem template Meta cadastrado.
9. Um único conteúdo ativo por etapa (índice único) x requisito de vários conteúdos.
10. 153 caminhos `/f/...` literais com `unitPath()` sem uso.

**121. Parece pronto, mas não está**: Agenda global (visível, porém 0 registros e conflito com reuniões só em código); Ligações do Dia (funciona, mas cobre 5 tarefas); Biblioteca (versionada, mas metade das etapas da Parte B não existe); E20 (infra completa, sem texto e sem botão).

**122. Simulado/mockado**: apenas o ambiente de homologação (`src/lib/creative/e0-simulation.ts`, lotes `is_test`), corretamente isolado de produção — nada em produção é mock.

**123. Visual sem persistência real**: a Agenda para "Ações do dia" apresenta itens somente leitura que não podem ser concluídos dali; a Jornada não tem card clicável para o texto completo.

**124. Reutilizável na Parte B**: `relationship_message_library` (+`supersedes_id`), `relationship_message_sends` (snapshot), `relationship_step_content_bindings`, `relationship_contents`, `relationship_e20_occurrences`/`_accesses` e `/portal/convite/$token`, `workspace_agenda_events` + EXCLUDE, `agenda_cadence_tasks`, `current_executive_id`, `can_access_relationship`, `set_lead_operational`, `crm_lead_events`, `names.ts`, `business-unit.ts`, `OperationalGuard`.

**125. NÃO reutilizar**: `portal-leads-board` para Solar/Seguros (arrasta cadência, jornada, engajamento e sincronização GreenSales); `src/lib/crm/templates.ts` (textos legados fora do motor); o canal `message` do motor antigo (desligado de propósito); e nada que escreva em `portal_leads` a partir das novas filas.

**126. Dependências perigosas**: gatilhos de blindagem contra exclusão em `portal_leads` (`portal_lead_guard_log`); reconciliação contínua GreenSales; deduplicação por telefone (um lead Solar com telefone já existente na Financeira seria descartado se compartilhassem tabela); e os stubs legados, que assumem 1:1 com `/f`.

**127. Contradições com o conceito operacional**: rótulo `D{n}` na Agenda contra o vocabulário E-n; "Ligações do Dia" contra "Ações do Dia" (mensagens não aparecem); `/` financeiro contra o conceito de raiz institucional do Grupo.

**128–129. Não determinável pelo código — precisa de decisão**
- Host exato do institucional e comportamento em preview/localhost — sem isso a mudança quebraria o ambiente de trabalho atual.
- Destino do link personalizado `/f/{executivo}` quando `/` virar institucional — hoje ele redireciona para `/`; sem decisão, os links em circulação passariam a abrir a página errada.
- Textos oficiais de E2, E5, E6/E20, E7, E27, R0 e FINALIZAÇÃO — o motor bloqueia envio sem texto e não inventamos conteúdo.
- Regra de seleção quando houver vários conteúdos por etapa (rodízio, ordem fixa, aleatório) — muda o índice do banco.
- Quem enxerga e atende as filas Solar/Seguros — define a RLS.
- Se a Agenda passa a exibir também as mensagens do motor novo — define a fonte única.

**130. Conclusão: (B) PARCIALMENTE PREPARADO.**
A fundação é sólida (versionamento, snapshot, vínculo de conteúdo, links de 7 dias, RLS, guard, Agenda com trava no banco). O que impede uma Parte B sem interpretação são lacunas conceituais, não fragilidade estrutural: identificação única de etapa, filas Solar/Seguros inexistentes, textos ausentes e o padrão de desfecho de ligação.
Consequência de implementar sem resolver: E7 disparando sobre atendimento presumido; Ações do Dia mostrando parte da operação; leads Solar/Seguros dentro da base financeira blindada (difíceis de remover depois); horários de agenda errados para quem estiver fora do fuso de São Paulo; e histórico com três vocabulários de etapa impossíveis de reconciliar retroativamente.

---

## DECISÕES QUE PRECISAM SER FECHADAS ANTES DA IMPLEMENTAÇÃO

1. Host institucional e comportamento em preview/localhost.
2. Destino do link personalizado `/f/{executivo}` após o institucional assumir `/`.
3. Identificação única de etapa: acrescentar `step_key` textual às tarefas de cadência mantendo `step_day` (recomendado) ou migrar histórico.
4. A Agenda passa a ler também o motor de mensagens (fonte única) ou permanece só ligações.
5. Vários conteúdos ativos por etapa e a regra de seleção.
6. Textos oficiais de E2, E5, E6, E7, R0, E27 e FINALIZAÇÃO.
7. Remover o padrão "SIM" do desfecho de ligação (ausência = indefinido).
8. Notas do Executivo: criar tabela de nota manual (recomendado) ou apenas consolidar a leitura existente.
9. `group_leads`: tabela única com modalidade (recomendado) x tabelas separadas, e quem atende cada fila.
10. Fixar `America/Sao_Paulo` na criação e exibição da Agenda (tabela vazia hoje: correção sem risco).
11. Levar a trava de conflito evento x reunião para o banco ou manter só em código.
