# INVESTIGAÇÃO 2 — RESPONSABILIDADE DO LEAD / EXECUTIVO / CONTEXTO DO PORTAL

Rodada somente de leitura. Nada foi alterado: sem código, sem banco, sem migration, sem cron, sem UI, sem mensagem, sem tocar a Global WhatsApp Safety Lock.

**Resposta curta:** a informação existe e é inequívoca — a conta GreenSales sincronizada pertence a um usuário (`crm_connections.user_id`), e hoje existe **uma única** conexão ativa, a do Thiago. O servidor lê essa linha em toda sincronização, mas usa apenas a senha: descarta o `user_id`. O responsável do lead acaba sendo gravado **depois**, e **pelo navegador** de quem abre o CRM, não pelo servidor que criou o card. Entre esses dois momentos a E0 acontece — e falha.

---

## 1. IDENTIDADE DO PORTAL / EXECUTIVO

Cadeia real de identidade:

```text
auth.users.id (sessão Supabase)
  → executive_profiles.user_id  →  executive_profiles.executive_id  ("usr_thiago")
  → portal_leads.responsible_executive_id  (guarda o executive_id, não o uuid)
```

- `current_executive_id()` (função no banco, security definer) converte `auth.uid()` em `executive_id`. É a base das políticas `can_access_investor` / `can_access_relationship` e da agenda.
- `executive_profiles` é o cadastro oficial: `executive_id`, `user_id`, `name`, `whatsapp`, `slug`. Hoje tem 7 linhas (usr_thiago, usr_larissa, usr_milton, usr_paulo, usr_carlos, usr_talita, usr_marton).
- `resolveLeadExecutive` (`src/server/relationship/executive-identity.server.ts`) é a função que resolve "quem assina": lê `portal_leads.responsible_executive_id` e busca o perfil. Sem responsável, devolve `available: false`.

**Existe workspace/unidade/franquia?** NÃO como tabela. Não há `workspace_id`, `unit_id` nem `tenant_id` em `portal_leads`. O que existe é:
- `scope` (`green_sales` | `redistribuicao` | `portal` | `tiktok` | `meta`) — carteira, não unidade;
- `workspace_module_permissions` — permissão de módulo por usuário, não posse de lead;
- `crm_connections` — **a conexão GreenSales pertence a um usuário** (`user_id`, `provider`, credenciais cifradas). É o único vínculo real "ambiente ↔ executivo".

**Durante a sincronização, qual identidade está disponível?** `crm_connections.user_id` — sempre, inclusive no cron. E, na sincronização manual, também o `context.userId` da sessão.

## 2. SINCRONIZAÇÃO MANUAL — o `userId` é descartado

```text
runCrmSyncNow (leads.functions.ts:203)   context.userId  ✔ existe
  → runLeadSync("manual", context.userId)  (lead-sync.server.ts:54, param actorUserId)
      → resolveCredentials(actorUserId)    ← ÚNICO uso do userId em todo o fluxo
      → intakeLead(raw, { pipeline, settings })   ✘ userId NÃO é passado
          → ensureWorkspaceCard({...})            ✘ nenhum dado de usuário
                 responsible_executive_id: null   (workspace-card.server.ts:65)
```

- O `userId` chega até `runLeadSync`. **Não** chega a `intakeLead` — a assinatura do intake recebe apenas `(raw, { pipeline, settings, test? })`. **Não** chega a `ensureWorkspaceCard`.
- `resolveCredentials(userId)` (`connections.server.ts:98`) carrega a linha de `crm_connections` daquele usuário, **abre as credenciais e devolve só `{ email, password }`** — o `user_id` da conexão é jogado fora ali dentro.
- Motivo técnico do card nascer sem responsável: nenhum. É uma decisão explícita no código (`responsible_executive_id: null`, com o comentário de que o card nasce sem dono).

**A informação já existe e simplesmente não é utilizada. CONFIRMADO NO CÓDIGO.**

## 3. SINCRONIZAÇÃO AUTOMÁTICA — como o cron sabe de quem é o ambiente

