# Diagnóstico — Portal dos Leads /f (somente leitura, nada foi alterado)

## 1. Acesso ao Portal

- Rota: `/f/portal-leads` (`src/routes/f.portal-leads.tsx`), `ssr: false`.
- Componente: `PortalLeadsBoard` (`src/components/crm/portal-leads-board.tsx`), também usado embutido no CRM.
- Camadas de entrada, nesta ordem:
  1. `OperationalGuard` (sessão do navegador existe);
  2. `WorkspaceResourceGuard resource="portal_leads"` → matriz única `src/lib/workspace-authorization.ts`;
  3. `useModuleAccess(..., "portal_leads")` na própria página;
  4. dentro do quadro, uma **quarta** verificação própria: `isCrmAdministrator || isCrmSupervisor`.
- Matriz: `portal_leads` = papéis `TODOS` (super_admin, diretora, executivo) + módulo obrigatório `portal_leads` ligado.
- Servidor: `listCrmLeads`/`getCrmLead` chamam `assertWorkspaceAccess(context, "portal_leads")` (`src/server/workspace-authorization.server.ts`), mesma matriz.
- CRM habilitado **não** influencia o Portal (o módulo `crm` é exigido por `backup_conversas` e `remarketing`, não por `portal_leads`).

### Mensagem de bloqueio
Existem duas coisas diferentes com texto parecido:

- **"Área restrita à gestão do CRM."** — string literal em `portal-leads-board.tsx` (linha ~568), decidida **no navegador** por `allowed = isCrmAdministrator(role) || isCrmSupervisor(role)` (`src/lib/crm/permissions.ts`). Colaborador (`executivo`) cai sempre nela, mesmo com papel e módulo liberados.
- **"Acesso restrito à gestão do CRM."** — erro lançado em `src/lib/crm/daily-actions.functions.ts` e `src/lib/crm/cadence.functions.ts`, quando `has_role(admin)` e `has_role(manager)` são falsos. É o que impede o contador de "Ações do Dia" dentro do quadro para colaborador (o erro é engolido e o contador some).

## 2. Escopo por perfil

| Perfil | Abre a rota? | Deveria (matriz) | Entrega hoje |
|---|---|---|---|
| Thiago (admin/super_admin) | sim | quadro completo | quadro completo |
| Larissa (manager/diretora) | sim | quadro completo | quadro completo (tratada como supervisora do CRM) |
| Marton, Milton, Paulo, Carlos, Talita (user/executivo) | sim, a rota abre | ver o quadro (matriz permite) | tela "Área restrita à gestão do CRM." |

- (D) o escopo dos dados é servidor: `assertWorkspaceAccess` + RLS.
- (E/F) nenhum `executive_id` do navegador é aceito nas funções do Portal; o quadro não envia identificador de executivo.
- (G) diferença Portal x CRM: a matriz separa os dois, mas o componente do Portal ainda usa a regra antiga do CRM (`super_admin`/`diretora`).

## 3. Titularidade

- Campo oficial: `portal_leads.responsible_executive_id` (+ `responsible_executive_slug` como espelho de conveniência).
- Resolução: `src/server/crm/responsible.server.ts` — `resolveResponsibleByVendorId` (origem) e `resolveResponsibleByUserId` (dono da conexão), ambas contra `executive_profiles` (`greensales_vendor_id` / `user_id` → `executive_id`).
- `backfillCardResponsible` só preenche card sem dono; nunca sobrescreve.
- `crm_leads` (o espelho exibido no Portal) **não tem** coluna de responsável: a titularidade vive no card operacional `portal_leads`.
- Fonte de verdade interna: `portal_leads.responsible_executive_id`.

## 4. GreenSales → Portal

- Leitura server-only em `src/server/greensales.server.ts` (`POST /login`, `POST /lead/list`), consumida por `src/server/crm/lead-intake.server.ts` (`intakeLead`).
- Responsável: `greenSalesVendorId(raw)` lê `vendedor_id` (ou `vendedor.id`) → `resolveResponsibleByVendorId`.
- `user_id` e `pre_user_id` do payload **não são usados** para titularidade (não aparecem no código de resolução). `user_id` só existe como `crm_connections.user_id`, que é a identidade do nosso executivo dono da conexão.
- `responsible_executive_id` é definido no momento em que o card é criado (`ensureWorkspaceCard`), antes da E0, e é persistido em `portal_leads`.
- Fallback: quando o `vendedor_id` não resolve, usa-se `resolveResponsibleByUserId(context.connectionUserId)` — o dono da conexão que rodou a sincronização. Se nada resolver, o card nasce **sem responsável** (nenhum dono inventado).

