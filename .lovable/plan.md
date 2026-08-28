# Auditoria Técnica 2/5 — Fotografia do código real

Somente leitura. Nenhum código, migration, rota ou componente foi alterado.

## 1. Ação do Dia — arquitetura atual

- **Onde é montada:** `src/components/crm/daily-calls-overlay.tsx` (overlay "Ligações do Dia"), aberto pelo botão do `src/components/crm/portal-leads-board.tsx:614`.
- **Motor que alimenta:** `listCadenceQueue({ channel: "call" })` em `src/lib/crm/cadence.functions.ts` → tabela **`crm_cadence_tasks`** (motor legado de ligações). Server: `src/server/crm/cadence.server.ts`.
- **Tipos que entram:** apenas tarefas de canal `call`, separadas em `overdue` e hoje (regra §19: atrasada nunca é contada como ligação de hoje). Ações concluídas removem só a ocorrência do dia.
- **Motor que produz ações e NÃO aparece ali:** sim, dois.
  - `relationship_queue` (motor oficial de mensagens) — hoje com **26 itens pendentes/processados: E1 (11), E3 (9), E4 (6)** — invisível no overlay.
  - `workspace_agenda_events` (Agenda) e `portal_meetings` — invisíveis no overlay.
- Arquivos: `daily-calls-overlay.tsx`, `portal-leads-board.tsx`, `src/lib/crm/cadence.functions.ts`, `src/server/crm/cadence.server.ts`, `src/lib/crm/call-planning.ts`, `src/lib/agenda.functions.ts`.

## 2. Motor oficial

- **Fonte de verdade por tipo hoje:**
  - Ligações → `crm_cadence_tasks` (5 linhas, todas `DONE`; nenhuma pendente).
  - Mensagens → `relationship_queue` + `relationship_message_sends` (3 envios E1, 6 E3).
  - Compromissos → `workspace_agenda_events` (1 linha) e `portal_meetings` (1 linha).
- **É possível sem terceiro motor:** sim. Nenhuma estrutura nova de execução é necessária.
- **Arquitetura mais segura:** um **agregador de LEITURA** no servidor (ex.: `src/server/crm/daily-actions.server.ts`) que consulta as três fontes, normaliza para um tipo único `DailyAction { key, kind, leadId, step, dueAt, priority, overdue, source }` e devolve ordenado. Nenhuma escrita, nenhuma cópia de linha entre tabelas. A conclusão de cada ação é despachada de volta para a tabela de origem, escolhida pelo campo `source`.

## 3. Identidade única da ação

- **Hoje não existe** chave determinística cruzando os motores. `crm_cadence_tasks` tem `id` uuid próprio; `relationship_queue` identifica por `lead_id + step + instância`; a Agenda por `id` de evento. Não há nada que reconheça "a mesma ação" vinda de duas origens.
- **Chave recomendada:** `action_key = ${source}:${leadId}:${step ?? kind}:${instanceSeq ?? occurrenceDate}` — determinística, calculável em leitura, sem coluna nova no primeiro momento.
- **Idempotência de exibição:** o agregador materializa um `Map<action_key, DailyAction>`; a primeira origem por ordem de precedência (Agenda > fila oficial > legado) vence e as demais são descartadas com o motivo registrado.
- **Onde aplicar:** na normalização de cada leitor do agregador, antes da ordenação; e no handler de conclusão, que recebe a `action_key` e a resolve para a tabela de origem.

## 4. Etapas do motor — estado real

Conteúdo em `relationship_message_library` (21 linhas, 1 versão ativa cada):
`E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1, E20, E27, FINALIZACAO`.

- **Com texto oficial:** E0, E0_V1, E1, E3, E4, E12, V3, V4, R1–R3, RE0–RE3, RF0, RF1.
- **Slots vazios declarados:** `PENDING_TEXT_STEPS = ["E20","E27","FINALIZACAO"]` (`src/server/relationship/message-library.server.ts:47`) — existem na tabela, sem texto aprovado.
- **E2, E5, E6, E7, R0: não existem** — nem em `LIBRARY_STEP_ORDER`, nem em `src/lib/relationship/messages.ts`, nem no banco. Confirmado.
- **Bindings:** `relationship_step_content_bindings` está **VAZIA (0 linhas)**. Nenhuma etapa tem binding de conteúdo hoje.
- **Com infraestrutura mas sem UI:** E20 (backend completo: emissão, token, TTL, resgate, acessos — zero consumidores `.tsx`); E1/E3/E4 (fila oficial ativa, mas o Portal dos Leads não renderiza a mensagem).
- **Só precisa cadastro de conteúdo:** E20, E27, FINALIZACAO (o texto oficial vem do Word).
- **Precisa criação estrutural:** E2, E5, E6, E7, R0.

## 5. E20 × E6

- **Sim, é a estratégia de menor risco.** E20 é chave persistida em dados, não apenas constante.
- Podem continuar internamente: rota `src/routes/portal.convite.$token.tsx`, tabelas `relationship_e20_occurrences` / `relationship_e20_accesses` (colunas `scope`, `cadence_id`, `instance_seq`), `issueE20`/`redeemE20` (`src/server/relationship/e20.server.ts`) e `renderFromLibrary("E20", ...)`.
- **Sim**, o usuário pode ver "E6 — Apresentação Digital" com um mapa de rótulo (`STEP_LABEL` já existe em `message-library.server.ts`) sem tocar em nada histórico.
- **Onde renomear quebraria:** a linha `step_key = 'E20'` em `relationship_message_library`; `PENDING_TEXT_STEPS`; `LIBRARY_STEP_ORDER`; a cor de badge `e20` em `src/components/crm/crm-lead-journey.tsx:54`; e qualquer `relationship_message_sends`/snapshot já gravado com `step = 'E20'` — renomear invalidaria o histórico de envios.

