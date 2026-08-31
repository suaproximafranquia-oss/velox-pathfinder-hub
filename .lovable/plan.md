# Bateria final — confluência técnica pré-construção

Somente auditoria. Nada foi alterado: código, banco, dados, vínculos, seeds, templates e regras permanecem intactos. Conclusões já encerradas em baterias anteriores aparecem aqui apenas como contexto de dependência.

Medições feitas agora (leitura): 25 mensagens ativas na Biblioteca · 24 vínculos etapa↔conteúdo · **72 E0 registradas, a última hoje 31/08 10:51 (São Paulo)** · `presentation_chapters` = **0** · `crm_meta_templates` = **0** · 7 perfis de executivo, **0 com WhatsApp** · 6 usuários marcados **inativo** no banco · `group_unit_leads` = 0.

---

## 1. Estado real dos usuários

Fonte definitiva **hoje**, por campo:

| Campo | Verdade real | Contaminação |
|---|---|---|
| existência do usuário | `SEED_USERS` (código) | não há tabela de cadastro |
| status ON/OFF | `executive_user_status` (6 inativos) | a tela sobrepõe com o seed |
| perfil/nome | `executive_profiles` | mesclado com seed na UI |
| slug | `executive_profiles`, com queda para `executiveSlugById` (código) | valor de código vence quando o cadastro está vazio |
| WhatsApp | `executive_profiles` (0 de 7 preenchidos) | edição fica em `atlas:users:v3` |
| permissões | `workspace_module_permissions` | espelho em `atlas:workspace-permissions:v1` |

Persistência do OFF: o registro sobrevive a F5, logout, novo login e outro dispositivo — **mas a interface não o mostra**, porque `loadUsers()` aplica o seed por cima. Login: `executive-auth.functions.ts` consulta `executive_user_status`, então o **login é recusado no servidor**. Sessão já aberta: `OperationalGuard` verifica apenas *existe sessão no navegador*, nunca o status; o Workspace revalida a cada 20 s, mas as demais telas de `/f/*` não. Resultado concreto: **usuário desligado durante a sessão continua navegando em `/f/*` até fechar/reabrir**, e as funções de servidor que não exigem papel continuam respondendo. O bloqueio, portanto, é real no login e apenas visual/parcial na sessão viva.

Resíduos de localStorage que contradizem o servidor: `atlas:users:v3` (perfil, slug, senha, status), `atlas:workspace-permissions:v1`, `atlas:activeRole:v1`, `atlas:manual:responsibleExecutiveSlug`.

WhatsApp do perfil: usado pelo motor **apenas como destino do botão de contato** (`resolveLeadExecutive` → `destinations.server`), nunca como remetente. Slug do perfil: usado de verdade na geração do link personalizado, com a ressalva da queda para o valor de código. Campos que a UI diz salvar e não persistem: WhatsApp, senha, status e (na prática) slug.

## 2. Ambientes e navegação

`/` Grupo · `/f` Financeira · `/s` Solar · `/seg` Seguros · `/f/executivo` Workspace · `/f/crm` · `/f/portal-leads` · `/f/executivo/investidores` e `/f/executivo/investidores/$id` · `/remarketing` · Portal do Investidor por link personalizado · Apresentação Digital por convite E20/E6.

HOME errada (já mapeado, ainda vigente): `__root.tsx:45`, `f.index.tsx:554`, `module-chrome.tsx:66`, `journey-chrome.tsx:41` levam a `/`. Fora esses quatro, cada ambiente volta à própria home.

Descoberta por navegação: `/f`, `/s` e `/seg` estão linkados a partir da Home do Grupo — são descobríveis por navegação normal, por desenho. O que exige sessão é apenas `/f/*` além da tela de acesso. Não há ambiente oculto alcançável: as rotas internas passam pelo guard; a exceção é o conjunto de **~28 rotas espelho `executivo.*`** (sem o prefixo `/f`), que existem, respondem e não estão sob `f.executivo.tsx`.