## 5. Conexão individual do GreenSales

- Armazenada em `crm_connections` (`user_id` + `provider='greensales'`, credencial cifrada), gravada por `connectGreenSales`; a senha nunca volta ao navegador.
- Escolha da credencial (`src/server/crm/connections.server.ts`): 1) conexão ATIVA do próprio usuário; 2) qualquer conexão ATIVA mais recente (fallback global interno); 3) segredos `GREENSALES_EMAIL`/`GREENSALES_PASSWORD`.
- O Portal funciona sem conexão individual: o quadro lê o banco espelhado, não a origem. Sem conexão própria o indicador mostra "Desconectado", mas a leitura continua.
- A ausência de conexão individual **não** é a causa da mensagem de acesso restrito — são mecanismos independentes.

## 6. Meu Perfil e WhatsApp

- Número oficial: `executive_profiles.whatsapp`; gravado por `salvarPerfilExecutivo` a partir de `ExecutiveWhatsappCard`, com o `executiveId` resolvido pela identidade server-side.
- `src/lib/whatsapp-number.ts` já normaliza e produz `waLink` (`https://wa.me/55…`), com teste próprio; e `src/lib/relationship/e0-destinations.ts` já usa o `wa.me` do responsável.
- O quadro do Portal **não** lê esse número hoje; o adaptador da Ação do Dia (`daily-actions-real-adapter.ts`) abre `wa.me` com o número do **lead**, não do executivo. Ou seja: capacidade pronta, uso no Portal ainda não existe.

## 7. Leads exibidos

- `listCrmLeads` lê `crm_leads`, ordena por `external_created_at` desc, limite fixo 500, sem paginação.
- Filtros disponíveis na função: `stageKey`, `welcomeStatus`, `search` (nome/e-mail/telefone). A interface só usa `search`.
- Não há filtro de responsável, de ambiente, de produção/homologação nem de período na consulta.
- Colunas vêm de `crm_pipeline_stages` (`visible = true`); lead sem `stage_key` não aparece em coluna (contado como "sem etapa no funil").
- Risco de escopo: a consulta não recorta por executivo — quem protege é a RLS de `crm_leads`, que hoje só libera `admin` e `manager`. Logo, colaborador não vê leads de terceiros, mas também não vê nenhum.

## 8. Ação do Dia

- O quadro apenas **abre** o overlay (`DailyActionsOverlay` + `useRealDailyActionsAdapter`) e mostra o contador `getDailyActionsSummary`.
- O identificador de ligação é `DailyAction.leadId` = `portal_leads.id` (card operacional).
- A responsabilidade é resolvida no servidor por `current_executive_id()` dentro das funções da Ação do Dia; o Portal não envia executivo.
- O Portal não cria ações nem tarefas de cadência. A Ação do Dia é que grava (fila, logs, notas) e o Portal só relê.
- Leitura pura no Portal: lista, ficha, histórico de eventos, execuções de sync, estado da conexão.

## 9. Relacionamento / cadência

- `relationship_queue`, `relationship_engine_log`, `crm_cadence_tasks`, `relationship_message_library`: o Portal **não lê nem grava** diretamente. Tudo isso é alcançado apenas através do overlay da Ação do Dia.
- Escritas do próprio Portal: somente `moveCrmLeadStage` (contingência local, auditada em `crm_lead_events`), `runCrmSyncNow` e `runCrmBackfillNow`.
- E0/E1+ não são disparadas pelo Portal; a E0 nasce no `intakeLead`.
- Não existe lógica de cadência paralela dentro do Portal.

## 10. Mensagem histórica — veredito

(A) Ainda pode acontecer, e acontece hoje para colaborador. (B) Não foi corrigida. (C) Não depende de conexão GreenSales individual. (D) Não depende do módulo/matriz — o colaborador já passa por eles. (E) Combinação real: a matriz nova libera, mas o componente do quadro mantém a regra antiga de papel (`super_admin`/`diretora`), e a RLS de `crm_leads`/`crm_lead_events` também só libera `admin`/`manager`. São dois bloqueios independentes e ambos ativos.

## 11. Administrador

- Vê tudo (RLS `has_role(admin)`), sem alternância de escopo e sem "Minha operação" no Portal — o Portal não tem seletor de escopo.
- Identidade do Thiago resolvida server-side: Supabase Auth → `executive_profiles.user_id` → `executive_id`, papel em `user_roles`.
- Diferença para o KPI Manager: lá existe escopo equipe x própria operação; no Portal não existe esse conceito.