## 6. Botão "Gerar Apresentação Digital"

- **Onde inserir:** `src/components/crm/crm-lead-ficha.tsx` (ficha) e/ou o menu do `LeadCard` em `src/components/crm/portal-leads-board.tsx:80`.
- **Identificação do lead:** sim, ambos já operam com o `leadId` (ID original da GreenSales) em mãos.
- **Token de 7 dias:** pronto. `issueE20` gera token, `link_url`, `expires_at = now + SEVEN_DAYS_MS` (`e20.server.ts:23,129-131`).
- **O que falta:** (a) botão que chame `emitirE20` (`src/lib/relationship/e20.functions.ts:8`); (b) leitura do estado atual via `listarOcorrenciasE20`; (c) exibição de prazo/status; (d) texto oficial de E20 na Biblioteca.
- **Risco de dois links válidos:** hoje **não** há dois válidos — `issueE20` encerra a ocorrência anterior e abre nova. O risco real é o inverso: **duplo clique invalida o link já entregue ao investidor**. Mitigação: botão idempotente que reutiliza a ocorrência ativa e exige ação explícita para regerar.

## 7. Copiar apresentação

- **Normalização de nome:** sim, atende. `src/lib/relationship/names.ts` — `normalizeName:29-41`, `firstName:44-47`, `resolveTreatment:140-169`, com `NEUTRAL_TREATMENT = "caro investidor"` (`:12`) quando o nome não é plausível ou foi rejeitado.
- **Gerador reutilizável:** `renderFromLibrary(step, vars)` em `src/server/relationship/message-library.server.ts`, já usado por `issueE20` (`e20.server.ts:167-171`).
- **Snapshot:** `recordMessageSnapshot` — congela template, versão e texto renderizado no momento do envio. Deve ser gravado no **ato do envio manual confirmado**, não na geração do link.
- **Gerar link deve registrar apenas a emissão da apresentação** (`relationship_e20_occurrences`) e, no máximo, um evento relacional do tipo `cadencia_*` na Jornada. Nunca um evento de atividade do investidor.
- **O que evita contaminação:** manter a emissão fora da lista branca `src/lib/events/investor-activity.ts`. Atividade do investidor só nasce quando o link é **aberto** (`redeemE20` → `relationship_e20_accesses`).

## 8. Validade de 7 dias

- **Exatamente 7 dias corridos** a partir da emissão: `SEVEN_DAYS_MS = 7*24*60*60*1000` (`e20.server.ts:23`), aplicado em `:130`.
- **Bloqueio no servidor:** `redeemE20` (`:219-265`) recusa o resgate e grava `status = 'expirada'` (`:240-245`). A interface não participa.
- **Registro de cada acesso:** sim — `relationship_e20_accesses` (`occurrence_id`, `lead_id`, `accessed_at`, `outcome`, `user_agent`), inserido em `:232-238`.
- **Quando abriu e quantas vezes:** sim — `first_opened_at` e `open_count` em `relationship_e20_occurrences`.
- Tabelas/funções: `relationship_e20_occurrences`, `relationship_e20_accesses`, `issueE20`, `redeemE20`, `listE20Occurrences`.

## 9. Status online / último acesso

- **Heartbeat: NÃO EXISTE.** Nenhum ping periódico.
- **Mecanismo de presença: não existe.** O que existe é agregação por evento: `portal_engagement` (via `src/server/portal-engagement.server.ts`), com `last_access_at`, sessões (`SESSION_GAP_MS = 4h`) e tempo ativo (`MAX_ACTIVE_GAP_MS = 5min`).
- **"Última atividade" hoje** = `portal_engagement.last_access_at` e `portal_leads.last_activity_at`, ambos movidos por eventos discretos (abrir módulo, material, simulador, IA).
- **Distinguir "abriu" de "está navegando agora": não é possível hoje** — sem eventos contínuos, uma aba parada é indistinguível de uma sessão ativa.
- **Menor implementação confiável:** ping do Portal a cada ~60s enquanto `document.visibilityState === "visible"`, atualizando somente `last_access_at`; "online" calculado **na leitura** (`now - last_access_at < 15 min`), sem coluna de status e sem job. Para não contaminar o `lastActivity` operacional, o ping deve gravar em um campo próprio (`last_seen_at`) e **não** entrar na lista branca de `investor-activity.ts` — presença é sinal de tela, não fato relacional.

## 10. Manual — histórico de acesso

- **Persistido: sim.** `manual` está na lista `TRACKED` de `src/server/portal-engagement.server.ts`; os eventos vão para `portal_engagement` e `portal_journey_events`.
- **Contém** `investorId` (lead_id), timestamp e chave do módulo. O capítulo específico chega como evento de jornada (`manual.chapter.completed`), não como coluna dedicada.
- **Diferencia primeiro acesso:** sim — `firstModuleAccess` no `EngagementResult`, gravado uma única vez por módulo.
- **Apenas em localStorage:** o progresso de leitura do investidor (hooks de progresso do Manual) e o barramento de eventos do executivo (`src/lib/events/bus.ts`), incluindo comentários (`src/lib/investor-comments.ts`) e alertas (`src/lib/workspace-alerts.ts`). Esses não existem no banco.

## 11. Manual — Capítulo 3