**Tela "Investidores/GS…"**: `/f/executivo/investidores` é rota **legítima e interna** — é a lista da carteira, e `/f/executivo/investidores/$id` é a ficha canônica do lead. Não é resíduo. O "Ver ficha completa" da Ação do Dia leva para `investidores/$id`, ou seja, já abre o lead direto; o que se percebe como "ambiente intermediário" é a *lista* aparecer no caminho. A ficha canônica é dependência de Ação do Dia, Workspace, CRM e agenda: **não pode ser removida**; só o ponto de entrada pode ser encurtado.

## 3. Grupo Velox / captação

Solar e Seguros: formulário `unit-interest-form` → `unit-leads.functions.ts` → `group_unit_leads`/`group_unit_lead_events` → painel `/f/executivo/unidades` (carteira do administrador). Financeira: formulário → identidade em `portal_leads` (`resolve_portal_identity`) → Portal → Workspace/CRM. Os três estão **realmente isolados**: tabelas distintas, sem gravação cruzada, sem motor comum. Não há caminho de Solar/Seguros para o CRM Financeiro nem o inverso. Origem, marca e responsável são gravados pelo formulário. Hoje `group_unit_leads` está vazia — nenhum lead de unidade foi captado ainda, então o fluxo está íntegro mas **não exercitado em produção**.

## 4. E0 — última conferência

Gatilhos reais, todos no servidor:

```text
lead-intake.server        → deferFirstContact()  (enfileira, não envia)
lead-sync.server          → processDeferredFirstContacts()   ← cron 5 min
sync-scheduler.server     → processDeferredFirstContacts()   ← cron 5 min
first-contact.server      → registerFirstContact() → dispatchFirstContact()
```

Não há gatilho fora desse caminho. Login não dispara E0. F5, abrir Workspace, polling e reconciliação **não** disparam: nenhum deles chama a fila. Nada de E0 acontece no cliente.

Por que leads "sem E0" passaram a receber depois que o usuário entrou: a fila é processada pelo cron; o que muda com a entrada do usuário é a **sincronização** trazer/atualizar o lead e a resolução de destinos passar a ter sucesso (slug resolvido). O envio continua sendo do cron — nenhum job depende de sessão.

Trava de duplicidade: chave primária determinística `msg_e0_<leadId>` em `crm_messages`; a segunda tentativa colide em `23505` e retorna "primeiro contato já registrado". É **atômica e persistida no servidor** — esse registro é o campo definitivo de "E0 já processada". Lead antigo só volta a ser elegível se essa linha não existir; como ela nunca é apagada, **não há reprocessamento em lote**. O risco de lote existiria apenas se a fila fosse repovoada em massa por importação.

Confirmado agora: **a E0 está viva** — 72 registradas, a última hoje às 10:51.

## 5. Nome / Central de Nomes

Não existe Central de Nomes. A decisão COM NOME / SEM NOME acontece em `src/lib/relationship/names.ts` (`looksLikeName` → tratamento) consumida por `renderFromLibrary`. Campo de origem: `portal_leads.name`, com queda para `crm_leads.name`. Usa-se o **primeiro nome**; nome composto ("Maria Clara") só passa inteiro quando as **duas** palavras estão na base.

Há sim heurística e lista: `src/lib/relationship/name-base.ts` é uma **lista hardcoded** de nomes brasileiros (~60 linhas); `INVALID_TOKENS` descarta "lead", "teste", "cliente" etc.; `isPlausibleName` exige 3+ caracteres. Não há biblioteca externa. O fallback existe e é o tratamento neutro **"caro investidor"** (`NEUTRAL_TREATMENT`), nunca um nome inventado.

Casos frágeis reais: "Senhor André" → a primeira palavra é "Senhor", que não está na base → cai em SEM NOME; "André Silva" → funciona; nomes fora da lista (regionais, estrangeiros) → SEM NOME indevido; "Ana Paula" só passa composto se ambas estiverem na base.

Normalização: `normalizeName` padroniza maiúsculas/minúsculas e limpa ruído; `foldName` **remove acento apenas para comparação**; `displayName` **preserva a acentuação original**. Ou seja, a regra que você descreveu — comparar sem acento, enviar a grafia do lead — **já é o comportamento atual**, e precisa ser confirmada como regra oficial. Também precisa de confirmação: usar só o primeiro nome (hoje há a exceção do composto) e, na futura Central, ausência de autorização = SEM NOME **sem fallback** (hoje o fallback é o tratamento neutro, que é diferente de "sem nome").