## 12. Gestora / Larissa

- Vê o quadro inteiro como supervisora (`isCrmSupervisor`), o que é coerente com o papel gerencial.
- Não há "operação própria" nem "Minha operação" no Portal.
- Ponto de atenção: o botão "Ações do Dia" e o contador aparecem também para ela, e as funções da Ação do Dia aceitam `manager` — ou seja, o Portal ainda a expõe a uma superfície operacional, embora ela não tenha carteira.

## 13. Colaborador

- Acesso à rota: liberado pela matriz e pelo módulo.
- Escopo entregue: nenhum — tela "Área restrita à gestão do CRM.".
- Mesmo que a tela liberasse, `crm_leads`/`crm_lead_events` retornariam vazio por RLS.
- Titularidade e GreenSales: não interferem nesse bloqueio.
- Proteção server-side: existe e é sólida (matriz + RLS); o problema é excesso, não falta.

## 14. `executive_profiles` usado pelo Portal

- `user_id` (identidade e dono da conexão), `executive_id` (responsável do card), `slug`, `name` (rótulo da conexão), `greensales_vendor_id` (mapeamento da origem).
- `whatsapp` existe e é gravado em Meu Perfil, mas o Portal não consome.
- `status`/`executive_user_status` não são consultados pelo Portal.
- Não existe coluna `vendor_id` separada: o campo é `greensales_vendor_id`.

## 15. Rotas e navegação

- Portal: `/f/portal-leads`; também embutido em `/f/crm`.
- Ficha do investidor: `/f/executivo/dashboard?perfil=<portal_leads.id>` (+ `escopo`), aberta em nova aba pelo overlay da Ação do Dia (`window.open`, `noopener`).
- O diálogo do próprio quadro mostra a ficha do espelho `crm_leads` (dados + eventos), não a ficha operacional.
- Nenhum `executive_id` trafega por URL.
- O `window.open` é hardcoded com prefixo `/f`, então não há risco de sair do ambiente Financeira — mas também não é derivado do ambiente atual (seria um hardcode a revisar se o mesmo componente for reusado em `/s` ou `/seg`).
- Redirecionamento sem sessão vai para `/f/executivo` (dentro do ambiente).

## 16. Segurança

- 🟢 Autorização de rota e de dados: matriz única + `assertWorkspaceAccess` + RLS.
- 🟢 Escolha do executivo: nunca vem do navegador (`current_executive_id()`).
- 🟢 Credenciais GreenSales: nunca retornam ao cliente.
- 🟢 Titularidade: não pode ser alterada pelo Portal.
- 🟡 Seleção de lead: o `id` vem do cliente, mas RLS + `assertWorkspaceAccess` limitam o alcance.
- 🟡 Movimentação de contingência (`moveCrmLeadStage`): escrita disparada pelo cliente, protegida pela mesma matriz — hoje só gestão alcança.
- 🔴 Decisão de exibição `allowed` no `portal-leads-board.tsx`: puramente client-side. Não vaza dado (a RLS segura), mas é uma segunda regra de autorização fora da camada única.

## 17. Situação por item

- 🟢 Não mexer: intake GreenSales, resolução de responsável, RLS de `portal_leads`, isolamento Portal x Ação do Dia, credenciais/conexões, contingência auditada.
- 🟡 Depende de condição externa: conexão GreenSales individual (fallback global ativo), `greensales_vendor_id` de Larissa e Talita nulos, WhatsApp do executivo depende de preenchimento em Meu Perfil.
- 🔴 Problemas reais: (a) regra de papel duplicada no componente do quadro bloqueia colaborador; (b) RLS de `crm_leads`/`crm_lead_events` só admite admin/manager, sem recorte por responsável; (c) Larissa exposta ao botão Ações do Dia; (d) `listCrmLeads` sem recorte por responsável nem paginação (limite 500).
- ⏸️ Congelados, sem proposta: ER, redistribuição automática, alteração automática de titularidade, sincronização de responsável com o GreenSales.

## 18. Pontos que, apenas em tese, exigiriam construção futura

1. Unificar a decisão de exibição do quadro na matriz única, eliminando a regra antiga de papel.
2. Definir o recorte de leitura do colaborador (por responsável) tanto na consulta quanto na RLS de `crm_leads`.
3. Decidir a presença do botão Ações do Dia para a gestora.
4. Paginação/filtros no quadro (período, etapa, status) acima dos 500 registros.
5. Uso do WhatsApp do executivo no Portal, se e quando fizer sentido.

Nada disso foi implementado: este documento é apenas a fotografia do estado atual.
