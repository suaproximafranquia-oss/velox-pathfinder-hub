# Semântica definitiva do estado NOVO no Workspace

Somente análise e definição de regra. Nada foi implementado, nenhum dado ou schema alterado.

## A) Regra definitiva (confirmada)

A regra que você descreveu é exatamente a que o código pretende aplicar hoje (`resolveLeadState`, `src/lib/lead-state.ts` linhas 61–69), na seguinte ordem de precedência:

1. `closed_at` preenchido -> **ENCERRADO** (só por ação manual no menu ⋮).
2. `viewed_at` vazio -> **NOVO** (nunca visualizado).
3. `lastActivity > viewed_at` -> **NOVO novamente** (nova atividade real do investidor após a visualização).
4. Caso contrário -> **EM ANDAMENTO**.

Portanto "NOVO" é **fila/classificação derivada**, não um status armazenado. Ajuste semântico único recomendado: item 3 deve considerar **exclusivamente atividade do investidor**; hoje entram na conta timestamps escritos por rotinas administrativas e de sincronização (ver C).

## B) Deve contar como atividade do investidor

Escrevem `last_activity_at`/alimentam `lastActivity` e são legítimos:

| Onde | Função | Quem executa | Evento |
|---|---|---|---|
| `src/lib/portal-access.functions.ts:162` | `recordPortalProgress` (token assinado) | navegador do investidor | acesso ao Portal, capítulo, módulo, conclusão |
| `src/lib/leads.ts:418-420` | criação do lead -> `pushLead({ lastActivityAt: createdAt })` | investidor | entrada/cadastro |
| `src/lib/crm/lead-intake.ts:145` | entrada de lead pelo canal | investidor | nova entrada |
| `src/lib/portal-leads.functions.ts:219-256` | `syncPortalLead` com `lastActivityAt` informado | investidor | retorno/reconhecimento (já protegido: nunca retrocede e só avança com atividade informada) |
| `public.resolve_portal_identity` (banco) | reconhecimento de identidade | investidor no Portal | retorno do lead |
| Eventos do bus em `executive-data.ts:154-159` | `journey.*`, `manual.*`, `simulator.completed`, `profile.interests.captured`, `ai.query.answered` | investidor | leitura, simulador, IA |

Somam-se ainda respostas do investidor no WhatsApp (`last_inbound_at`), hoje **não** consideradas em `lastActivity` — deveriam contar.

## C) NÃO deve contar (e hoje alguns contam)

| Onde | Função | Natureza | Situação atual |
|---|---|---|---|
| `src/lib/portal-leads.functions.ts:311` | `redistributePortalLead` | administrativa | **grava `last_activity_at = now()` — incorreto** |
| `src/lib/portal-leads.functions.ts:335` | `assignPortalLeadOwner` | administrativa | **grava `last_activity_at = now()` — incorreto** |
| `src/server/crm/workspace-card.server.ts:70` | criação do card a partir do CRM/GreenSales | sincronização | usa `externalUpdatedAt` da origem; uma edição administrativa no GreenSales reclassifica o lead como NOVO |
| `src/lib/greensales-sync.functions.ts:135` | importação GreenSales | sincronização | usa `updated_at` externo — mesmo efeito |
| `src/lib/portal-leads.functions.ts:152` e `:182` | ramos de deduplicação e de escopo `redistribuicao` do `syncPortalLead` | sincronização | fazem `?? now()` sem passar pela trava do ramo principal |
| `src/lib/lead-state.ts` (`markLeadViewed`, `closeLead`, `reopenLead`) | abrir/encerrar card | administrativa | correto: escreve só `viewed_at`/`closed_at`; o evento `lead.status.changed` é emitido, mas já é filtrado em `executive-data.ts:113` e nenhum listener recalcula status a partir dele |
| polling/realtime/refresh (`pullLeads`, `subscribeLeads`) | espelho do servidor | técnica | correto: não escreve nada |

## D) Regra correta para a Gestora (decisão necessária)

Hoje, política de UPDATE de `portal_leads`: apenas `admin` ou o executivo responsável. A Gestora (`manager`) **vê** o lead (SELECT permite `manager` para qualquer lead com responsável) mas **não consegue gravar** `viewed_at`/`closed_at` — o UPDATE atinge 0 linhas, sem erro, e o estado volta para NOVO no próximo refresh.

