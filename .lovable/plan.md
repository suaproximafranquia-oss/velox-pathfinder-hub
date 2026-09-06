# Diagnóstico profundo — Financeira /f (somente leitura)

Nada foi alterado: sem código novo, sem migração, sem permissão, rota, interface ou dado modificado.
Legenda: **BACKEND** = regra no servidor/banco; **FRONTEND** = só interface; **MENU** = só visibilidade; **PARCIAL**; **NÃO EXISTE**.

## 1. Gestora / Larissa — permissões e visão

**ESTADO ATUAL**
- Banco: `executive_profiles.executive_id = usr_larissa`, `user_roles.role = manager`, status ativo, **sem código GreenSales** (`greensales_vendor_id` nulo).
- Servidor traduz `manager → diretora` (`src/lib/executive-auth.ts:592-597`; `src/server/workspace-authorization.server.ts:56-60`). Perfil nunca vem do navegador.
- Matriz única `ROLE_MATRIX` (`src/lib/workspace-authorization.ts:55-76`): diretora TEM biblioteca, apresentação digital, usuários, central de operações, portal de leads, backup de conversas; NÃO tem captação, homologação, revista, central de backup, configurações, **remarketing**.
- `src/server/operational-team.server.ts:44-63` remove a gestora (manager sem admin) de toda lista de "executivo ativo" — logo ela não aparece em KPI, Campanhas nem rankings. `src/lib/kpi-scope.functions.ts:84-86` reforça.
- Permissões de módulo de Larissa no banco: `crm=true`, `portal_leads=true`, `e0_automatico=false`.

**JÁ CORRETO**
Papel, exclusão dela como executiva (BACKEND, não cosmético), bloqueio de Remarketing e Captação, escopo de equipe na Central de Operações, Biblioteca e Gestão de Usuários.

**DIVERGÊNCIAS**
1. Rotas sem `WorkspaceResourceGuard`: `kpi`, `campanhas`, `dashboard`, `home`, `alertas`, `reunioes`, `investidores`, `administracao`, `brain`, `criativa`, `relatorios`, `templates`, `fluxos`, `laboratorio`, `greensales*`, `teste-cadencia`, `acao-do-dia-demo`. Protegidas só pela sessão (`src/routes/f.executivo.tsx:23-30`). Para KPI/Campanhas/Alertas/Reuniões isso é intencional (recurso de todos), mas **`administracao`, `templates`, `greensales*`, `laboratorio` e `teste-cadencia` ficam abertos por URL direta a qualquer sessão válida, inclusive colaborador** — esses recursos sequer existem no `ROLE_MATRIX`.
2. "Central de Reuniões" e "Central de Alertas" não são recursos da matriz — existem só como rota + menu, sem regra de papel formal.
3. "Gerenciar colaboradores permitidos" existe (recurso `usuarios`, ADMIN_GESTAO) — OK; mas redefinição de senha é ação de Admin.
4. Não há regra que impeça atribuir lead a Larissa: o bloqueio é só nas listas de executivos, não no `responsible_executive_id`.

**ARQUIVOS/TABELAS**
`src/lib/workspace-authorization.ts`, `src/server/workspace-authorization.server.ts`, `src/server/operational-team.server.ts`, `src/lib/kpi-scope.functions.ts`, `src/components/executive/executive-shell.tsx:219-322`, `src/routes/f.executivo*.tsx`, tabelas `user_roles`, `executive_profiles`, `executive_user_status`, `workspace_module_permissions`.

**SE FOR CONSTRUIR**
Registrar `administracao`, `templates`, `greensales`, `laboratorio`, `reunioes`, `alertas` na matriz única e aplicar o guard nessas rotas.

## 2. Portal de Leads — visão da gestora

**ESTADO ATUAL**
- O recorte é **100% RLS no banco**, não no navegador: `can_read_crm_lead(_external_id)` = `admin OR manager OR responsible_executive_id = current_executive_id()`; `can_access_investor` idêntica.
- Admin e gestora leem a carteira inteira; colaborador só os próprios. `listPortalLeads` faz `select("*")` e o banco corta.
- Filtro por executivo existe na tela (`portal-leads-board.tsx`, `executiveId` enviado ao servidor).
- GreenSales: `crm_connections` só serve à **sincronização e atribuição de responsável** (`src/server/crm/responsible.server.ts:14-65`), nunca à leitura. Hoje há apenas 1 conexão registrada; 648 `crm_leads` e 124 `portal_leads` persistidos.

**JÁ CORRETO**
Visão consolidada da equipe para a gestora; independência de conexão GreenSales pessoal (desconectar Larissa **não** apaga a visão consolidada); filtro por executivo; ownership como fonte.

