# Bateria 2/5 — Diagnóstico Técnico (sem implementação)

Somente leitura. Nenhum arquivo de código, migration ou dado foi alterado.

## 1. Rotas e ambientes

1.1. `src/routes/index.tsx` (`createFileRoute("/")`), dentro do layout `src/routes/__root.tsx`. Não há layout intermediário: a Home decide tudo via estado interno (`pendingModule`, gateway de identificação, overlays).

1.2. **Não são independentes.** `/` É o Portal do Investidor Financeiro. `/f` (`src/routes/f.tsx`) é apenas `<Outlet />` neutro; e os links personalizados `/f/{slug}` (`src/routes/f.$slug.tsx`) fazem `redirect({ to: "/" })` preservando `search.e`. Ou seja, hoje `/f/...` público aponta para `/`.

1.3. Menor conjunto de alterações:
   - Criar `src/routes/f.index.tsx` com o conteúdo atual de `index.tsx` (Portal Financeiro).
   - Trocar `src/routes/f.$slug.tsx` para resolver o slug localmente em vez de redirecionar para `/`.
   - Reescrever `src/routes/index.tsx` como Home institucional do Grupo.
   - Ajustar `investorPortalPath`/`investorPortalUrl` em `src/lib/portal-brands.ts` (única fonte dos links enviados) — os consumidores (`dispatch.server.ts`, `campaigns.ts`, `portal-session.ts`, dashboards) herdam automaticamente.
   - Revisar os 4 links fixos para `/`: `__root.tsx:45,83`, `index.tsx:536`, `module-chrome.tsx:66`, `journey-chrome.tsx:41`.

1.4. Sim, três pontos: (a) os stubs `e.$slug/f.$slug/s.$slug/seg.$slug` redirecionam para `/`; (b) as rotas legadas de topo (`crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`, `executivo.*`) redirecionam para `/f/...`; (c) `OperationalGuard` está nos filhos (`f.executivo.tsx`, `f.crm.tsx`, `f.remarketing.tsx`), **não** em `f.tsx` — então tornar `f.tsx` um layout com UI não afeta o guard, mas exige cuidado para o Portal público em `/f/{slug}` não cair sob guard.

1.5. Sim. `src/lib/business-unit.ts` já modela prefixos e valida slugs reservados; `s.$slug.tsx` e `seg.$slug.tsx` já existem. Adicionar `/sol` é criar o prefixo e as rotas equivalentes — sem refazer roteamento. **Conflito de nomenclatura:** hoje o prefixo Solar no código é `s`, e o pedido cita `/sol`.

1.6. Sim. `unitPath()` tem **zero uso**; existem ~153 literais `"/f/..."` em rotas, `executive-shell.tsx`, `modules.ts`, `portal-brands.ts` e nos stubs. Nenhum quebra hoje, mas todos precisam migrar para o helper antes de qualquer troca de prefixo.

1.7. **Não.** Nenhuma ocorrência de "Agilize" em `src/` nem em `supabase/`.

## 2. Apresentação Digital (E20)

2.1. **Sim, diretamente.** O backend está completo: emissão, token, TTL, resgate e registro de acesso. Falta somente a camada de UI — `emitirE20`/`listarOcorrenciasE20` (`src/lib/relationship/e20.functions.ts`) não têm nenhum consumidor `.tsx`.

2.2. Vinculado ao `lead_id` (ID do lead, herdado da GreenSales) gravado na ocorrência. Risco de investidor errado só existiria via `leadId` errado na chamada — o token em si é gerado a partir do lead. **Risco real diferente:** o link do Portal dentro da mensagem cai em `getDefaultExecutive()` quando o lead não tem executivo (`dispatch.server.ts:29,65`), o que envia o Portal de OUTRO executivo. Isso conflita com a regra do pós-apresentação ("nunca link de outro executivo").

2.3. Arquivo `src/server/relationship/e20.server.ts`, função `issueE20` (link montado em `:129-131`); tabela `relationship_e20_occurrences` (acessos em `relationship_e20_accesses`). Fachada cliente: `src/lib/relationship/e20.functions.ts`.

2.4. **Backend.** `SEVEN_DAYS_MS` (`e20.server.ts:23`) grava `expires_at` na emissão, e `redeemE20` (`:219-265`) recusa e marca `status = "expirada"` no resgate. A interface não participa da validação.