```text
pg_cron 'portal-crm-sync-automatico' (* * * * *)
  → POST /api/public/crm/sync   (sem usuário; autentica por segredo de automação)
  → runScheduledLeadSync  →  runLeadSync("cron")   actorUserId = undefined
      → resolveCredentials(undefined)
           ↳ sem userId, cai no fallback: a conexão ATIVA mais recente
             de qualquer usuário  (order by updated_at desc, limit 1)
```

Das hipóteses levantadas, a resposta é **(D) + (E)**, com um detalhe importante:

- **(A) ambiente global único:** parcialmente verdadeiro **de fato**, não por desenho. Hoje `crm_connections` tem **exatamente uma linha ativa**: `user_id = 6005ef93-…-2c6d8c22a4a9`, `account_label = Thiago Rodrigues`, `account_email = thiago.rodrigues@veloxsolucoes.com.br`, status `ATIVA`. Esse uuid é o `user_id` de `executive_profiles.executive_id = 'usr_thiago'`. **CONFIRMADO NOS DADOS.**
- **(B) configuração fixa:** existe apenas como último recurso — variáveis de ambiente `GREENSALES_EMAIL`/`GREENSALES_PASSWORD`, usadas se não houver nenhuma conexão ativa.
- **(C) workspace:** NÃO ENCONTRADO.
- **(D) conta GreenSales vinculada a um executivo:** SIM — é exatamente o modelo de `crm_connections`.
- **(E) configuração de integração que determina o dono:** a conexão determina de quem é a *conta*; o código nunca a usa para determinar o dono do *lead*.
- `crm_automation_settings` guarda intervalo, boas-vindas e data de ativação — **nenhum campo de executivo**.

Ou seja: **o cron sabe qual conta está sincronizando (e, por tabela, de quem ela é), mas o código não propaga isso adiante.**

## 4. GREENSALES — o que a origem devolve

`fetchLeadsSince` / `fetchLeadDetail` (`greensales.server.ts`) devolvem o payload cru, e o intake usa: `id`, `name`, `email`, `phone`, `city`, `withs` (etiquetas → estágio), `created_at`, `updated_at`, `last_register_at`. O payload inteiro é guardado em `portal_leads.external_payload`.

- Nenhum campo `owner`, `user`, `assigned_to`, `vendedor` ou `responsável` é lido em qualquer ponto do código. **CONFIRMADO NO CÓDIGO.**
- `pipeline`/`stage`: existem como **etiquetas** (`withs`) e são usadas só para resolver a coluna do quadro — não indicam pessoa.
- Se algum desses campos vier no payload cru, ele está preservado em `external_payload`, mas ninguém o consulta. Se a decisão futura depender disso, é uma inspeção adicional de payload — hoje **NÃO ENCONTRADA** qualquer leitura.
- **Informação suficiente para amarrar o lead à conta sincronizada: SIM** — não vem do lead, vem do lado de cá: é a conexão usada para buscá-lo.

## 5. PORTAL INDIVIDUAL — "este lead é do Thiago"?

**SIM, existe.** E vem de dois lugares independentes:

1. **A conexão usada para importar** — `crm_connections.user_id` → `executive_profiles.executive_id` = `usr_thiago`. Disponível em toda sincronização, manual ou cron.
2. **O usuário autenticado**, no caso manual — `context.userId` em `runCrmSyncNow`.

**Por que não chega a `responsible_executive_id`:** o ponto exato da perda é `resolveCredentials` (`connections.server.ts:98-133`). Ela recebe/encontra a linha da conexão, extrai as credenciais e devolve apenas `{ email, password }`. Daí em diante nenhuma camada sabe mais de quem é a conta. Em seguida `intakeLead` não recebe ator, e `ensureWorkspaceCard` grava `responsible_executive_id: null` de forma literal.

**E por que hoje todos os cards acabam com `usr_thiago`?** Descoberta importante: quem grava o dono é o **navegador**, não o servidor.