**DIVERGÊNCIAS**
1. `can_read_crm_lead` e `can_access_investor` **não checam status ativo/inativo** do executivo: leads de executivo desligado continuam visíveis à gestão (aceitável) mas não são reclassificados.
2. Se algum lead receber `responsible_executive_id = usr_larissa`, ele passa a ser lead pessoal dela e entra em contadores de responsável — não há trava.
3. Ação do Dia já é ocultada para diretora no frontend (`portal-leads-board.tsx:339`), mas não há bloqueio equivalente no servidor.

**ARQUIVOS/TABELAS** `src/components/crm/portal-leads-board.tsx`, `src/lib/portal-leads.functions.ts:348-358`, `src/server/crm/lead-service.server.ts`, `responsible.server.ts`, `connections.server.ts`; tabelas `crm_leads`, `portal_leads`, `investors`, `crm_connections`, `lead_ownership_history`; funções `can_read_crm_lead`, `can_access_investor`, `current_executive_id`.

## 3. KPI Manager e Campaign Panel

**ESTADO ATUAL** — ambos resolvem escopo no BACKEND.
- KPI: `resolverEscopoKpi` (`src/lib/kpi-scope.functions.ts:40-99`) — colaborador só ele; manager equipe ativa sem si mesma; admin equipe + própria linha.
- Campanhas: `listarEquipeCampanhas` (`src/lib/executive-directory.functions.ts:114-126`) — mesma fonte `listActiveOperationalExecutives()`, todos os papéis veem todos os executivos ativos.
- Inativos saem por `executive_user_status`; executivo novo ativo entra automaticamente (lista derivada, sem cadastro paralelo).

**JÁ CORRETO** Todas as regras esperadas dos dois módulos estão implementadas no servidor, inclusive a exclusão da gestora.

**DIVERGÊNCIAS**
1. "Minha equipe" e "KPI individual por executivo" para a gestora: o escopo de equipe existe; a seleção individual por executivo dentro do KPI precisa de confirmação de UI (existe alternância Equipe×Eu para admin; para gestora não há "Eu").
2. Rotas KPI/Campanhas sem guard (ver bloco 1) — porém sem consequência de dados, pois o payload já é recortado.

**ARQUIVOS** `kpi-scope.functions.ts`, `executive-directory.functions.ts`, `operational-team.server.ts`, `src/routes/f.executivo.kpi.tsx`, `f.executivo.campanhas.tsx`.

## 4. Ação do Dia — "Pular"

**ESTADO ATUAL**
- Pular é **append-only**: evento `acao_do_dia_pulada` em `relationship_engine_log` + espelho em `crm_timeline` (`src/server/crm/daily-actions-log.server.ts:27-107`). Grava autor, lead, etapa, data/hora e justificativa obrigatória (≥3 caracteres). **Não existe coluna/estado "pulada"** em tabela dedicada.
- A ação some da fila do dia por filtro em memória (`listSkippedActionKeys`, linhas 412-434 + `daily-actions.server.ts:320-321`) e volta no dia seguinte se a fonte oficial continuar pendente.
- Recuperação **existe** (`recordSkipRecovery`, linhas 109-169), idempotente, sem apagar o pulo — mas é **implícita**: dispara só quando a mesma ação é depois concluída (mensagem confirmada ou reunião com comparecimento). Não há botão "Recuperar".
- Contadores: Central de Operações (`operations-center.server.ts:288-364`) conta como "pulo" apenas o que não tem recuperação casada, e exibe coluna "Recuperada" em `central-home.tsx:368-417`.

**JÁ CORRETO** Histórico preservado, idempotência, não vira concluída, contadores diferenciam pulada/recuperada/concluída.

**DIVERGÊNCIAS** Não existe ação explícita de "devolver à fila hoje": a recuperação depende de a ação reaparecer naturalmente. Não há motivo estruturado (é texto livre) nem estado consultável por lead fora do ledger.

**TABELAS** `relationship_engine_log`, `crm_timeline`, `relationship_queue`, `portal_meetings`, `crm_cadence_tasks`.

## 5. Central de Templates + Remarketing

**ESTADO ATUAL**
- Existem **duas** tabelas de template: `crm_meta_templates` (atual: `meta_name`, `language`, `status`, `is_active`, `purpose`, `variables`, `buttons`, único por nome+idioma) e `meta_templates` (legado, usada só por `src/lib/comms.functions.ts`). Ambas estão **vazias hoje** (0 linhas), assim como `campaigns` e `remarketing_campaigns`.
- Remarketing lê `crm_meta_templates` via `listCrmRelationshipTemplates` (`src/lib/crm/meta-templates.functions.ts:358-373`, filtro `is_active=true`). **Não usa `relationship_message_library`** — essa é exclusiva do motor de relacionamento (72 linhas).
- Ao criar campanha, grava snapshot textual (`template_name/label/language/body` em `remarketing_campaigns`) com `template_version` incremental; o envio nunca relê o template. **Sem FK** para o template de origem.
- E0 lê a mesma tabela por convenção `purpose='primeiro_contato'` + status aprovado (`src/server/relationship/e0-template.server.ts:52-73`).