Pontos que consumiriam a Central: `names.ts` (`looksLikeName`, `resolveTreatment`), `message-library.server.ts` (`renderFromLibrary`), `e0.server.ts`, `step-message.server.ts`, `dispatch.server.ts`, `daily-actions.server.ts` (texto copiado) e a ficha do investidor.

## 6. Mensagens do motor — mapa real

Fonte de verdade em duas camadas, sem lista legada: **quais etapas existem** vem de `step-registry.ts` (`KNOWN_STEP_KEYS = Object.keys(STEPS) + NON_CADENCE_STEPS`), **o texto** vem de `relationship_message_library` (25 ativas, versão ativa por código). Rótulo funcional em `step-labels.ts` (E20→"E6 Apresentação Digital", E27→"E7 Checkpoint"). Vínculo etapa↔conteúdo em `relationship_step_content_bindings` (24 registros).

Etapas não pertencentes à cadência: `E20`, `E27`, `FINALIZACAO`, `RESPOSTA_AUTOMATICA`. As demais vêm de `STEPS`, com ordem, canal e janela definidas ali. `E0` é automática pela fila; as demais são decididas por `decideNextAction` e materializadas por `relationship_queue`.

Divergências ainda abertas: rótulos de E0/E1/R1 deslocados na base (E0_V1 rotulado como E1); RE1–RE3 com texto de espaço reservado; E0 v4 com nome próprio escrito no corpo. Nenhuma mensagem real está fora da Biblioteca; há mensagens na Biblioteca sem etapa correspondente no motor (marcadas "(legado)" na tela). Chaves duplicadas não existem; aliases visuais sim.

Textos vivos fora da Biblioteca: `CRM_TEMPLATES`/`CRM_FIRST_CONTACT` (`src/lib/crm/templates.ts`) continuam existindo e **podem chegar ao cliente pelo envio manual** do CRM (Primeiro Contato manual e as três aberturas) — o motor automático não os usa mais. `word-library.ts` é referência de mapeamento, não sai para o cliente. Fora de `renderFromLibrary` não há fallback textual no motor: etapa sem conteúdo ativo **não envia** e registra motivo. **SEM VÍNCULO continua sem vínculo** — não há sorteio nem substituição. O motor só lê a versão ativa; versão antiga só reaparece em snapshot histórico, nunca em envio novo.

## 7. Link personalizado

Resolução única em `destinations.server.ts` → `resolveLeadDestinations`:

```text
portal_leads.responsible_executive_id
  → executive_profiles (slug oficial)
  → portal_leads.responsible_executive_slug (atalho)
  → executiveSlugById()  ← valor hardcoded, último recurso
  → investorPortalUrl(slug) = link personalizado final
```

Quem determina é o **executivo responsável pelo lead**, não a origem nem o workspace. Thiago, Larissa e os demais têm links distintos porque o slug é por executivo. O proprietário é identificado com segurança pelo `responsible_executive_id`. Em redistribuição, mensagens **novas** passam a usar o link do novo responsável; o link antigo continua funcionando (é uma URL pública do Portal) e as mensagens já enviadas mantêm o snapshot congelado. Deduplicação de identidade existe: `resolve_portal_identity` por telefone e e-mail, com registro de conflito. O texto literal "link personalizado" não chega ao cliente: sem link resolvido a E0 é **bloqueada**, não enviada com marcador. Campos envolvidos: `responsible_executive_id`, `responsible_executive_slug`, `executive_profiles.executive_id/slug`, o mapa de slugs em código e `investorPortalUrl`.

## 8. WhatsApp / Meta

O envio automático da E0 sai **sempre pelo número institucional da Meta** (`WHATSAPP_PHONE_NUMBER_ID`), único e compartilhado. O WhatsApp individual do executivo é **exclusivamente destino do botão de contato**. Ele **não impede a criação da E0** — `resolveLeadDestinations` é chamado com `contactRequired: false`. Existe, porém, um ponto que faz a **entrega externa** depender dele: em `e0.server.ts`, quando o template aprovado traz botão de contato e não há número, a entrega fica pendente. É o comportamento decidido, não um erro — mas hoje **0 de 7 executivos têm WhatsApp**, então esse caminho pendurará toda entrega assim que o template existir.