- `listConversations` (`src/lib/crm/relationships.ts:138`) roda no navegador quando alguém abre o CRM. Para **cada** investidor ela chama `ensureOwnership(i)`.
- `ensureOwnership` (`src/lib/crm/ownership.ts:87`) usa `investor.assignedToUserId`, que em `executive-data.ts:184` é `lead.responsibleExecutiveId ?? fallbackExecutiveId`, e `fallbackExecutiveId = getDefaultExecutive()?.id ?? "usr_thiago"` (`executive-data.ts:99`) — o executivo padrão do workspace, hoje o Thiago.
- `writeAll` então chama `updateWorkspaceOperational` gravando `responsible_executive_id`, `ownership_origin` e `ownership_claimed_at = lastActivity` — por isso, no banco, `ownership_claimed_at` é **igual** ao `created_at` do lead, embora o registro tenha sido gravado horas depois.
- Prova nos dados: `crm_timeline` de `gs_58897` traz `relacionamento_oficial` com `owner_id = usr_thiago` em **02/09 14:25**, enquanto o card foi criado às **00:41** e a E0 foi bloqueada logo em seguida.

Ou seja: **a posse não é atribuída na entrada, é atribuída retroativamente quando um humano abre o CRM — e por um padrão de workspace, não pela conexão.** **CONFIRMADO NO CÓDIGO + CONFIRMADO NOS DADOS.**

## 6. DONO DO PORTAL x RESPONSÁVEL DO LEAD

| Entidade | Existe no modelo? | Onde |
|---|---|---|
| Executivo dono do Portal/ambiente | Sim, implícito | `crm_connections.user_id` (dono da conta GreenSales) |
| Executivo responsável pelo lead | Sim, explícito | `portal_leads.responsible_executive_id` |
| Usuário que executou a sincronização | Sim, só no manual | `context.userId` → `runLeadSync(actorUserId)`; perdido em seguida |
| Usuário que criou o card | **Não registrado** | `ensureWorkspaceCard` não grava autor |
| Unidade/franquia | **Não existe** | — |
| Workspace | Só como constante de configuração (`WORKSPACE.defaultExecutiveId`), não como tabela | `src/config/workspace.ts` |

O sistema **diferencia conceitualmente** dono da conta e responsável do lead, mas **não liga um ao outro em lugar nenhum**. No cenário atual — uma conexão, um dono — as três primeiras linhas apontam para a mesma pessoa (Thiago). Isso é uma coincidência de configuração, não uma garantia do modelo.

## 7. CASO REAL — leads do Thiago

Todos os cinco casos têm exatamente a mesma trajetória. Dados do banco:

| Card | Criado (GreenSales) | Dono hoje | `ownership_claimed_at` | `ownership_origin` |
|---|---|---|---|---|
| gs_58874 | 01/09 14:51 | usr_thiago | 01/09 14:51 | green_sales |
| gs_58877 | 01/09 16:00 | usr_thiago | 01/09 16:00 | green_sales |
| gs_58887 | 01/09 18:11 | usr_thiago | 01/09 18:11 | green_sales |
| gs_58893 | 01/09 22:02 | usr_thiago | 01/09 22:02 | green_sales |
| gs_58897 | 02/09 00:41 | usr_thiago | 02/09 00:41 | green_sales |

Reconstrução de `gs_58897`:

```text
GreenSales lead 58897 (athus)         payload sem qualquer campo de responsável
  → runLeadSync (cron), credenciais da conexão de Thiago (user 6005ef93…)
  → intakeLead: enteredNow = true, dentro da janela
  → recordEvent e0_identificada                       02/09 00:41
  → ensureWorkspaceCard → gs_58897, responsible_executive_id = NULL
  → registerFirstContact → dispatchFirstContact
       → resolveLeadDestinations → resolveLeadExecutive("gs_58897")
       → { available:false, reason:"Lead sem executivo responsável definido — envio bloqueado." }
  → recordEvent e0_ignorada                           02/09 00:41   ← única tentativa
  ...
  → alguém abre o CRM: listConversations → ensureOwnership → usr_thiago
  → crm_timeline 'relacionamento_oficial'             02/09 14:25   ← ~14h depois
  → nenhum processo reexamina a E0. Lead segue sem E0.
```

Note o detalhe que fecha o diagnóstico: `ownership_claimed_at` grava 00:41 (a hora do lead), mas o evento de timeline prova que a gravação real ocorreu às 14:25. O campo de posse **parece** contemporâneo à criação e não é.

## 8. TROCA DE RESPONSÁVEL