Regra proposta: a Gestora pode gravar **somente campos operacionais** (`viewed_at`, `closed_at`, `notes`) dos leads que já enxerga, sem poder alterar identidade, proprietário, escopo ou dados comerciais. Implementação típica: função `SECURITY DEFINER` restrita a esses campos (a política de UPDATE por coluna não existe em RLS de forma direta), mantendo a política atual intacta para os demais campos.

Alternativa: manter a Gestora sem escrita e, nesse caso, a interface precisa **não oferecer** a marcação de visualizado para ela, em vez de fingir sucesso.

Semântica de `viewed_at`: hoje é sobrescrito a cada abertura, ou seja, **última visualização**, e é justamente isso que a regra 3 exige (comparação com a última atividade). Recomendação: manter "última visualização" e, se houver necessidade de auditoria de primeira abertura, registrar em evento separado — nunca substituir a semântica atual.

## E) Regra correta para redistribuição/transferência

Deve: alterar proprietário, registrar evento administrativo e auditoria, e carimbar o horário **no evento administrativo**. Não deve: tocar `last_activity_at`, `viewed_at` ou `closed_at`. Consequência prática: o lead transferido continua "em andamento" para o novo responsável a menos que exista atividade real do investidor.

## F) Mapa completo dos escritores dos campos

- `viewed_at`: `src/lib/lead-state.ts` (`markLeadViewed`) -> `src/lib/workspace-operational.functions.ts` (única gravação de produção); `src/server/testing/test-lab.server.ts:254` (laboratório de testes).
- `closed_at` (em `portal_leads`): `src/lib/lead-state.ts` (`closeLead`/`reopenLead`) -> `workspace-operational.functions.ts`. Outras ocorrências de `closed_at` no repositório pertencem a `relationship_e20_occurrences` e `crm_*` — tabelas distintas, sem relação com o badge.
- `last_activity_at`: os sete pontos listados em B e C.
- `lead.status.changed`: emitido só em `src/lib/lead-state.ts` (3 pontos). Consumidores: `executive-data.ts` (filtra), `workspace-alerts.ts:573` (alerta), `investor-profile.ts:48` e `executive-data.ts:213` (rótulos), listeners de card/ficha (apenas reexecutam `resolveLeadState`). Nenhum consumidor grava status.
- `lastActivity` (derivado): calculado apenas em `src/lib/executive-data.ts:154-159`.

## G) Correção mínima (quando autorizada)

1. Remover `last_activity_at` de `redistributePortalLead` e `assignPortalLeadOwner`.
2. Não usar `now()` como atividade nos ramos de dedupe/escopo `redistribuicao` do `syncPortalLead`; aplicar a mesma trava "só avança com atividade informada" do ramo principal.
3. Confirmar a gravação de `viewed_at`/`closed_at`: `updateWorkspaceOperational` retorna linhas afetadas; `persist()` só atualiza o cache após confirmação e sinaliza falha (sem `.catch` silencioso).
4. Decidir e aplicar a regra da Gestora (D) — via função `SECURITY DEFINER` limitada a campos operacionais, se a resposta for "sim".
5. Opcional: passar a considerar `last_inbound_at` (resposta do investidor) em `lastActivity`.
6. Avaliar se a sincronização GreenSales deve usar o `updated_at` externo como atividade do investidor ou apenas como marca de sincronização.

## H) Arquivos que seriam alterados

`src/lib/portal-leads.functions.ts`, `src/lib/lead-state.ts`, `src/lib/workspace-operational.functions.ts`, eventualmente `src/lib/executive-data.ts` (inclusão de `last_inbound_at`), `src/server/crm/workspace-card.server.ts` e `src/lib/greensales-sync.functions.ts`, mais uma migration apenas se a regra da Gestora for aprovada.

## I) Permanece intocado

Portal dos Leads, Bloco 2 de identidade e `resolve_portal_identity`, cadência/motor de relacionamento, CRM, Remarketing, Backup, dados existentes, blindagem contra exclusão, e a semântica de `lastActivity` como atividade exclusiva do investidor.

## Confirmações que preciso de você antes de qualquer implementação

1. A Gestora pode marcar visualizado/encerrar leads que enxerga (somente campos operacionais)? Sim ou não.
2. Atualização no GreenSales (edição feita por pessoa da equipe lá) conta como atividade do investidor? Presumo que **não**.
3. Resposta do investidor no WhatsApp (`last_inbound_at`) deve reclassificar o lead como NOVO? Presumo que **sim**.