A resposta automática usa o mesmo número institucional. Template necessário para E0: registro em `crm_meta_templates` com `purpose` de primeiro contato, aprovado, com os botões de portal e contato — **a tabela está vazia**, então toda E0 é registrada e a entrega externa fica pendente com motivo legível. O sistema distingue apenas tentativa/registro e falha; **não há timestamp de aceite, entrega ou leitura**, o `wamid` é descartado e o array `statuses` do webhook não é consumido. A interface considera "enviado" o momento do **registro** da mensagem.

## 9. Horário e cadência

| Momento | Existe? | Onde |
|---|---|---|
| decisão | sim | `relationship_queue.scheduled_for` |
| tentativa | sim | `crm_messages.at` / `relationship_message_sends.sent_at` |
| aceite do provedor | **não** | só em memória durante a chamada |
| entrega | **não** | — |
| leitura | **não** | — |
| falha | sim | campo de erro do envio + `relationship_engine_log` |

A cadência é integralmente do servidor: cron de 5 min, `decideNextAction`, `relationship_queue`. Nenhuma etapa depende de usuário online ou de F5 — o que depende de F5 é apenas a *visualização* de telas que leem cache local. Duplicidade após reinício de job é impedida por chave determinística por lead+etapa+instância; a idempotência é por chave única no banco, não por transação longa. O estado sobrevive a troca de dispositivo e sessão.

## 10. GreenSales

Entrada por `runLeadSync` (cron 5 min): login, `lead/list` paginado, espelho em `crm_leads`, card em `portal_leads` com id `gs_<external_id>`. Identidade única por `external_id` + telefone normalizado. Monitorados: `stage_key`, status e etiquetas trazidos pela listagem; detalhe consultado para no máximo 80 leads por ciclo. **A reconciliação continua limitada à coluna "novos"** — `reconcile.server.ts` filtra `stage_key = 'novos'` antes de marcar como não localizado. Consequência: lead que muda de coluna e some da origem em outra coluna **não é reconciliado**; ele não desaparece do banco (nada é apagado), mas fica com coluna desatualizada. Só polling, sem webhook. Duplicação é improvável pela chave estável; desaparecimento por exclusão é impossível (blindagem por gatilho). O que explica "lead aparecer depois e disparar E0" é a combinação normal: o ciclo do cron traz o lead, a fila enfileira, o ciclo seguinte processa. Ownership em `portal_leads.responsible_executive_id` é a fonte oficial; `crm/distribution.ts` permanece no código e grava em localStorage, **sem participar da decisão do motor**.

## 11. Ação do Dia / ficha

`daily-actions.ts` só lê e ordena quatro fontes já existentes (`portal_meetings`, `workspace_agenda_events`, `relationship_queue`, `crm_cadence_tasks`), com chave determinística e precedência AGENDA > REUNIÃO > MENSAGEM > LIGAÇÃO. Ligação vem de `crm_cadence_tasks`; mensagem vem de `relationship_queue`, e o texto exibido é o mesmo da Biblioteca consumida pelo motor, com o mesmo tratamento COM/SEM NOME — o botão copiar entrega exatamente a versão que o motor produziria. A Ação do Dia **não sugere E0** (E0 é da fila, não da visão) e **não dispara nada automaticamente**. "Ver ficha completa" abre `/f/executivo/investidores/$id` preservando a carteira/escopo.

## 12. Biblioteca

Ela reflete o **registro vivo do código**, não uma lista paralela: a tela percorre `KNOWN_STEP_KEYS`, derivado de `STEPS` + `NON_CADENCE_STEPS`. Uma etapa nova criada em `STEPS` aparece sozinha; uma etapa nova criada **só no banco** não aparece. Não há lista hardcoded na tela que impeça isso. `CONTENT_GROUPS` ainda é lido — em `homologation.server.ts` e `relationship-homologation.functions.ts` (validação da homologação), **não** como fonte de conteúdo do motor. Aliases visuais (E2/E5/E6/E7 sobre chaves técnicas) seguem ativos e são deliberados.