Caminhos que escrevem `responsible_executive_id` hoje:

| Caminho | Onde | Quem decide | Histórico |
|---|---|---|---|
| `assignPortalLeadOwner` | `portal-leads.functions.ts:336` | Gestora/Admin, escolha manual na UI | não grava evento no servidor |
| `redistributePortalLead` | `portal-leads.functions.ts:311` | Gestora/Admin; também muda `scope` para `redistribuicao` | não grava evento no servidor |
| `updateWorkspaceOperational` | `workspace-operational.functions.ts:49` | chamado pelo navegador via `ownership.ts` | grava `crm_timeline` do lado do cliente |
| `transferLeadOwnership` | `src/lib/crm/lead-transfer.ts` | cliente; grava timeline, auditoria e alerta operacional | sim, no cliente |
| `syncPortalLead` | `portal-leads.functions.ts:207/247` | preserva o dono atual (`current?.responsible_executive_id ??`) | — |

Respostas objetivas:
- **O card é atualizado?** Sim, é a mesma linha `portal_leads` — não existe card separado.
- **`responsible_executive_id` muda?** Sim, imediatamente.
- **GreenSales é consultada de novo?** NÃO. A origem não tem opinião sobre responsável e nunca sobrescreve o dono — `syncPortalLead` preserva explicitamente.
- **Existe histórico?** Parcial: `crm_timeline` e a auditoria são gravados pelos caminhos do cliente (`transferLeadOwnership`, `ownership.ts`); os dois server functions administrativos (`assign`, `redistribute`) mudam o dono **sem** registrar evento no servidor. **CONFIRMADO NO CÓDIGO.**
- **Função de reconciliação de posse?** NÃO ENCONTRADA. `runDailyReconciliation` trata presença do lead na origem (`lead_nao_localizado`), não responsável.
- Regra declarada no código: o primeiro vínculo é preservado; sincronizações nunca reatribuem.

## 9. MÚLTIPLOS EXECUTIVOS

Suporta, sim — mas a atribuição é **manual e posterior**.

- 7 executivos ativos em `executive_profiles`; visibilidade por `current_executive_id()` + `has_role`.
- **Workspace por executivo:** não existe.
- **GreenSales por executivo:** o modelo permite (uma linha de `crm_connections` por usuário), mas hoje **há apenas uma** conexão ativa, a do Thiago. Se um segundo executivo conectasse a própria conta, o cron passaria a usar "a conexão ativa mais recente" — sincronizando **uma só** conta por ciclo, de forma não determinística. Isso é um risco estrutural presente hoje, **CONFIRMADO NO CÓDIGO** (`resolveCredentials`, `order by updated_at desc limit 1`).
- **Distribuição automática:** NÃO ENCONTRADA.
- **Atribuição manual:** sim (transferência/redistribuição pela Gestora), mais o preenchimento retroativo pelo executivo padrão descrito no item 5.

## 10. RESPOSTA FINAL

**A. O Portal sabe quem é o executivo logado?** **SIM.** `auth.uid()` → `executive_profiles` → `current_executive_id()`. *CONFIRMADA NO CÓDIGO.*

**B. A sincronização automática sabe qual é o contexto do Portal/unidade?** **SIM, parcialmente.** Não existe "unidade", mas existe a conta de origem: a conexão GreenSales usada tem dono (`crm_connections.user_id`). *CONFIRMADA NO CÓDIGO + NOS DADOS.*

**C. No momento de `ensureWorkspaceCard`, existe informação suficiente para determinar o executivo?** **SIM.** No manual, dois caminhos (sessão + conexão); no cron, um (conexão). *CONFIRMADA NO CÓDIGO.*

**D. Por que `responsible_executive_id` fica NULL?** Porque o dado é descartado em dois pontos: `resolveCredentials` devolve só e-mail e senha, esquecendo o `user_id` da conexão; e `intakeLead` não recebe ator, chegando a `ensureWorkspaceCard`, que grava `null` literal. Não é falha de informação — é informação não propagada. *CONFIRMADA NO CÓDIGO.*

