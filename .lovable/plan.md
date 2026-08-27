# Auditoria — Leads trabalhados voltando para "NOVO"

Somente diagnóstico. Nada foi alterado no código, no banco ou nos dados.

## A) Origem real do "NOVO"

"NOVO" **não existe como valor armazenado**. É uma classificação calculada em tempo de execução por `resolveLeadState()` em `src/lib/lead-state.ts`:

```text
portal_leads (banco)
  -> listPortalLeads()            src/lib/portal-leads.functions.ts  (select *)
  -> pullLeads() / toLocal()      src/lib/portal-leads-sync.ts       (espelha em localStorage)
  -> loadLeads()                  src/lib/leads.ts                   (cache do navegador)
  -> listAllInvestors()           src/lib/executive-data.ts          (calcula lastActivity)
  -> resolveLeadState()           src/lib/lead-state.ts              -> "novo"
  -> investor-card.tsx / investor-profile-view.tsx  (badge)
```

Condição exata (linhas 61–69 de `lead-state.ts`):

1. `closedAt` preenchido -> `encerrado`;
2. senão, **`viewedAt` ausente -> `novo`**;
3. senão, `lastActivity > viewedAt` -> `novo`;
4. senão -> `em_andamento`.

## B) Campo/tabela responsável

`public.portal_leads.viewed_at` (e `closed_at`). Não há coluna `status`. `lastActivity` é derivado em `executive-data.ts` (linhas 154–159) do maior valor entre `created_at`, `last_activity_at`, `journey_last_event_at` e eventos locais do bus (já com `lead.status.changed` filtrado — linha 111).

## C) Função que grava

`markLeadViewed()` -> `persist()` -> `patchCachedLead()` (cache) + `updateWorkspaceOperational()` (`src/lib/workspace-operational.functions.ts`), que faz `context.supabase.from("portal_leads").update({ viewed_at })` **como o usuário autenticado** (RLS aplicada).

## D) Momento exato do retorno

Na próxima leitura autoritativa: `pullLeads()` executa `replaceLeads(remote)` (substituição integral do cache). Se `viewed_at` não foi realmente gravado no servidor, o cache otimista é descartado e o badge volta a "NOVO" — normalmente ao reabrir o Workspace, na troca de aba, no realtime ou no polling.

## E) Onde está o problema

Não é o banco "voltando" para novo, e não é o localStorage por si só. É **falha silenciosa de gravação por RLS**, com a interface exibindo um estado otimista que depois é revertido.

## F) Evidência técnica

1. Política de UPDATE em `portal_leads`:
   `has_role(auth.uid(),'admin') OR (responsible_executive_id = current_executive_id())`.
   **A Gestora (`manager`) tem SELECT, mas NÃO tem UPDATE.** Ela enxerga o card, abre, marca como visto — e o UPDATE atinge 0 linhas.
2. Um UPDATE bloqueado por RLS **não retorna erro**: afeta 0 linhas. Em `lead-state.ts` linha 53–56 o `.then(...)` é tratado como sucesso e o `.catch(() => undefined)` engoliria qualquer erro remanescente. Nada é registrado nem reexibido ao usuário.
3. Estado atual do banco: 52 leads, **52 com `viewed_at` preenchido** e **0 com atividade posterior ao `viewed_at`** — ou seja, hoje nenhum lead deveria aparecer como NOVO por regra de atividade. O que sobra como causa é (a) cache ainda não hidratado/gravação não persistida e (b) usuários sem permissão de UPDATE.
4. Vetor secundário confirmado no código: `redistributePortalLead` e `assignPortalLeadOwner` (`portal-leads.functions.ts`) escrevem `last_activity_at = now()` em uma **ação do executivo**. Isso empurra `lastActivity` para depois de `viewed_at` e reclassifica o lead como NOVO pela regra 3. Hoje não há caso ativo no banco, mas a regra existe e pode reproduzir o sintoma a cada transferência/redistribuição.
5. `lead.status.changed` continua sendo emitido na origem (`markLeadViewed`, `closeLead`, `reopenLead`), mas a correção aplicada foi **excluí-lo do cálculo de `lastActivity`** em `executive-data.ts` (linha 111). Nenhum listener recalcula status a partir dele: os listeners (`onLeadStateChange` em `investor-card.tsx` e `investor-profile-view.tsx`) apenas reexecutam `resolveLeadState`, que relê o cache. Portanto o evento não é a causa — mas ele é justamente o gatilho que revela o cache revertido.
6. Cache: `replaceLeads()` é substituição total pelo retorno do servidor; `toLocal()` mapeia `viewed_at` corretamente e não aplica fallback do tipo `status ?? 'NOVO'`. Não há reconstrução parcial de lead nesse caminho.

## G) Se confirmado o bug, o que precisaria mudar (não fazer agora)

- `src/lib/lead-state.ts` — `persist()`: verificar o resultado real da gravação (linhas afetadas) e sinalizar falha em vez de silenciar; só atualizar o cache após confirmação.
- `src/lib/workspace-operational.functions.ts` — retornar a contagem de linhas afetadas para distinguir "gravado" de "bloqueado".
- Política de UPDATE de `portal_leads` — decidir se `manager` pode gravar campos operacionais (`viewed_at`/`closed_at`) dos leads que já enxerga.
- `redistributePortalLead` / `assignPortalLeadOwner` — parar de escrever `last_activity_at` em ação do executivo (atividade é do investidor).

## H) O que NÃO deve ser alterado

Portal dos Leads, identidade (Bloco 2), cadência/motor de relacionamento, CRM, Backup, dados existentes, e a semântica de `lastActivity` como atividade real do investidor. Nenhuma migration destrutiva; nenhuma alteração de status de lead.

## Caso concreto

Não há hoje, no banco, nenhum lead em estado inconsistente (`viewed_at` nulo ou atividade posterior). Para fechar o caso com fotografia antes/depois é necessário o `investorId` e o usuário (perfil) que observou o retorno para "NOVO" — a hipótese principal prevê que o observador seja um perfil **Gestora/manager** ou um lead aberto logo após redistribuição/transferência.