Operações disponíveis hoje: adicionar vínculo, remover vínculo, deixar sem vínculo, desativar. Conteúdo sem vínculo é inutilizável pelo motor — confirmado. Exclusão física é protegida por dependência de histórico. Vínculos legados existem, aparecem marcados "(legado)" e **podem ser preservados sem migração**. A visão inversa "este conteúdo está vinculado a…" existe e cobre as etapas reais. Trocar rótulo não quebra chave técnica (rótulo e chave são camadas separadas). O versionamento preserva o conteúdo efetivamente usado via snapshot em `relationship_message_sends`.

## 13. Remarketing

Independente: tabelas próprias, cron próprio, motor próprio; o webhook decide por número antes de gravar. Campanha de remarketing **não dispara E0** e **não altera cadência** do CRM. Templates são compartilhados em **infraestrutura** (mesma tabela, mesmo número Meta), não em função. O contato temporário guarda telefone normalizado — suficiente para localizar o lead original; quando localizado, o evento é registrado nas tabelas de remarketing e aparece na Jornada como origem "remarketing", sem misturar históricos. Não há caminho de remarketing que altere ownership nem que crie lead em `portal_leads`. Risco residual único: tudo depende de `isRemarketingPhone` classificar certo.

## 14. Backup

Geração (hora cheia) está versionada; **o processador não está em nenhuma migração**, embora comprovadamente rode (96/96 concluídas). Processamento automático: sim. Retenção: **UTC, não America/Sao_Paulo** — o "último do dia" acaba sendo o das 20:00 locais, e o corte só começa após 48 h, então no dia corrente há snapshots horários e na virada da meia-noite local nada acontece. Sobrevivem **7 dias** de snapshots diários; acima disso o ponto automático é removido junto com o blob órfão. Não há risco de apagar o último backup antes do prazo: manuais e protegidos ficam fora da varredura. O backup **inclui** perfis, mensagens e leads, mas **não inclui** Biblioteca, snapshots, vínculos, permissões, unidades do grupo e remarketing. Tudo que hoje vive só em localStorage (item 18) está fora do backup por construção.

## 15. Apresentação Digital / conteúdos

`presentation_chapters` está **vazia (0 registros)** — a Apresentação abre sem conteúdo. O uso de `session!` no primeiro render segue no código e continua podendo quebrar a tela administrativa antes da sessão existir. Edição de capítulos existe (rascunho/publicado), mas sem nenhum capítulo cadastrado não há o que publicar. Não há dependência técnica entre Apresentação Digital e Manual — são conteúdos separados. O vídeo pós-apresentação continua em localStorage.

## 16. Manual / material / imagens

Estrutura de vídeo (`VideoSlot`) continua presente nos capítulos do Manual, inclusive 1, 7 e 14. Se o requisito atual é remover o vídeo do Manual, **isso ainda não foi feito e precisa da sua confirmação explícita**. Manual e Material seguem conceitos separados no código. Upload/substituição de imagens em cards e áreas institucionais **não existe** hoje: as imagens vêm do registro de assets (`src/lib/assets/registry.ts`) com `assetUrl(key)` e `VITE_ASSET_BASE_URL` — arquitetura já compatível com hospedagem externa (KingHost), mas sem tela de upload e sem persistência de arquivo no servidor. Princípios Velox renderiza 3 cards (Missão, Visão, Valores); restam `aria-label` e documentação citando 6.

## 17. Módulos residuais

Unidades do Grupo: dependência real (é a carteira Solar/Seguros) — **manter**. Homologação do Motor: `homologation.server.ts` contém lógica de Biblioteca usada em produção — **não remover a lógica**, só a tela é discutível. Telas de teste existentes: `laboratorio`, `teste-cadencia` (e espelhos sem `/f`). Seeds que alimentam produção: `SEED_USERS` (crítico) e o mapa de slugs em código. Dados fictícios visíveis: nenhum lead fictício em produção; lotes `is_test`/`test_batches` seguem existindo. Endpoints de teste acessíveis: as 4 rotas `/api/public/*` autorizadas pela chave publicável já exposta. Código legado ainda executado sem aparecer na interface: `crm/distribution.ts` e as ~28 rotas espelho `executivo.*`.

## 18. Persistência e sincronização

