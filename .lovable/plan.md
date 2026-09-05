# Auditoria técnica — Financeira /f após o BLOCO 2

Somente leitura. Nada foi construído, alterado, migrado ou executado.

## 1. vendedor_id — estado atual

- A origem entrega o campo: `src/server/greensales.server.ts:41` → `vendedor_id?: number | null` (numérico na origem).
- O projeto extrai o valor sem suposições em `greenSalesVendorId(raw)` (`src/server/crm/responsible.server.ts:54`), aceitando `vendedor_id` direto ou aninhado em `vendedor.id`, sempre convertido para **texto**.
- Armazenamento do vínculo: coluna **`executive_profiles.greensales_vendor_id` (text)**, criada na migration do Bloco 2, com índice único parcial (`WHERE greensales_vendor_id IS NOT NULL`).
- Existe vínculo direto GreenSales → executivo interno? **Sim, estruturalmente**: `executive_profiles.greensales_vendor_id` → `executive_profiles.executive_id`.
- ⚠️ INCONSISTÊNCIA OPERACIONAL: a coluna está **100% vazia**. Consulta atual em `executive_profiles`: Carlos, Larissa, Marton, Milton, Paulo, Talita, Thiago Rodrigues — todos com `greensales_vendor_id = NULL` e `slug = NULL`. Ou seja, o Bloco 2 criou a estrutura, mas o cadastro que a alimenta ainda não existe. Na prática, hoje `resolveResponsibleByVendorId` sempre devolve `null` e o sistema recai no comportamento anterior.

## 2. Mapa de IDs

- `executive_profiles.executive_id` — texto legível, padrão `usr_<nome>` (`usr_thiago`, `usr_carlos`, `usr_marton`, `usr_paulo`, `usr_larissa`, `usr_milton`, `usr_talita`). É o ID interno usado por cards, E0, cadência e histórico.
- `executive_profiles.user_id` — UUID de autenticação (todos os 7 possuem). Ligação com o login.
- `executive_profiles.slug` — link personalizado do Portal; atualmente NULL para todos.
- `executive_profiles.greensales_vendor_id` — código do vendedor **na origem**; hoje NULL para todos.
- `crm_connections.user_id` — dono da conexão de sincronização (caminho técnico, não é o responsável do lead).
- `portal_leads.responsible_executive_id` / `responsible_executive_slug` — responsável operacional atual do card.
- `investors.id` + `investor_identifiers(source, external_id)` — identidade canônica da pessoa, independente do executivo.

Não há igualdade numérica implícita entre `vendedor_id` e nenhum ID interno: a correspondência só existe se cadastrada explicitamente na coluna acima.

## 3. Resolução de responsável

Cadeia atual em `src/server/crm/lead-intake.server.ts`:

1. Linha 155 — entrada GreenSales: `resolveResponsibleByVendorId(greenSalesVendorId(raw))` (fonte: origem).
2. Linha 241 — fallback: `resolveResponsibleByUserId(context.connectionUserId)` (dono da conexão que rodou a sincronização).
3. Sem nenhum dos dois: o card nasce **sem responsável** — nada é inventado, nenhum lead cai automaticamente para Thiago.

Portanto o Bloco 2 **passou a usar `vendedor_id` na prática no código**, mas o efeito real hoje é nulo por falta de cadastro (ver item 1).

## 4. Gestão de Usuários

- Tela: `/f/executivo/usuarios` (`src/routes/f.executivo.usuarios.tsx`; a rota antiga `/executivo/usuarios` só redireciona).
- Persistência: `src/server/executive-auth.server.ts` faz `upsert` em `executive_profiles` com `user_id, executive_id, email, name` (onConflict `user_id`).
- **Não existe hoje** campo para o Admin informar o `vendedor_id` do GreenSales.
- Local tecnicamente coerente para o vínculo: o próprio formulário de criação/edição do executivo, gravando na coluna já existente `executive_profiles.greensales_vendor_id`. Não é necessária segunda tabela de usuários.

## 5. Redistribuição do Bloco 2 (`src/server/crm/ownership.server.ts`)

- A) Mudança detectada quando `responsável atual do card ≠ responsável informado pela origem` (linhas 104-108).
- B) Responsável anterior: `readCardResponsible(cardId)` → `portal_leads.responsible_executive_id`.
- C) Novo responsável: exclusivamente `originResponsible` (vindo do `vendedor_id`).
- D) Origem da mudança: registrada como `source = 'greensales_sync'` e só é chamada quando `isGreenSalesEntry`.
- E) `lead_ownership_history` recebe card, lead, investidor canônico, anterior/novo, sequência, origem, evento, ciclo, contato real, se gerou nova entrada, motivo e `change_key`.
- F) Idempotência: `change_key = card|anterior|novo|seq` com índice único; erro `23505` é tratado como "já registrado".
- G) `ownership_seq` = contagem do histórico + 1; é passado à nova E0 (`ownershipSeq`/`ownershipKey = own<seq>`).
- H) `hasRealHumanContact({leadId, crmLeadId})` é consultado antes de qualquer nova entrada — autoridade única do Bloco 1.
- I) Ciclo: nenhum ciclo novo é criado aqui; o ciclo ativo é apenas **lido** (`activeCycleId`) para registro. A nova entrada é representada pela chave de titularidade.
- J) E0 nova só é criada quando **não há contato humano real**; manual via `createPendingE0Action`, automática via `registerFirstContact` com `cycleKey`.
- K) Sim — o modo vem sempre de `resolveExecutiveE0Mode(next)`, do NOVO responsável.