- **Armazenamento:** **componente + arquivo de dados**, não banco. Metadados em `src/lib/journey-data.ts` (capítulo `velox`, "Quem é a Velox"); corpo em `src/components/journey/chapter-bodies.tsx`, função `VeloxBody:104-260`, timeline em `:106-132`.
- **Fonte única:** sim, esses dois arquivos. Não há duplicata em banco.
- **Alterar exige código.** Não existe CMS/editor para o Manual (o CMS `portal_institutional_blocks` cobre apenas os módulos institucionais da Home, não o Manual).
- **Versionamento: não existe.**
- **Versão lida pelo investidor: não é registrada.** Os eventos guardam módulo/capítulo e horário, nunca a versão do texto.

## 12. Manual — vídeo do capítulo 7

- **Definição:** flag `hasVideo: true` no capítulo `operacao` (`src/lib/journey-data.ts:146`), renderizada por `src/components/journey/chapter-view.tsx:76-80`.
- **Componente independente:** `src/components/journey/video-slot.tsx` — placeholder puro, texto fixo "Vídeo do especialista — em breve.", sem player, sem dados, sem storage.
- **Impacto:** remover a flag afeta somente o capítulo 7. Os capítulos 1 (`recepcao:34`) e 14 (`proximos-passos:268`) mantêm o seu. Alterar o **componente** afetaria os três.
- **Vínculo com perfil do executivo: nenhum.** `postPresentationVideoUrl` é campo separado, usado só em `src/lib/crm/post-presentation.ts`.

## 13. Princípios Velox

- **Cadastro:** banco — `portal_institutional_blocks`, lidos por `fetchInstitutionalModule({ module: "principios" })` (`src/components/portal/principios-overlay.tsx:13,62`). Sem bloco cadastrado, cai em `Princípio 0N` + `PLACEHOLDER_BODY` (`:27-28,42-44`).
- **Imagem interna:** é conteúdo **exclusivo da página** — `assetUrl("portal-capa-principios")` (`:15,84`). O card da Home usa `experienciasImg.url` (`src/routes/index.tsx:221`). **São assets diferentes; não há duplicação.**
- **Remover só a interna:** sim, seguro — basta remover o `<figure>` de `:82-91`. O card da Home não é tocado.
- **Hover:** **inexistente** nos cards (`<article>` em `:111-143`, sem classe `hover:`). Não há componente reutilizável de card com hover nesse overlay.
- **Link/handler a remover:** **nenhum** — os cards já não têm `onClick`, `<a>` nem `<button>`. O requisito "não clicáveis / sem modal / sem navegação" já é o estado atual.

## 14. portalvelox.com.br — host institucional

- **Identificação de host hoje:** praticamente inexistente. O único uso de hostname é `window.location.origin` como base de URL em `src/lib/portal-brands.ts:69-91` (com fallback hardcoded `https://velox-pathfinder-hub.lovable.app`) e em `dispatch.server.ts`.
- **Lógica baseada em hostname: não existe.**
- **Distinguir host institucional de operacional: não é possível hoje.**
- **"/" é diretamente o Portal do Investidor:** sim — `src/routes/index.tsx`, e os stubs `f.$slug/e.$slug/s.$slug/seg.$slug` redirecionam para `/`.
- **Mecanismo mais seguro:** **não** decidir por hostname em runtime. O caminho de menor risco é estrutural: mover o Portal Financeiro para `src/routes/f.index.tsx`, transformar `/` em Home institucional e apontar `investorPortalPath` para `/f/...`. Roteamento por hostname introduz divergência entre SSR e cliente e torna o preview (que roda em outro domínio) inconsistente com produção. Se o domínio precisar mesmo influenciar, que seja apenas um redirect de borda, nunca uma bifurcação de componente.

## 15. Separação do Grupo Velox

- **Nomes das unidades:** `src/lib/business-unit.ts` (prefixos e slugs reservados) e `src/lib/portal-brands.ts` (marcas e caminhos de portal).
- **"Agilize Brasil": NÃO EXISTE** em `src/` nem em `supabase/`. Nenhuma ocorrência.
- **"seguradora":** a nomenclatura corrente é "Seguros" (prefixo `seg`); não há uso público de "seguradora" que precise ser tratado como obsoleto no código.
- **Suporte às três unidades:** sim, a arquitetura já é multi-unidade por prefixo, sem duplicar aplicação. O que falta é conteúdo e a Home institucional.

## 16. Rotas das unidades

- **Já existem:** `f` (`src/routes/f.tsx`, `f.$slug.tsx` + toda a árvore `/f/*` operacional), `s` (`s.$slug.tsx`), `seg` (`seg.$slug.tsx`), além de `e.$slug.tsx` (executivo).
- **Reservados:** sim — `src/lib/business-unit.ts` possui validação de slugs reservados (o mecanismo equivalente a `RESERVED_UNIT_SLUGS` já existe e bloqueia colisão entre slug de executivo e prefixo de unidade).
- **Conflitos:** os stubs `s.$slug`/`seg.$slug` redirecionam para `/` (herança do Portal único) e as rotas legadas de topo (`crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`, `executivo.*`) redirecionam para `/f/*`.
- **Recomendação de nomenclatura:** **preservar `s` para Solar**, já implementado e simétrico com `f`/`seg`. Adotar `/sol` obriga a migrar rota, validação e links. Se `/sol` for decisão de marca, criar agora e manter `s` como alias permanente.

## 17. Perfil do executivo