Dependentes de localStorage hoje: cadastro/edição de usuários, papel ativo, permissões (espelho), configurações da plataforma, recursos/materiais, base de conhecimento, KPIs, alertas do Workspace, timeline local do CRM, distribuição, leads privados, lidos, concessão de acesso a backup, log de auditoria, cursor de redistribuição, captação, agenda local e preferências, vídeo pós-apresentação, históricos do simulador e rascunhos criativos.

Deveriam estar no servidor: usuários, papel, configurações da plataforma, recursos, conhecimento, KPIs, alertas, timeline/distribuição/leads privados do CRM, concessão de backup, auditoria, redistribuição, captação e vídeo pós-apresentação.

Dois usuários **podem** ver versões diferentes da mesma informação — é a consequência direta do acima (o caso mais grave é status e permissões). Cache que mostra dado velho após mudança administrativa: `atlas:users:v3` e o espelho de permissões. O servidor é fonte de verdade real para **ownership** e **conteúdo do motor**; é fonte de verdade *nominal* mas sobreposta na tela para **permissões** e **status**.

## 19. Segurança

Senhas em texto puro no bundle (`executive-auth.ts`) — sim, ainda. Secrets do provedor (Meta, GreenSales, service role) **não** estão no cliente. Endpoints administrativos sem validação server-side: as 4 rotas `/api/public/*` autorizadas por chave pública. Dado sensível desnecessário no navegador: senhas, concessão de acesso a backup, log de auditoria. Operação crítica que depende só da interface: bloqueio de usuário em sessão viva e permissão de módulo. Acesso a dados de outro workspace: não há `tenant_id`; o isolamento é por tabela e por carteira (`can_access_investor`), e membros do portal leem tudo em remarketing. Permissão burlável via localStorage: sim, no que é apenas visual. Alteração administrativa por usuário não autorizado: possível nas superfícies cuja checagem é só de UI.

## 20. Confluência final

### 🔴 CRÍTICO

| # | arquivo → função | estado atual | problema | desejado | dependências | risco |
|---|---|---|---|---|---|---|
| 1 | `executive-auth.ts` → `loadUsers`/`SEED_USERS` | seed sobrepõe o banco | status, slug, WhatsApp e senha falsos na tela | cadastro no servidor; seed só para primeira carga | precede 2, 3 e 8 | alto: toca login de todos |
| 2 | `operational-guard.tsx` → `OperationalGuard` | checa só existência de sessão | OFF continua navegando em `/f/*` | revalidar status no servidor | depende de 1 | médio: pode deslogar em massa se mal calibrado |
| 3 | Gestão de Usuários → salvar WhatsApp | grava no navegador | 0 de 7 no servidor; botão de contato sem destino | persistir em `executive_profiles` | depende de 1 | baixo |
| 4 | `crm_meta_templates` | vazia | entrega externa da E0 sempre pendente | template oficial aprovado cadastrado | independente | nenhum (é cadastro) |
| 5 | `presentation_chapters` | 0 capítulos | Apresentação Digital sem conteúdo | capítulos cadastrados/publicados | independente | nenhum |
| 6 | `whatsapp.server.ts` + webhook | `wamid` descartado, `statuses` ignorado, sem assinatura | entrega/leitura inexistentes; payload forjado aceito | persistir id, consumir status, validar assinatura | precede 9 | médio |
| 7 | `/api/public/*` → `authorized()` | chave publicável exposta | sync, backup e remarketing acionáveis por terceiros | segredo dedicado | destrava 12 | médio |
| 8 | `backup.server.ts` → `BACKUP_TABLES` | Biblioteca, vínculos, permissões, unidades e remarketing fora | perda irrecuperável | ampliar lista | fazer antes de mexer na Biblioteca | baixo |

### 🟠 IMPORTANTE

9. `crm_messages.at` como único carimbo → decisão/tentativa/entrega indistinguíveis (depende de 6).
10. `reconcile.server.ts` limitado a `stage_key='novos'` → mudança de coluna fora de "novos" não é reconciliada.
11. Cron do processador de backup fora das migrações + retenção em UTC → ambiente recriado nasce sem backup; "último do dia" é 20:00 local.
12. `remarketing-engine` a cada minuto sem trava de concorrência (depende de 7).
13. Dados operacionais de CRM só no navegador (timeline, distribuição, leads privados, redistribuição, auditoria, concessão de backup).
14. Redirects que ejetam para a Home do Grupo (4 arquivos).
15. `name-base.ts` como lista fechada → nomes fora da lista viram SEM NOME indevido; é exatamente a lacuna que a Central de Nomes resolve.
16. `CRM_TEMPLATES`/`CRM_FIRST_CONTACT` ainda enviáveis manualmente fora da Biblioteca.