**E. Qual informação está faltando?** Nenhuma para o cenário de conta única. Para múltiplas contas faltaria uma regra explícita de qual conexão o cron sincroniza (hoje é "a mais recente"). *CONFIRMADA NO CÓDIGO.*

**F. Dá para corrigir usando uma relação Portal → executivo já existente, sem depender da GreenSales?** **SIM.** A relação `crm_connections.user_id → executive_profiles.executive_id` já existe, é server-side e vale nos dois modos. *CONFIRMADA NO CÓDIGO + NOS DADOS.*

**G. Risco de assumir "quem está logado = dono do lead"?**
- **Correto** quando o executivo sincroniza a própria conta GreenSales — o lead entrou pela conta dele.
- **Incorreto** quando: (i) a Gestora ou o Admin clicam em Sincronizar (o logado é a gestão, não o dono comercial); (ii) o cron roda, onde não há ninguém logado — "logado" simplesmente não existe; (iii) a conexão usada não pertence a quem clicou (o fallback de `resolveCredentials` permite usar a conexão de outro usuário).
- Por isso a fonte correta é **a conexão que trouxe o lead**, não a sessão. A sessão é o dado frágil; a conexão é o dado estável.

**H. No cron, qual seria a fonte de verdade correta?** O dono da conexão efetivamente usada na chamada — `crm_connections.user_id` → `executive_profiles.executive_id` — resolvido no servidor, no mesmo momento em que as credenciais são abertas. Nunca o `WORKSPACE.defaultExecutiveId` do navegador, que hoje faz esse papel por acidente.

**I. Ponto exato onde a responsabilidade deveria ser resolvida e não é:**
1. `resolveCredentials` (`src/server/crm/connections.server.ts:98`) — abre a conexão e descarta seu dono. **É aqui que a identidade se perde.**
2. `runLeadSync` (`src/server/crm/lead-sync.server.ts:54`) — tem `actorUserId`, usa só para credenciais, não repassa nada ao intake.
3. `intakeLead` (`src/server/crm/lead-intake.server.ts:62`) — assinatura sem ator.
4. `ensureWorkspaceCard` (`src/server/crm/workspace-card.server.ts:65`) — grava `responsible_executive_id: null`. **É aqui que a ausência vira fato.**

O responsável só aparece muito depois, em `ensureOwnership` (`src/lib/crm/ownership.ts:87`), **no navegador**, usando o executivo padrão. Entre (4) e esse momento existe a janela em que a única tentativa de E0 acontece e falha.

**J. Classificação consolidada**

| Conclusão | Classificação |
|---|---|
| Portal identifica o executivo logado via `executive_profiles`/`current_executive_id()` | CONFIRMADA NO CÓDIGO |
| Existe exatamente uma conexão GreenSales ativa, do Thiago | CONFIRMADA NOS DADOS |
| A conexão tem dono e está disponível em toda sincronização | CONFIRMADA NO CÓDIGO |
| `resolveCredentials` descarta o `user_id` da conexão | CONFIRMADA NO CÓDIGO |
| `intakeLead`/`ensureWorkspaceCard` não recebem ator; card nasce NULL | CONFIRMADA NO CÓDIGO |
| GreenSales não fornece campo de responsável lido pelo sistema | CONFIRMADA NO CÓDIGO |
| A posse é gravada retroativamente pelo navegador, com executivo padrão | CONFIRMADA NO CÓDIGO + NOS DADOS |
| Os 5 leads foram bloqueados na E0 e só depois ganharam dono | CONFIRMADA NOS DADOS |
| Não existe workspace/unidade/franquia como entidade | NÃO ENCONTRADA |
| Não existe distribuição automática nem reconciliação de posse | NÃO ENCONTRADA |
| `assign`/`redistribute` no servidor não gravam histórico próprio | CONFIRMADA NO CÓDIGO |
| Com duas conexões ativas, o cron escolheria a mais recente | CONFIRMADA NO CÓDIGO (efeito não observado — só há uma conexão) |
| Campos de responsável podem existir em `external_payload` sem serem lidos | POSSÍVEL, MAS NÃO COMPROVADA |

---

**Nada foi implementado, corrigido ou proposto como alteração de código.** Este documento é apenas o diagnóstico para a decisão de arquitetura.