- **Tabela `executive_profiles` existe**, com apenas: `user_id`, `executive_id`, `email`, `name`, `whatsapp`, `created_at`, `updated_at`.
- **No banco:** nome, e-mail, whatsapp (telefone).
- **Somente em código (seed `SEED_USERS`, `src/lib/executive-auth.ts:170,193-283`):** `slug`, `title` (cargo), `photoUrl`, `postPresentationVideoUrl`, `admissionDate`, `birthDate`, `phone`.
- **Conflito:** sim, estrutural. O Workspace resolve identidade pelo banco (`current_executive_id()`, RLS), enquanto a personalização visual e o slug do link vêm do seed. Um executivo criado no banco sem entrada no seed **não tem slug nem foto**.
- **Fonte única recomendada:** `executive_profiles` no banco, ampliada com `slug` (único), `title`, `photo_url` e `video_url` opcional; o seed vira apenas bootstrap inicial.

## 18. Permissões do executivo

- **Representação atual:** dois vocabulários.
  - Aplicação: `ExecutiveRole = super_admin | diretora | executivo` (`src/lib/executive-auth.ts:9`).
  - Banco: enum `app_role = admin | manager | user` em `user_roles`, com `has_role()`, `current_executive_id()`, `is_portal_member()`, `can_access_investor()`.
- **Mais de um vocabulário: sim** — e não são sincronizados por código; a ponte é o trigger `grant_admin_for_official_executive` (concede `admin` a `usr_thiago`).
- **Consistência:** parcial. Administrador e gestora são consistentes; o **híbrido é a inconsistência**: `HYBRID_WORKSPACE_USER_IDS = ["usr_thiago"]` (`src/lib/portal-workspace.ts:19`) concede acesso por **ID de usuário**, ignorando o papel ativo — contrariando o comentário em `:130-133`.
- **Frontend x servidor:** ambos, desigualmente. Dados sensíveis têm RLS real (`portal_leads`, E20, agenda, biblioteca) e `set_lead_operational` valida internamente. Mas **não há guard server-side por módulo**: `workspace_module_permissions` é lida pelo frontend para decidir menu.
- **Risco de acesso por URL:** **sim, real** para a camada de navegação. Digitar `/f/executivo/templates` ou `/f/remarketing` passa pelo `OperationalGuard` (que só exige sessão operacional) e o `requiresRole` de `modules.ts` governa a navegação, não a rota. O dado por trás continua protegido por RLS, mas a tela abre.

## 19. Área exclusiva do administrador — apresentações

- **Listagem existente:** os dados sim (`relationship_e20_occurrences`, com `generated_at`, `generated_by_name`, `expires_at`, `first_opened_at`, `open_count`, `status`) e a função `listE20Occurrences` (`e20.server.ts:77-84`). **Nenhuma tela.**
- **Quem consulta hoje:** RLS `SELECT` com `is_portal_member()` — **qualquer colaborador do portal**, nas duas tabelas E20.
- **Sim, o RLS atual permite acesso a qualquer membro do portal.**
- **Criar a área com o existente: sim** — rota `/f/executivo/apresentacoes` + `requiresRole: ["super_admin"]`, sem tabela nova.
- **Camada de autorização definitiva: o banco.** `requiresRole` esconde o menu; só uma política RLS restritiva (ou uma função `SECURITY DEFINER` que valide `has_role(auth.uid(),'admin')`) impede leitura por URL direta.

## 20. Remarketing — tamanho da interface

- **Compartilhamento:** o Remarketing tem shell e rotas próprios (`src/routes/f.remarketing.tsx` + `src/routes/f.remarketing.index.tsx`), montados como ambiente standalone (aberto em nova aba por `src/components/executive/executive-shell.tsx:142`). A **interface de conversa** foi unificada visualmente com o CRM — é aí que mora o risco.
- **Alteração só no shell: sim**, desde que se altere o cabeçalho/paddings de `f.remarketing.tsx` / `f.remarketing.index.tsx`.
- **Componente perigoso se alterado globalmente:** os componentes de conversa compartilhados com o CRM (`src/components/crm/crm-conversation.tsx` e o board em modo `standalone` de `portal-leads-board.tsx`, que já tem tratamento próprio de altura `h-[100dvh]`). Mexer neles muda o CRM.
- **Arquivo correto para alteração localizada:** `src/routes/f.remarketing.index.tsx` (título e container), preservando os botões de alternância Campanhas/Conversas.

## 21. Biblioteca — fonte oficial

- **Alimentação:** **banco** — `relationship_message_library`, 21 linhas, uma versão ativa por etapa. `src/lib/relationship/messages.ts` é um conjunto paralelo de textos em código.
- **O Word nunca foi importado integralmente.** A evidência é direta: `PENDING_TEXT_STEPS = ["E20","E27","FINALIZACAO"]` são slots vazios declarados em código, e as etapas presentes espelham `LIBRARY_STEP_ORDER`, não um documento.
- **Fonte de verdade atual:** `relationship_message_library` para o motor; `messages.ts` é sombra e deveria ser aposentada.
- **Risco de apagar histórico:** **baixo por desenho** — a edição cria **nova versão** (versionamento imutável), nunca sobrescreve.
- **Preservação de mensagens enviadas:** `recordMessageSnapshot` congela template, versão e texto renderizado em `relationship_message_sends`. Alterar a Biblioteca não reescreve nada já enviado.

## 22. Etapas multiconteúdo

- **Precisa de vários ativos? Não hoje.** A tabela está **vazia (0 bindings)** — nem o caso simples está em uso.
- **Mecanismo de rodízio/ordem/aleatoriedade: não existe.**
- **Regra mais segura:** **um único conteúdo ativo por etapa**, com histórico versionado. Rodízio/aleatoriedade torna a mensagem imprevisível, quebra a reprodução de um caso e conflita com o snapshot.
- **Recomendação:** manter um ativo por etapa. Se um dia houver variação, que seja explícita (A/B declarado com registro do braço no snapshot), nunca implícita.