2.5. Hoje `issueE20` **encerra a ocorrência anterior e cria uma nova** (nova instância, novo token, novo prazo). Não há reutilização do link vigente.

2.6. Recomendação: **um único botão com estado**, derivado do servidor — "Gerar apresentação digital" quando não há ocorrência ativa; "Copiar apresentação digital" quando existe ocorrência válida, com o prazo restante ao lado e uma ação secundária discreta "Gerar novo link". Dois botões simultâneos convidam à regeração acidental, que invalida o link já entregue ao investidor.

2.7. Sim. `renderFromLibrary("E20", { executiveName, portalLink, rawInvestorName })` já é chamado na emissão (`e20.server.ts:167-171`) e `resolveTreatment`/`firstName` (`src/lib/relationship/names.ts`) já entregam o fallback "caro investidor" quando o nome não é confiável.

2.8. **Biblioteca de Conteúdo**, sem exceção — é a fonte oficial versionada e já é o caminho usado pelo E20. Configuração específica criaria uma segunda fonte de verdade. Hoje E20 está em `PENDING_TEXT_STEPS` (`message-library.server.ts:47`): nasce sem texto aprovado, o que confirma que o texto deve vir do Word importado.

2.9. Sim: a URL é montada no servidor a partir do token daquela ocorrência e devolvida na resposta. A UI deve copiar exatamente esse valor retornado (via `copyToClipboard`, `src/lib/clipboard.ts`) e nunca remontar a URL no cliente.

2.10. **Não existe nenhuma tela.** Os dados existem (`generated_at`, `expires_at`, `first_opened_at`, `open_count`, `status`) e `listE20Occurrences` está pronta — falta apenas exibição.

## 3. Ações do Dia

3.1. `src/components/crm/daily-calls-overlay.tsx`, aberto pelo `src/components/crm/portal-leads-board.tsx` (`:614`).

3.2. Fonte única: `listCadenceQueue({ channel: "call" })` (`src/lib/crm/cadence.functions.ts`) → tabela **`crm_cadence_tasks`** (motor legado). Já separa `overdue` de hoje (§19: atrasada não vira ligação de hoje). **Não** lê `relationship_queue` (motor oficial) nem `workspace_agenda_events`.

3.3. Sim, desde que a Agenda entre como **fonte de leitura**, não como geradora de tarefas. Hoje não há sobreposição porque a Agenda simplesmente não é lida ali.

3.4. Arquitetura recomendada: um **agregador de leitura no servidor** ("Ações do Dia") que une três leitores — `relationship_queue` (mensagens), `crm_cadence_tasks`/`agenda_cadence_tasks` (ligações) e `workspace_agenda_events` (compromissos) — normalizando tudo para um tipo único `DailyAction`. Nenhum novo motor: agregar leitura, nunca gravar tarefa nova.

3.5. Por um campo `kind` discriminado na normalização, derivado da origem: `ligacao` (task com `channel = 'call'`), `mensagem` (item da `relationship_queue`, com etapa E*/R*) e `agenda` (linha de `workspace_agenda_events`, com hora e prioridade). Hoje só existe o discriminante `channel` dentro do motor de ligações.

3.6. **Sim, obrigatoriamente**: `leadId + etapa + instância (+ origem)`. É a chave que impede que o mesmo compromisso apareça duas vezes vindo de dois leitores. Ela **não existe hoje** — é o pré-requisito de qualquer unificação.

3.7. Fila separada e persistente de "Atrasadas", sem recriar registro e sem reagendar automaticamente — mantendo a regra já existente (§19) de que atrasada nunca é contabilizada como ação de hoje.

3.8. Por bloco de prioridade e, dentro de cada bloco, por horário crescente; sem horário, por antiguidade do vencimento.

3.9. **Confirmado tecnicamente.** A ordem proposta é implementável com os dados atuais: (1) Agenda de prioridade máxima com hora próxima/em andamento — `workspace_agenda_events` já tem hora e prioridade; (2) atrasadas — a flag `overdue` já existe; (3) ações do momento; (4) futuras. Requer apenas a chave única do item 3.6 e um relógio no fuso America/São_Paulo (o mesmo já usado em `src/lib/crm/e0-window.ts`).

3.10. Sim: a subida deve ser **puramente de ordenação**, calculada a partir de `start_at` da linha existente. Nenhum registro novo — criar registro é exatamente o que gera duplicidade histórica.