**JÁ CORRETO** Cadastro central com nome Meta, idioma, conteúdo, status, ativo/inativo, variáveis; snapshot imutável na campanha; separação Library × Templates Meta.

**DIVERGÊNCIAS**
1. **Não existe coluna de ambiente** em nenhuma tabela de template.
2. `status` é texto livre ("aprovado"/"approved"/"ativo") — não há enum que distinga formalmente "aprovado pela Meta" de "criado internamente".
3. Duas tabelas paralelas (`meta_templates` legado ainda vivo).
4. Vínculo campanha→template é por texto, não por chave; e E0↔Remarketing se ligam só por convenção de `purpose`.

**REUTILIZÁVEL** `crm_meta_templates` + `meta-templates.functions.ts` + snapshot de campanha já cobrem a maior parte; não precisa recomeçar.

## 6. Brian Analytics / IA Executiva

**ESTADO ATUAL** O botão **já não existe** (`src/routes/f.executivo.brain.tsx:82-85`). O backend `generateBrainReport` (`src/lib/brain-ai.functions.ts`) e o PDF `brain-ai-report.ts` continuam no repositório, sem chamador: código morto. Usava Lovable AI Gateway (`google/gemini-3.5-flash`, `LOVABLE_API_KEY`), com custo e tratamento de 429/402.

**JÁ CORRETO** Relatório tradicional (`reports.ts`) é independente da IA e segue funcionando.

**DIVERGÊNCIA** Restam dois arquivos órfãos; nenhuma rota específica de IA existe.

## 7. Manual — vídeos

**ESTADO ATUAL** **Nenhum capítulo do Manual tem vídeo hoje.** O tipo `Chapter` tem `hasVideo?: boolean` (`src/lib/journey-data.ts:14`) e `chapter-view.tsx:76-79` renderiza `VideoSlot`, mas **nenhum dos 14 capítulos define `hasVideo: true`**; `video-slot.tsx:19` é placeholder ("em breve"), sem URL. Capítulos 1 (`recepcao`), 7 (`operacao`) e 14 (`proximos-passos`) — **sem vídeo**. `presentation_chapters` está vazia (0 linhas); o único campo de vídeo real do sistema é `environment_presentations.video_url` (por ambiente, não por capítulo) e essa tabela também está vazia.

**CONCLUSÃO** Não há o que remover: a remoção pedida anteriormente não tem alvo.

## 8. Rotas e ambientes

**ESTADO ATUAL** Existem e estão registradas no routeTree: `/f` (+ árvore `f.executivo.*`), `/financeira`, `/solar`, `/seguradora`, `/s`, `/s/$slug`, `/s/portal`, `/seg`, `/seg/$slug`, `/solar-seguros`. **`/sol` não existe.** Sem conflito de path. O menu `/f` aponta para Solar/Seguros por um único item externo, "Solar + Seguros" → `/solar-seguros` (`executive-shell.tsx:302`), em nova aba.

**DIVERGÊNCIA** Apenas a coexistência `/s` (portal) × `/s/portal` × `/s/$slug`, que pode confundir leitura humana, mas não gera sobreposição técnica.

## 9. Isolamento entre ambientes

**COMPARTILHADOS**
- `environment_presentations` / `environment_presentations_history` — multiambiente real, isolado por coluna `environment` (uma vigente por ambiente).
- Código do CRM e do motor de relacionamento (`src/server/crm/*`, `src/server/relationship/*`) e tabelas `crm_leads`, `portal_leads`, `executive_profiles`, `user_roles`, `workspace_module_permissions` — **usados hoje apenas pela Financeira**; `/s` e `/seg` são páginas institucionais/estáticas que não chamam esse código.
- Identidade/autorização (`identity.server.ts`, `workspace-authorization*`) é global por usuário, não por ambiente.

**RISCO** Estrutural e futuro: hoje mudar `/f` não afeta `/s` nem `/seg` porque eles não consomem o motor. Se Solar/Seguros passarem a usar CRM, o isolamento precisará virar coluna de ambiente nas tabelas operacionais — o que **não existe hoje**.

## PRÓXIMAS CONSTRUÇÕES RECOMENDADAS (em ordem)

1. Fechar as rotas abertas por URL: registrar `administracao`, `templates`, `greensales`, `laboratorio`, `teste-cadencia`, `reunioes`, `alertas` na matriz única e aplicar o guard.
2. Trava para que a Gestora nunca seja `responsible_executive_id` de lead (regra de servidor + verificação no intake).
3. Botão explícito de "Recuperar ação pulada" (usando `recordSkipRecovery`, sem tocar no histórico).
4. Central de Templates: enum de status Meta (aprovado × interno), coluna de ambiente e vínculo por chave entre campanha e template; aposentar `meta_templates` legado.
5. KPI da Gestora: seleção individual por executivo dentro da visão de equipe.
6. Limpeza dos órfãos de IA (`brain-ai.functions.ts`, `brain-ai-report.ts`), se confirmada a decisão de não religar.