## 23. Templates Meta

- **`crm_meta_templates` está vazia (0 linhas).** Confirmado.
- **E0 é o único disparo automático previsto** — confirmado pelo código: `E0_SIMULATION_ENABLED` governa a entrada em `src/server/crm/lead-intake.server.ts:160`; nenhuma outra etapa dispara sozinha.
- **Mensagens livres x template:** E0 é primeiro contato (janela fechada → **exige template Meta**). E1, E3, E4, R*, RE*, RF*, E20 são executadas manualmente pelo executivo dentro de janela aberta → **mensagem livre**.
- **Segundo motor capaz de disparar a mesma mensagem:** o Remarketing possui motor próprio (`src/server/remarketing/engine.server.ts`), mas opera em tabelas isoladas (`remarketing_*`) e não emite etapas E*. Não há sobreposição hoje.
- **Trava:** `src/lib/crm/e0-simulation.ts` (`E0_SIMULATION_ENABLED`, `E0_SIMULATION_LABEL`), consumida por `lead-intake.server.ts`, `first-contact-queue.server.ts`, `portal-first-contact.server.ts`, `engine.server.ts:13,28` e `journey.server.ts:15`.
- **Condição para produção:** template E0 aprovado e cadastrado em `crm_meta_templates`, credenciais Meta válidas no ambiente de produção e `E0_SIMULATION_ENABLED = false` — o comentário em `engine.server.ts:28` registra que desligar a trava devolve a exigência do template.

## 24. E0 simulada × real

- **Diferenciação:** o campo `simulated: E0_SIMULATION_ENABLED` é gravado no registro do primeiro contato (`portal-first-contact.server.ts:72`, `first-contact-queue.server.ts:90`) e o `E0_SIMULATION_LABEL` acompanha o evento.
- **Onde aparece:** no banco (registro do envio) e na Jornada, que importa o rótulo (`journey.server.ts:15`). O CRM não o destaca visualmente de forma inequívoca.
- **Contaminação de métricas/atividade/Jornada:** o risco de contaminar **atividade do investidor é nulo** (E0 é ação de saída, não entra na lista branca). O risco em **métricas de envio** é real se algum contador somar envios sem filtrar `simulated`.
- **Ponto de confusão possível:** a Jornada exibe a etapa com rótulo, mas se o rótulo não for visualmente distinto na ficha, o executivo pode acreditar que o investidor recebeu a mensagem. É o ponto a endurecer antes de escalar E0.

## 25. Mensagens E1–E4 no Portal dos Leads

- **Componente que renderiza por etapa:** no servidor sim (`renderFromLibrary`); na UI, apenas o CRM exibe conteúdo de conversa. **Não existe** um renderizador de "mensagem da etapa" no Portal dos Leads.
- **Interpolação de nome:** sim, pronta (`src/lib/relationship/names.ts` + variáveis da Biblioteca).
- **Vínculo etapa → conteúdo multimídia:** a estrutura existe (`relationship_step_content_bindings`, `relationship_contents`, `buttonKind: "portal" | "content"`), mas está **vazia** — nenhum vínculo cadastrado.
- **Por que o Portal dos Leads não usa:** o overlay só conhece `crm_cadence_tasks` de canal `call`; a fila oficial de mensagens nunca foi ligada àquela tela.
- **Menor caminho técnico:** o agregador do item 2 devolve, para cada ação de mensagem, `step` + texto já renderizado por `renderFromLibrary`; a UI exibe em modo leitura com um botão "Copiar" ligado a `copyToClipboard` (`src/lib/clipboard.ts`). Sem seletor de mensagem — a etapa decide.

## 26. "Ver ficha completa"

- **Rota da ficha completa: NÃO EXISTE.** `/f/executivo/investidores` (`src/routes/f.executivo.investidores.tsx`) é uma lista sem `validateSearch` e sem parâmetro de lead; não há `f.executivo.investidores.$id.tsx`.
- **URL determinística por `lead_id`: não existe.**
- **Origem influencia a rota:** não hoje. A carteira/canal é filtro de listagem (`workspaceScopesFor`), não segmento de URL.
- **Abrir sem alterar contexto de carteira:** sim, é viável — a ficha é resolvida por `leadId`; o escopo entraria só como parâmetro informativo (`search.origem`).
- **Por que volta ao Portal dos Leads:** porque o handler não navega. `onOpenLead` em `portal-leads-board.tsx:620-623` apenas executa `setCallsOpen(false)` e `setSelectedId(leadId)` — fecha o overlay e seleciona o card no board. A ficha nunca é aberta.

## 27. Ação do Dia + Agenda

- **Classificação de prioridade: sim** — `AgendaPriority = "maxima" | "media" | "minima"` (`src/lib/agenda-types.ts:8`).
- **Campos de horário:** `startsAt`, `endsAt` (`:23-24`) e `priority` (`:27`), além de `kind = "compromisso" | "reuniao" | "acao"` (`:16`) — o discriminante de tipo já existe.
- **Consumir `portal_meetings` diretamente:** possível, mas **não é a fonte recomendada**. A fonte com prioridade, constraint anti-sobreposição (`EXCLUDE` + `btree_gist`) e função de leitura pronta é `workspace_agenda_events`. `portal_meetings` é reunião agendada com o investidor e hoje **não** participa da constraint de conflito — usar as duas exige regra de precedência explícita.
- **Risco de copiar reuniões para outra tabela: alto e desnecessário.** Cópia gera duas conclusões independentes para o mesmo compromisso e duplica o histórico.
- **Forma mais segura:** ler `workspace_agenda_events` no agregador, sem escrita, com `action_key = agenda:${eventId}`.