3.11. Hoje a lista carrega ao abrir o overlay e a cada `load()` manual — **não é tempo real**. A reordenação por proximidade de horário exige um tick local (ex.: 30–60s) recalculando apenas a ordem, sem refazer a busca.

3.12. Risco alto e concreto: a mesma reunião apareceria como compromisso da Agenda e como tarefa de cadência, com IDs diferentes e conclusões independentes — o executivo concluiria uma e a outra continuaria pendente, contaminando contadores e histórico. É o motivo pelo qual 3.6 vem antes de tudo.

## 4. Mensagens e motor

4.1. Em três lugares distintos: (a) **`relationship_message_library`** (banco, versionada — fonte oficial, via `src/server/relationship/message-library.server.ts`); (b) **`src/lib/relationship/messages.ts`** (textos estáticos em código, inclusive o botão do E0); (c) `src/lib/crm/templates.ts` + `crm_meta_templates`/`meta_templates` (templates da Meta) e `src/lib/crm/post-presentation.ts` (mensagem manual de pós-apresentação).

4.2. **Sim — múltiplas.** É a principal dívida do bloco: biblioteca versionada, literais em `messages.ts`, templates da Meta e o template de pós-apresentação coexistem.

4.3. **`relationship_message_library`** (com `relationship_step_content_bindings` para o vínculo etapa → conteúdo). Depois da importação do Word, `messages.ts` deve virar apenas fallback de emergência — ou ser esvaziado.

4.4. Sim. `PENDING_TEXT_STEPS` em `message-library.server.ts:47` já marca etapas sem texto oficial (E20 entre elas), e o código carrega etapas de reengajamento (R0–R3) e E27 que precisam ser confrontadas com o Word. A correspondência exata só pode ser fechada com o documento em mãos: **NÃO É POSSÍVEL DETERMINAR PELO CÓDIGO ATUAL** quais etapas do Word estão ausentes.

4.5. Existem candidatos (E12 nos templates D1–D12, E27 como finalização, E20 sem texto), mas afirmar que estão "erradas" exige o Word como referência: **NÃO É POSSÍVEL DETERMINAR PELO CÓDIGO ATUAL**.

4.6. Sim, no motor: `relationship_step_content_bindings` + `renderFromLibrary(step, vars)` resolvem etapa → conteúdo → texto. O que falta é a UI de execução consumir esse caminho.

4.7. Sim: variáveis `{{nome_investidor}}`, `{{nome_executivo}}`, `{{link_portal}}` etc., com normalização de primeiro nome e fallback neutro em `src/lib/relationship/names.ts`.

4.8. **Parcialmente.** O link do Portal é resolvido pelo executivo responsável (`dispatch.server.ts:66`) — porém com o fallback para o executivo padrão citado em 2.2, que é o ponto frágil. O link do E20 é confiável (token por ocorrência).

4.9. Sim, e é o comportamento correto: a etapa determina a mensagem; o executivo não escolhe. Tecnicamente basta a ação carregar `renderFromLibrary(step)` e exibir o texto renderizado em modo leitura + copiar.

4.10. Sim. O `recordMessageSnapshot` já congela o texto renderizado separado dos metadados; a UI copia apenas o corpo final via `copyToClipboard`.

## 5. CRM e ficha do lead

5.1. `src/components/crm/daily-calls-overlay.tsx:246` — botão "Ver ficha completa", que chama a prop `onOpenLead`.

5.2. Porque `onOpenLead` (`portal-leads-board.tsx:620-623`) apenas **fecha o overlay e chama `setSelectedId(leadId)`** — é seleção de estado local dentro do board, não navegação. O executivo volta ao Portal dos Leads com o card selecionado, sem ficha aberta.

5.3. **Não existe rota canônica.** `/f/executivo/investidores` não declara `validateSearch` nem aceita parâmetro de lead; não há `f.executivo.investidores.$id.tsx`.

5.4. Não hoje, mas é viável: o escopo/carteira já está no lead (canal, `scope`, workspace) e poderia entrar como `search.origem` na rota.

5.5. **Mesmo ambiente**, com rota própria. Nova aba é justificada para módulos isolados (CRM, Remarketing); a ficha é continuidade do trabalho no Workspace e abrir aba nova perde o contexto da fila de ações.