### 🟡 REFINAMENTO

17. Rótulos deslocados na Biblioteca (E0_V1 como E1), RE1–RE3 com texto reservado, E0 v4 com nome próprio no corpo.
18. `session!` no primeiro render das telas administrativas da Apresentação.
19. ~28 rotas espelho `executivo.*`; `laboratorio`/`teste-cadencia` expostos.
20. `aria-label` e documentação de Princípios Velox ainda citando 6 itens.
21. Vídeo do Manual (capítulos 1, 7, 14) — **requer sua decisão**.
22. Upload de imagens institucionais — **não existe**; requer sua decisão.
23. Expurgo de logs, polling de 20 s, literais nas migrações de cron.

### 🟢 CORRETO — NÃO ALTERAR

Idempotência da E0 por chave determinística (comprovada: 72 registros, zero duplicidade); bloqueio por ausência de link personalizado em vez de marcador literal; WhatsApp do executivo como destino de botão e não como remetente; "sem vínculo = sem conteúdo" sem sorteio; snapshot congelado da mensagem; `KNOWN_STEP_KEYS` derivado do registro vivo; isolamento real de Solar/Seguros e de Remarketing; roteamento do webhook por número antes da gravação; blindagem por gatilho contra exclusão de Leads; trava de concorrência da sincronização; credenciais do provedor apenas no servidor; ambiente decidido antes da credencial no envio; Ação do Dia como visão de leitura, sem disparo; ficha canônica `/f/executivo/investidores/$id`.

### Decisões que dependem de você

1. Central de Nomes: confirmar "comparar sem acento, enviar a grafia do lead", "somente primeiro nome" (o composto atual é exceção — mantém ou remove?) e "não autorizado = SEM NOME **sem** fallback" — hoje o fallback é o tratamento neutro "caro investidor", que precisa ser mantido ou abolido.
2. Manual: remover a estrutura de vídeo dos capítulos, inclusive 1, 7 e 14?
3. Upload de imagens institucionais: criar agora, com armazenamento próprio compatível com hospedagem externa?
4. Tela "Investidores": manter a lista como entrada ou levar a Ação do Dia direto à ficha?
5. Envio manual do CRM: aposentar `CRM_TEMPLATES` e passar tudo pela Biblioteca?

### Conflitos entre código e conceito

- Conceito: usuário OFF perde acesso. Código: perde só no próximo login.
- Conceito: Gestão de Usuários é fonte única do WhatsApp e do slug. Código: valor de código ainda vence quando o cadastro está vazio.
- Conceito: reconciliação cobre mudanças de coluna. Código: só "novos".
- Conceito: a Biblioteca é a única origem de texto ao cliente. Código: envio manual do CRM tem texto próprio.
- Conceito: retenção diária brasileira. Código: bucket UTC.

---

## DOIS COMANDOS FINAIS

**COMANDO FINAL 1 — Identidade, acesso e verdade do servidor**
Cadastro de usuários no banco (fim do `SEED_USERS` como verdade), status ON/OFF valendo na sessão viva, WhatsApp e slug persistidos e usados sem queda para código, permissões com verdade única no servidor, migração dos dados operacionais que hoje vivem só no navegador, segredo dedicado nas rotas públicas, assinatura do webhook e ampliação das tabelas do backup. Bloco autocontido: nada aqui depende do motor.

**COMANDO FINAL 2 — Central de Nomes, mensagens e entrega**
Central de Nomes como autoridade única do COM NOME/SEM NOME (substituindo a lista fechada), consumo dela em todos os pontos mapeados, fim do texto manual fora da Biblioteca, correção de rótulos e conteúdos reservados, cadastro do template oficial da Meta, persistência do `wamid` com consumo de status (tentativa → aceite → entrega → leitura → falha), reconciliação do GreenSales além da coluna "novos" e retenção de backup em horário brasileiro. Depende do Comando 1 apenas em WhatsApp/slug do executivo.