## 6. Ponto crítico — origem x executor da sincronização

Hoje **existe diferença clara**: a redistribuição só é acionada com `originResponsible` resolvido pelo `vendedor_id` (linha 91-97 aborta sem ele). O `connectionUserId` nunca alimenta `applyOriginResponsibleChange` — ele só serve de fallback para cards que nascem sem dono (linha 241). Logo, "A → B" só é detectado porque o GreenSales passou a informar B.

⚠️ Ressalva: enquanto `greensales_vendor_id` estiver vazio, nenhuma redistribuição jamais será detectada.

## 7. ZERO CONTATO / NOVOS

A redistribuição **não consulta, não depende e não é bloqueada** por ZERO CONTATO nem por NOVOS. A única condição é mudança de responsável + `hasRealHumanContact`. (As referências a ZERO CONTATO vivem em cadência/board, fora deste caminho.)

## 8. E0 por ciclo — `workspace_e0_actions`

- O UNIQUE simples em `card_id` foi **removido**; passou a valer o índice único `(card_id, ownership_seq)`.
- `ownership_seq` default 0 = entrada histórica preservada; N>0 = nova titularidade.
- `ownership_key` transporta `own<seq>` até o `cycleKey` da E0, evitando colisão com a trava `msg_e0_<cardId>`.
- Uma segunda E0 legítima coexiste com a histórica porque muda a sequência.
- Risco residual: se a chave de mensagem não for propagada em algum caminho de E0 automática, a trava antiga ainda poderia barrar — vale verificação dirigida antes de operar redistribuição real.

## 9. Identidade canônica

- Função única: `resolveOrCreateInvestor` (`src/server/crm/identity.server.ts`), com regras puras em `src/lib/crm/identity.ts`.
- Prioridade: telefone normalizado (`p:<dígitos>`), depois e-mail (`e:<email>`); nome nunca funde sozinho.
- Conflito (mesmo telefone, nomes incompatíveis): cria investidor separado sem chave e registra `identidade_conflito`; nunca funde nem bloqueia o lead.
- `canonical_investor_id` é gravado em `crm_leads` e `portal_leads` **somente quando nulo**; o card nunca é trocado, fundido ou apagado.

## 10. Migrations do Bloco 2

Uma única: `20260905021512_77d40d78-...sql`, estritamente aditiva.
- `executive_profiles`: + `greensales_vendor_id` (text) + índice único parcial.
- `lead_ownership_history`: nova tabela append-only, com GRANTs, RLS (leitura admin/manager via `has_role`), trigger de `updated_at`, único em `change_key`, índices por card/sequência e por investidor.
- `workspace_e0_actions`: + `ownership_seq`, + `ownership_key`, remoção do UNIQUE de `card_id`, criação do único `(card_id, ownership_seq)`.

## 11. Backup

`lead_ownership_history` **já está incluída** na captura (`src/server/backup.server.ts:64`, pk `id`). `workspace_e0_actions` permanece protegida contra restauração.

## 12. Isolamento

Todas as alterações do Bloco 2 estão em `src/server/crm/*`, `src/lib/crm/identity.ts` e `src/server/backup.server.ts`, sempre condicionadas a entrada GreenSales. Nada em `/s`, `/seg` ou `/`. Portal, TikTok e Meta seguem o caminho anterior. Safety Lock intocada.

## 13. Pendências reais

1. Cadastro dos `vendedor_id` do GreenSales para os 7 executivos (sem isso o Bloco 2 é inerte).
2. Campo de cadastro na Gestão de Usuários e persistência no `upsert` do servidor.
3. `slug` vazio para todos os executivos — impacta link personalizado, já sinalizado em regra anterior.
4. Verificação dirigida da propagação do `cycleKey` nas E0 automáticas de redistribuição.
5. Nenhuma linha em `lead_ownership_history` — o caminho ainda não foi exercitado.

## 14. Conclusão

✅ BLOCO 2 COERENTE no código e no schema — com ⚠️ INCONSISTÊNCIA de ativação: a estrutura existe, mas o dado que a liga ao GreenSales ainda não foi cadastrado, então nenhuma redistribuição pode ocorrer hoje.

## 15. Recomendação do próximo bloco

BLOCO 3 — "Ativação do vínculo de origem": expor `greensales_vendor_id` na Gestão de Usuários (leitura/gravação na coluna já existente), permitir o cadastro pelo Admin e, só depois, validar a redistribuição com um lead fictício de lote de teste. Nenhuma nova tabela.