## 28. Ordenação

- **Score/orderBy hoje:** existe apenas o básico — `agenda_cadence_tasks` ordena por `due_date, step_day`; o overlay separa `overdue` de hoje. Não há score composto.
- **Regra segura:** ordenar por tupla determinística `(bloco, horário, criação)`:
  1. `bloco 0` — agenda `priority = 'maxima'` com `startsAt` dentro de uma janela (ex.: −15min a `endsAt`);
  2. `bloco 1` — ações atrasadas (`dueDate < hoje`);
  3. `bloco 2` — ações de hoje;
  4. `bloco 3` — futuras.
  Dentro do bloco: horário crescente; sem horário, vencimento mais antigo; empate final pelo `action_key` (estabilidade).
- **Impedir que mensagem futura ultrapasse reunião chegando:** o bloco é calculado **antes** do horário. Uma mensagem futura nunca sai do bloco 3, independentemente do horário. Requer relógio em America/São_Paulo — o mesmo tratamento já usado em `src/lib/crm/e0-window.ts`.

## 29. Estado da ação

- **Concluir tarefa hoje:** `completeCadenceTaskFn` altera apenas a tarefa em `crm_cadence_tasks`. **Não** toca `viewed_at`, `status` do lead nem `lastActivity`.
- **Evento administrativo interpretado como atividade:** não no servidor. O resíduo é local: `markLeadViewed` (`src/lib/lead-state.ts:122-136`) emite `lead.status.changed` ao abrir um card nunca visto e a heurística `evaluateInvestorMovement` (`src/lib/workspace-alerts.ts:142-172`) opera sobre o `localStorage`.
- **Garantia contra volta a NOVO:** a lista branca `src/lib/events/investor-activity.ts`, aplicada em `src/lib/executive-data.ts:6,121` ao compor `lastActivity`. Ações do executivo não estão nela.
- **Quando a Ação do Dia deve emitir evento de jornada:** somente em fatos relacionais — mensagem efetivamente enviada, ligação realizada com desfecho, reunião concluída. Nunca ao abrir, ordenar ou visualizar a lista.

## 30. Histórico da Jornada — estado atual

- **Emissores ainda capazes de gerar `lead.status.changed`:** exatamente quatro — `markLeadViewed` (`lead-state.ts:129`), `closeLead` (`:148`), `reopenLead` (`:165`) e `src/components/shared/executive-contact-dialog.tsx:82`. Todos com `dedupeKey` e guarda de mudança real.
- **Outro caminho que chame essas funções:** não há chamadas fora do Workspace/CRM; nenhum cron ou sincronização as invoca.
- **`investor.reactivated` na Jornada:** **não deveria aparecer** e, pela whitelist do servidor (`RELATIONAL_TIMELINE_EVENTS`, `journey.server.ts:88-95`), não aparece na Jornada oficial. Só surge se a tela consumir o barramento local.
- **Regra que impede contaminação:** a lista branca em `executive-data.ts` + o colapso de eventos consecutivos em `src/lib/investor-profile.ts:86-103`.
- **Risco residual:** **sim, dois.** (a) Entradas antigas no `localStorage`, anteriores às guardas, continuam sendo exibidas — só o colapso visual as suaviza. (b) Abrir vários cards nunca vistos em sequência gera vários `lead.status.changed` legítimos em segundos; o `dedupeKey` é por lead e não os agrupa.

## 31. Reativação

- **Influência além do alerta:** hoje **nenhuma** no servidor. Não altera coluna, não muda estágio, não entra na Jornada oficial.
- **Pode recriar ciclo de NOVO:** **não**, desde que `investor.reactivated` permaneça fora da lista branca de `investor-activity.ts` — que é o estado atual.
- **Persistido no banco: não.** É exclusivamente `localStorage` (`src/lib/workspace-alerts.ts`).
- **Quando virar estado de negócio:** só se a reativação passar a disparar cadência (RE0–RE3) automaticamente. Aí precisaria de coluna e evento no servidor.
- **Confirmado:** por ora deve **permanecer somente como alerta visual**.

## 32. Notas do executivo

- **Reaproveitável:** sim. `portal_leads.notes` já é gravável com autorização correta via `set_lead_operational` (SECURITY DEFINER, lista fechada de colunas) e `updateWorkspaceOperational`.
- **Onde estão hoje:** notas de ligação em `crm_cadence_tasks.note` (por ocorrência); observações do executivo em **localStorage** (`src/lib/investor-comments.ts`); `portal_leads.notes` está **vazio**.
- **Snapshot suficiente para alimentar nota:** sim — `relationship_message_sends` guarda etapa, versão e texto renderizado; basta referenciar o `send_id`.
- **Recomendação:** **criar `lead_notes`** (id, lead_id, author, kind: `ligacao|mensagem|livre`, body, ref_id, created_at) e **preservar `portal_leads.notes`** como resumo livre atual, sem migração destrutiva. Nota por ocorrência não cabe em campo texto único — concatenar em `notes` destrói autoria e cronologia. Sem `lead_notes`, as observações continuam presas ao navegador de um executivo.

## 33. Backup — não reabrir

- **Nenhuma das mudanças previstas exige alteração no motor de backup.** Ação do Dia, Biblioteca, CRM e Apresentação Digital são leitura/UI sobre tabelas já cobertas.
- **Risco de nova migration afetar a rotina: existe e é gerenciável.** `BACKUP_TABLES` em `src/server/backup.server.ts` é uma lista explícita: uma tabela nova (ex.: `lead_notes`) **não entra sozinha** no backup. Não quebra a rotina — apenas fica de fora.
- **Veredito:** **NÃO ALTERAR o motor.** Única providência quando surgir tabela nova: acrescentá-la a `BACKUP_TABLES`.