5.6. Sim, assim que existir a rota com parâmetro — a ficha (`crm-lead-ficha.tsx` / `investor-profile-view.tsx`) já sabe renderizar a partir de um `leadId`.

5.7. **Não.**

5.8. Alteração mínima: criar `src/routes/f.executivo.investidores.$id.tsx` (ou `validateSearch` com `lead` na rota atual) que resolve o lead e monta a ficha existente; trocar o corpo de `onOpenLead` por `navigate({ to: ..., params: { id: leadId } })`.

## 6. Jornada

6.1. Porque as correções foram de **apresentação** (colapso de eventos consecutivos em `src/lib/investor-profile.ts:86-103`) e de **guarda na emissão** (`dedupeKey`, checagem de mudança real em `src/lib/lead-state.ts`), mas os registros antigos gravados antes da guarda continuam no barramento local do navegador.

6.2. **Dos dois, com peso quase todo no legado.** Legado: entradas antigas no `localStorage`. Novos: `markLeadViewed` emite ao abrir cada card nunca visto — evento legítimo, porém em lote quando o executivo abre vários cards em sequência (o `dedupeKey` é por lead e não colapsa leads diferentes).

6.3. Não. Os quatro emissores (`markLeadViewed`, `closeLead`, `reopenLead` em `src/lib/lead-state.ts` e `executive-contact-dialog.tsx:82`) hoje só emitem com mudança real de estado.

6.4. Único emissor: `pushAlert` em `src/lib/workspace-alerts.ts:132-137`, restrito a `category === "movimentacao"` e acionado por `evaluateInvestorMovement()`. É **heurística 100% local** que compara `lastActivity` com `lastSeen` no `localStorage` — não é fato do servidor, então pode disparar em cenários sem atividade real confirmada pelo backend.

6.5. **Somente alerta operacional.** Reativação é uma inferência, não um fato relacional; colocá-la na Jornada mistura leitura interpretativa com histórico auditável.

6.6. O agregador do servidor: `src/server/relationship/journey.server.ts`, com a whitelist `RELATIONAL_TIMELINE_EVENTS` (`:88-95`) mais o prefixo `cadencia_`. Tudo o mais pertence à camada `tecnico` (Auditoria Técnica).

6.7. Sim. Basta a Jornada exibida ao executivo consumir **exclusivamente** o agregador do servidor, ignorando o barramento local. Atividade real do investidor continua íntegra porque está persistida (`portal_journey_events`, `portal_engagement`, `crm_timeline`).

6.8. **Normalizar na apresentação, com uma limpeza pontual do cache local.** O banco não foi contaminado — o ruído é client-side. Corrigir "na origem" significaria migrar dados de `localStorage`, o que não se justifica.

## 7. Presença do investidor

7.1. **Sim.** Eventos de módulo alimentam `portal_engagement` via `src/server/portal-engagement.server.ts`, com `manual` na lista `TRACKED` e registro de primeiro acesso por módulo.

7.2. **Sim** — `portal_engagement.last_access_at`, mais `portal_leads.last_activity_at`.

7.3. **Não.** Só existe "último acesso". Não há conceito de janela curta de presença.

7.4. Parcialmente: existe a infraestrutura de escrita (o servidor de engajamento e `last_access_at`), mas **não existe heartbeat** nem endpoint de ping periódico.

7.5. Implementação mínima: um ping do Portal a cada ~60s enquanto a aba está visível, gravando `last_access_at`; "online" = `now - last_access_at < 15 min`, calculado **na leitura**, sem coluna de status. Sem estado persistido, sem job de expiração.

7.6. Sim, 15 minutos, e como consequência natural do cálculo acima — nunca como flag que precise ser "desligada".

7.7. Sim, e deve: um único campo derivado (`last_access_at`) consumido por CRM e Workspace. Dois mecanismos é exatamente o que produz divergência entre telas.

7.8. **Sim, é o risco central.** O ping precisa vir apenas do Portal do investidor, autenticado pelo contexto do lead, e o evento resultante precisa estar na lista branca de `src/lib/events/investor-activity.ts`. Se qualquer superfície do executivo puder gravar presença, o problema do "NOVO" recorrente volta por outra porta.

## 8. Permissões

8.1. Por `executive_id = 'usr_thiago'` em `src/lib/executive-auth.ts` (seed) e, no banco, pelo trigger `grant_admin_for_official_executive`, que insere `admin` em `user_roles` quando o perfil tem esse `executive_id`.

8.2. Pelo **papel ativo da sessão** (`session.activeRole`), somado à lista `HYBRID_WORKSPACE_USER_IDS = ["usr_thiago"]` (`src/lib/portal-workspace.ts:19`). **Conflito existente:** `canAccessPortalWorkspace` (`:30-35`) e `canViewFullWorkspace` (`:42-49`) concedem acesso pelo ID do usuário, ignorando o papel ativo — enquanto o comentário em `:130-133` afirma que o híbrido, atuando como Colaborador, não deveria abrir o Portal.

8.3. Por escopo de carteira em `workspaceScopesFor` (`portal-workspace.ts:115-141`): Gestora recebe `central_unica`; Executivo recebe `green_sales` + `redistribuicao`. No banco a distinção é `has_role(..., 'manager')` vs. `current_executive_id()`.

8.4. Sim, um: o módulo `greensales-sync`, com `requiresRole: ["super_admin"]` (`src/config/modules.ts:57-66`). Remarketing **não** é restrito por papel — é apenas um item de navegação condicional.

8.5. Recomendação: **gerar a apresentação é ação do executivo responsável** (é ele quem conversa com o investidor); **exclusivo do administrador** deve ser a configuração global (texto oficial, validade, vídeo institucional) e o painel consolidado de todas as apresentações emitidas.

8.6. Sim, e o risco é concreto. Regra por nome quebra em homônimo, troca de titular e renomeação; e o próprio `HYBRID_WORKSPACE_USER_IDS` já é uma regra por identidade, não por papel — replicá-la agrava a dívida. O correto é papel/permissão.

8.7. Reutilizar **`workspace_module_permissions`** (`src/lib/workspace-permissions.ts`), que já é genérica por `module_key`, tem RLS (`admin` escreve, membro lê) e só precisa de uma nova chave na union `WorkspaceModuleKey`. Para restrição por papel, `requiresRole` em `src/config/modules.ts`.

## 9. Backup

9.1. `src/server/backup.server.ts` (geração, retenção, restauração) + `src/server/backup-queue.server.ts` (fila assíncrona, tabela `portal_backup_requests`), agendado por `pg_cron`; interface em `src/routes/f.executivo.central-backup.tsx`.

9.2. Sim, com uma ressalva: manuais e "pré-restauração" (`protected = true`) nunca podem entrar em limpeza — `pruneBackups` já os preserva. Backups não participam do funcionamento corrente do Portal; são só pontos de recuperação.

9.3. Sim, mas exige mudar a política. Hoje `RETENTION` (`backup.server.ts:143-152`) mantém **todos os pontos horários das últimas 48h** e depois o último ponto de cada dia por 7 dias. Manter apenas a meia-noite é reduzir `fullHours` a 0 e passar a selecionar o ponto por horário, não pelo "último do dia".

9.4. Rotulando o snapshot por **data de referência** e não por `created_at`: gravar uma coluna/label `reference_date = created_at - 1 dia` para os pontos gerados às 00:00. O agrupamento atual (`Math.floor(at / day)`, `:362`) usa UTC — sem esse rótulo explícito, a meia-noite de São Paulo cai no dia UTC seguinte e o rótulo fica errado por construção.

9.5. Sim: `pruneBackups()` (`backup.server.ts:329+`) descarta tudo além de `RETENTION.dailyDays = 7` e libera conteúdos órfãos.

9.6. Hoje **não garante exatamente 7**: o corte é por idade (7 dias corridos), não por contagem. Um dia sem execução produz 6 pontos; a janela de 48h produz muito mais que 7 registros. Garantir 7 exige seleção por ranking (`ORDER BY reference_date DESC LIMIT 7`) em vez de corte por idade.

9.7. **Executa restauração real.** `restoreBackupPayload` (`backup.server.ts:298-325`) apaga e reinsere as tabelas do ponto, respeitando `NEVER_RESTORE_TABLES`. Não é interface decorativa — e é a operação mais destrutiva do sistema.

9.8. Sim, existe risco: `pruneBackups` não conhece restaurações em andamento, e não há lock entre a fila de backup e a restauração. Mitigação natural: marcar `protected` no ponto durante a restauração (o backup pré-restauração já é protegido, mas o ponto de ORIGEM não é).