## 34. Pendências de identidade

- **UI + backend.** A tela `src/routes/f.executivo.identidade.tsx` e `src/lib/portal-identity.functions.ts` são leitura; os dados são gravados por `resolve_portal_identity` (SECURITY DEFINER) nas colunas `identity_conflict` e `identity_alternates` de `portal_leads`, com advisory locks por telefone/e-mail.
- **Dados que precisam continuar:** `identity_key` (índice único de deduplicação), `identity_alternates` e `identity_conflict`. São o núcleo da identidade única.
- **Seguro remover só a exposição: sim** — retirar a rota e o item do `executive-shell.tsx` não afeta deduplicação. **Ressalva:** conflitos de identidade cruzada continuarão sendo gravados sem observador humano; convém prever onde eles reaparecem (ex.: aviso na ficha do lead).

## 35. Vídeo pós-apresentação no perfil

- **Exibição:** campo `postPresentationVideoUrl` do `ExecutiveUser`, editável na área de perfil/usuários do Workspace.
- **Persistência:** **seed/código** (`src/lib/executive-auth.ts`) — **não existe coluna no banco** (`executive_profiles` só tem name/email/executive_id/whatsapp).
- **Dependência:** somente `src/lib/crm/post-presentation.ts` (ação manual pós-apresentação), que monta `{{link_video_pos_apresentacao}}` e **bloqueia a mensagem quando o vídeo do próprio executivo está ausente** (regra explícita: nunca fallback para outro executivo).
- **Remover da interface quebra alguma etapa do motor:** **não** — nenhuma etapa E*/R* depende dele.
- **Dependência real:** a mensagem de pós-apresentação passa a nascer sem o bloco de vídeo (ou permanece bloqueada, conforme a guarda atual). É preciso decidir se, sem o campo, o link entra manualmente na hora do envio.

## 36. Fonte única de verdade

| Item | Fonte atual | Concorrência |
| --- | --- | --- |
| a) Identidade do lead | `portal_leads.id` (ID GreenSales) + `resolve_portal_identity` | Única. OK |
| b) Status operacional | `portal_leads` (`viewed_at`, `closed_at`, `commercial_state`) via `set_lead_operational` | **Concorre** com `resolveLeadState` no cliente, que deriva estado do `localStorage` |
| c) Atividade real do investidor | `portal_engagement` + `portal_journey_events`; whitelist em `investor-activity.ts` | **Concorre** com o barramento local (`bus.ts`) |
| d) Mensagens do motor | `relationship_message_library` (versionada) | **Concorre** com `src/lib/relationship/messages.ts`, `crm/templates.ts` e `post-presentation.ts` |
| e) Conteúdo multimídia | `relationship_contents` + `relationship_step_content_bindings` | Única — porém **vazia** |
| f) Perfil do executivo | Dividido: banco (`executive_profiles`) e seed (`executive-auth.ts`) | **Concorrência clara** |
| g) Agenda | `workspace_agenda_events` | **Concorre** com `portal_meetings` (reuniões) e `crm_cadence_tasks` |
| h) Apresentação digital | `relationship_e20_occurrences` | Única. OK |
| i) Presença / último acesso | `portal_engagement.last_access_at` + `portal_leads.last_activity_at` | Dois campos, mesma semântica — risco de divergência |
| j) Origem / carteira | `portal_leads` (canal, `scope`, executivo responsável) | **Concorre** com `operationalOwnerId`, que existe no código e **não existe como coluna** |

## 37. Risco de regressão

- **GreenSales — BAIXO.** Nada da próxima etapa toca a sincronização.
- **Redistribuição — MÉDIO.** `operationalOwnerId` sem coluna correspondente; qualquer mudança de identificação de dono na ficha pode divergir do banco.
- **Portal — MÉDIO.** O heartbeat de presença roda no Portal do investidor; escopo errado reintroduz o problema do "NOVO".
- **TikTok / Meta (canais) — BAIXO.** Roteamento de canal não é tocado.
- **Meta (templates/envio) — MÉDIO.** Remover a Central de Templates com `crm_meta_templates` vazia é inócuo hoje, mas fecha o caminho de ativação real do E0.
- **Agenda — ALTO.** É onde a duplicação nasce: sem `action_key` e sem precedência entre `workspace_agenda_events` e `portal_meetings`, o mesmo compromisso aparece e é concluído duas vezes.
- **CRM — MÉDIO.** Ficha por rota e mensagem por etapa mudam componentes centrais; layout de conversa é compartilhado com o Remarketing.
- **Remarketing — MÉDIO.** Ajuste de layout que desça para os componentes compartilhados altera o CRM.
- **Manual — BAIXO.** Texto e flag isolados, sem banco.
- **Biblioteca — ALTO.** Importar o Word sobre 21 etapas existentes, com `relationship_step_content_bindings` vazia e `messages.ts` ainda ativa, pode fazer o motor renderizar de uma fonte e a tela de outra.
- **Backup — BAIXO.** Não alterar; apenas registrar tabelas novas em `BACKUP_TABLES`.

## 38. Matriz de dependências