## 10. Remoções

10.1. **Cuidado.** A tela `src/routes/f.executivo.identidade.tsx` é apenas leitura, mas os conflitos que ela exibe são gravados por `resolve_portal_identity` (colunas `identity_conflict` / `identity_alternates`). Remover a tela **não** quebra deduplicação; remover a lógica, sim. Removendo só a interface, conflitos passam a ser gravados sem ninguém observando.

10.2. Sim, sem impacto no E20. `postPresentationVideoUrl` alimenta apenas `src/lib/crm/post-presentation.ts` (ação manual). Nenhuma etapa E* depende dele. Observação: o vídeo é individual por executivo, sem fallback — removê-lo elimina esse conteúdo da mensagem de pós-apresentação.

10.3. Sim. `f.executivo.templates.tsx` e `crm_meta_templates`/`meta_templates` são independentes de `relationship_message_library`. **Porém**, se algum envio real via Meta depender de template aprovado, a remoção derruba esse caminho — decisão de negócio, não técnica.

10.4. Sim, desde que se remova apenas o componente `src/components/crm/crm-lead-journey.tsx` da tela do CRM. A Jornada legítima vem do mesmo agregador do servidor (`journey.server.ts`) — o dado permanece.

10.5. Depende de 10.3: só é seguro se o motor de comunicação não estiver disparando por template aprovado da Meta. Pelo código, o motor oficial renderiza da Biblioteca; os templates da Meta são requisito da plataforma para janela fechada.

10.6. Candidatos a legado visível: os stubs de rota de topo (`crm.tsx`, `remarketing.tsx`, `portal-leads.tsx`, `executivo.*`) — úteis só enquanto houver links antigos; o `VideoSlot` "em breve" em três capítulos do Manual; e o módulo "Portal do Investidor" apontando para `/` no `modules.ts`, que ficará incoerente após a separação institucional.

## 11. Manual do Investidor

11.1. Metadados em `src/lib/journey-data.ts` (capítulo `velox`, "Quem é a Velox"); **corpo** em `src/components/journey/chapter-bodies.tsx`, função `VeloxBody` (`:104-260`), com a timeline em `:106-132`.

11.2. Sim. Basta inserir um objeto `{ year, title, d }` no array `timeline` entre "Fundação da Velox" (`:109`) e "Consolidação da operação" (`:114`). Nenhum outro capítulo é afetado — não há índice numérico acoplado à timeline.

11.3. Sim, é edição de texto puro no mesmo array/JSX. Hoje a narrativa é fundação → consolidação → expansão de franquias, sem afirmar operação própria antes da franqueadora — o ajuste é compatível com a estrutura existente.

11.4. Sim. Remover `hasVideo: true` do capítulo `operacao` (`journey-data.ts:146`). O `VideoSlot` é um placeholder sem player, sem dados e sem storage; os capítulos 1 e 14 continuam com o seu.

11.5. Sim. Os textos vêm de `portal_institutional_blocks` via `fetchInstitutionalModule({ module: "principios" })`; o visual está isolado nos `<article>` de `src/components/portal/principios-overlay.tsx:111-143`.

11.6. Sim, e é seguro. A imagem da página é `assetUrl("portal-capa-principios")` (`principios-overlay.tsx:15,84`); o card de origem na Home usa `experienciasImg.url` (`index.tsx:221`) — **são assets diferentes**. Remover uma não afeta a outra.

11.7. Não há vínculo técnico: `portal-capa-principios` é usado somente nesse overlay. O registro do asset permanece em `src/lib/assets/registry.ts:256-265` e pode ser reaproveitado depois.

## 12. Resposta final

### 12.1 / 12.2 — Itens que exigem decisão do Thiago