| ITEM | JÁ PRONTO | PARCIAL | NÃO EXISTE | BLOQUEIO | PRÓXIMO PASSO |
| --- | --- | --- | --- | --- | --- |
| Ação do Dia | | Ligações (`crm_cadence_tasks`) | Agregador multi-fonte | `action_key` ausente | Definir chave e criar agregador de leitura |
| Agenda na Ação do Dia | Prioridade/horário em `agenda-types` | | Integração | Precedência `workspace_agenda_events` x `portal_meetings` | Ler só a agenda oficial, sem cópia |
| E1–E4 manual | Fila (26 itens) e render no servidor | | UI de mensagem no Portal dos Leads | — | Expor texto renderizado + Copiar |
| E6 / Apresentação Digital | Backend E20 completo | | Botão, painel, texto oficial | Texto E20 pendente | Cadastrar texto e ligar `emitirE20` à ficha |
| Perfil do executivo | `name/email/whatsapp` no banco | | `slug/cargo/foto/vídeo` no banco | Duas fontes | Migrar seed → `executive_profiles` |
| Biblioteca de mensagens | 21 etapas versionadas | Bindings vazios; `messages.ts` paralela | E2/E5/E6/E7/R0 | Word não importado | Importar Word e aposentar `messages.ts` |
| Presença do investidor | `last_access_at` por evento | | Heartbeat e "online" | — | Ping 60s + leitura de 15 min |
| Ficha pelo Portal dos Leads | Componentes de ficha | | Rota por `leadId` | — | Criar rota e trocar `onOpenLead` |
| Portal institucional | | | Home do Grupo | `/` é o Portal Financeiro | Mover Portal para `f.index` |
| /f Financeira | Árvore `/f/*` operacional | Stubs redirecionam para `/` | | — | Resolver slug em `/f` |
| /sol ou /s Solar | `s.$slug` existe | | Conteúdo | Nomenclatura indefinida | Fixar `s` ou criar alias `/sol` |
| /seg Seguros | `seg.$slug` existe | | Conteúdo | — | Publicar quando houver conteúdo |
| Princípios Velox | Conteúdo em banco; cards não clicáveis | | Hover e refino visual | — | Remover `<figure>` e estilizar cards |
| Manual capítulo 3 | Texto e timeline isolados | | Nova etapa histórica | — | Inserir item na timeline e ajustar texto |
| Vídeo capítulo 7 | | | | — | Remover `hasVideo` de `journey-data.ts:146` |
| Pendências de Identidade | Lógica de identidade sólida | | | — | Remover só a UI |
| Vídeo pós-apresentação | | Campo em seed | Coluna no banco | Guarda bloqueia mensagem sem vídeo | Decidir link manual no envio |
| Backup | Completo e validado | | | — | **NÃO ALTERAR**; só registrar tabelas novas |

## 39. Ordem técnica recomendada

1. **`action_key` + agregador de leitura da Ação do Dia.** Tudo mais depende de existir um vocabulário único de ação. Feito depois, obriga a refazer a tela.
2. **Agenda dentro do agregador**, lendo `workspace_agenda_events`, sem cópia. É o maior risco de regressão e deve ser resolvido enquanto a superfície é pequena.
3. **Rota canônica da ficha do lead** e correção do "Ver ficha completa". Alteração isolada, ganho imediato, zero migration.
4. **Importação do Word na Biblioteca** e aposentadoria de `messages.ts`. Precisa vir antes de qualquer UI que exiba mensagem, senão a tela nasce lendo a fonte errada.
5. **E1–E4 na Ação do Dia** (texto renderizado + Copiar), reutilizando `renderFromLibrary`.
6. **Apresentação Digital na UI** (E20 interno, E6 no rótulo) e painel administrativo com RLS restritiva.
7. **Perfil do executivo migrado para o banco** — pré-requisito de personalização confiável da apresentação, mas só depois que a apresentação exista.
8. **Presença do investidor.** Isolado e reversível; deixado para depois porque toca a regra mais sensível do projeto.
9. **Manual (cap. 3, vídeo do cap. 7) e Princípios Velox.** Risco zero de regressão; podem entrar em qualquer janela.
10. **Separação `/` institucional x `/f`**, com `unitPath()` adotado antes.
11. **Remoções de legado** (Pendências de Identidade, Central de Templates, vídeo pós-apresentação) — por último, quando os substitutos estiverem em produção.

Esta ordem prioriza a fundação compartilhada antes das telas, resolve o item de risco ALTO (Agenda) cedo, reutiliza integralmente `relationship_queue`, `renderFromLibrary` e E20 sem criar motores paralelos, e concentra migrations em dois pontos apenas (perfil do executivo e, se aprovado, `lead_notes`).

## 40. Veredito

**B) AINDA EXISTE BLOQUEIO TÉCNICO** — porém os bloqueios são poucos e específicos. Bloqueiam apenas os itens listados; o restante pode ser construído já.

Bloqueios reais para uma implementação segura:

1. **Texto oficial das mensagens (Word não importado).** E20, E27 e FINALIZACAO são slots vazios e `relationship_step_content_bindings` está com **zero** linhas. Sem isso, a Apresentação Digital e as ações E1–E4 exibiriam texto de uma fonte não oficial.
2. **Etapas E2, E5, E6, E7 e R0 não existem** em código nem no banco. Qualquer UI que as pressuponha falha.
3. **Precedência entre `workspace_agenda_events` e `portal_meetings`** não definida. Sem essa decisão, a Agenda na Ação do Dia duplica compromissos.
4. **Nomenclatura da unidade Solar (`s` x `/sol`)** não fixada — bloqueia apenas a separação institucional, não os demais itens.

Não bloqueiam (podem ser construídos agora): `action_key` e agregador, rota da ficha do lead, remoção do vídeo do capítulo 7, capítulo 3 do Manual, refino visual dos Princípios, remoção da UI de Pendências de Identidade, layout do Remarketing e presença do investidor.