1. **Prefixo da Velox Solar: `/sol` ou `/s`?** O código já reservou `s`; adotar `/sol` sem alinhar cria dois vocabulários de unidade e invalida slugs já reservados.
2. **Fallback do link do Portal para o executivo padrão.** Hoje um lead sem responsável recebe o Portal de outro executivo. Manter ou bloquear o envio muda o comportamento do E0/E20 e conflita com a regra do pós-apresentação.
3. **Regerar E20 invalida o link anterior?** Hoje sim. Se o investidor já recebeu o link, regerar o derruba. Define se o botão reutiliza a ocorrência vigente ou sempre cria nova.
4. **Quem gera a apresentação digital:** executivo responsável ou apenas administrador? Define o modelo de permissão a criar.
5. **Retenção de backup: 7 pontos exatos de meia-noite ou a política atual (48h horárias + 7 dias)?** São políticas incompatíveis; a atual não garante 7 pontos.
6. **Remover "Central de Templates" e "Templates aprovados":** só é seguro se nenhum envio real via Meta depender deles — é decisão operacional sobre janela fechada de WhatsApp.
7. **Correspondência das etapas com o Word.** Sem o documento importado não é possível dizer quais etapas do código sobram ou faltam (E12, E27, E20).
8. **Híbrido (Thiago Colaborador) mantém acesso ao Portal?** O código e o comentário se contradizem hoje.

### 12.3 — Já pode ser implementado sem nova pergunta

- Chave única de ação (`lead + etapa + instância + origem`) — pré-requisito consensual.
- Agregador "Ações do Dia" como camada de leitura, com a ordenação do item 3.9 confirmada.
- Reunião subindo ao topo por ordenação, sem novo registro.
- Rota canônica de ficha do lead + correção do "Ver ficha completa".
- Jornada consumindo exclusivamente o agregador do servidor; `investor.reactivated` fora da Jornada.
- E20 na UI: botão único com estado, mensagem vinda da Biblioteca, URL copiada do valor retornado pelo servidor.
- Presença: heartbeat de 60s do Portal, "online" derivado de `last_access_at < 15 min`, campo único para CRM e Workspace.
- Manual: nova etapa histórica na timeline, ajuste do texto de operação própria, remoção do vídeo do capítulo 7, reformulação visual dos Princípios e remoção da imagem do overlay.
- Migração dos literais `/f` para `unitPath()`.

### 12.4 — Conflitos com a arquitetura atual

- `/` ainda É o Portal Financeiro; os stubs `*.$slug` redirecionam para `/`, contra a intenção institucional.
- Prefixo `s` no código vs. `/sol` no comando.
- "Ligações do Dia" lê o motor **legado** (`crm_cadence_tasks`), enquanto a `relationship_queue` é o motor oficial — dois motores vivos.
- Fallback de portal para outro executivo vs. regra "nunca link de outro executivo".
- Permissão por ID de usuário (`usr_thiago`) vs. modelo por papel.
- `RETENTION` atual (48h + 7 dias) vs. "7 snapshots de meia-noite".
- Agrupamento diário de backup em UTC vs. operação em America/São_Paulo.
- `operationalOwnerId` usado na redistribuição sem coluna equivalente em `portal_leads`.

### 12.5 — Cinco maiores riscos técnicos

1. **Duplicação de ações** ao unir Agenda e cadência sem a chave única — conclusões independentes do mesmo compromisso.
2. **Restauração de backup**: `restoreBackupPayload` apaga e reinsere tabelas inteiras, sem lock contra a rotina de limpeza.
3. **Presença virando atividade**: um heartbeat mal escopado reintroduz a regressão do "NOVO" recorrente.
4. **Separação `/` x `/f`**: links E0/E20 já entregues a investidores podem deixar de resolver se `portal-brands.ts` e os stubs não mudarem juntos.
5. **Duas fontes de mensagem** durante a importação do Word — envio com texto desatualizado de `messages.ts` enquanto a Biblioteca é a fonte oficial.

### 12.6 — Ordem ideal de implantação

1. Chave única de ação + normalização `DailyAction` (fundação, sem UI).
2. Rota canônica da ficha do lead e correção do "Ver ficha completa" (baixo risco, ganho imediato).
3. Jornada lendo só o servidor + `investor.reactivated` fora da Jornada.
4. Ações do Dia: agregador de leitura com Agenda, ligações e mensagens, na prioridade de 3.9.
5. Importação do Word na Biblioteca e aposentadoria dos literais de `messages.ts`.
6. E20 na interface (botão com estado, prazo visível) e painel administrativo de apresentações.
7. Presença do investidor (heartbeat + 15 min).
8. Backup: nova política de retenção com data de referência e fuso correto.
9. Manual e Princípios (conteúdo e visual, risco isolado).
10. Separação `/` institucional x `/f` Financeira, com `unitPath()` já adotado.
11. Remoções de legado, por último — depois que os substitutos estiverem em produção.

12.7. Nada foi implementado nesta etapa.
