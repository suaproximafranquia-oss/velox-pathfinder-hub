# Validação Arquitetural — Motor de Relacionamento, Portal dos Leads e Remarketing

Nada foi alterado: sem migration, sem código, sem dados. Este documento é a validação pedida.

## 1. Confirmação das regras

Confirmo as 27 decisões. Os pontos que mudam a leitura anterior:

- **NOVOS é decidido pela COLUNA.** Qualquer outra tag de etapa do funil presente junto = o lead já existia = reengajamento, sem E0. Não há matriz de combinações.
- **Tags antigas nunca são removidas.** São histórico.
- **E20 é instância, não etapa fixa.** Nasce de uma ação humana ("GERAR E20") e pode nascer anos depois de um E30 encerrado, sem tocar o ciclo antigo.
- **E27 é derivado**: 7 dias corridos após a geração/envio da E20, deslocado para o próximo dia útil quando cair em fim de semana.
- **E20/E27/finalização são assistidos**, não automáticos pela Meta.
- **OPORTUNIDADE encerra a cadência**; AGENDAMENTO continua dentro dela.
- **Estado atual + histórico** sempre prevalecem sobre a foto de entrada.

## 2. Correções ao diagnóstico anterior (verificadas agora)

- **Telefone do executivo já existe em código**, não no banco: `src/lib/executive-auth.ts` tem `phone` e `whatsapp` por usuário, mas os 7 executivos oficiais estão **todos com o mesmo número `5517997727337`** e o dado vive no cadastro local, não em `executive_profiles`. Ou seja: o campo existe, a fonte confiável não. Antes de criar coluna nova, o caminho correto é levar esse cadastro para `executive_profiles` (uma coluna `phone`) e manter o código lendo de lá — sem duplicar em terceira tabela.
- **Já existe infraestrutura de link assinado**: `src/server/portal-token.server.ts` emite/valida token HMAC (hoje com TTL de 30 dias, vinculado ao investidor). O E20 não precisa de domínio novo — precisa de um TTL de 7 dias e de um slug por instância.
- **Já existem rotas curtas** `/e/$slug`, `/s/$slug`, `/f/$slug`, mas elas só **redirecionam para a Home** com contexto de executivo/marca; não gateiam conteúdo nem expiram. O E20 exige uma rota nova que valide a instância antes de liberar o conteúdo.
- **Reentrada (RE0–RE3)** vive em `src/lib/relationship/entry.ts`. Hoje `resolveEntryFlow` decide por `hasPreviousRelationship` + `newCommercialEntry` + `entryCount`. **Não** olha tags. A nova regra encaixa exatamente aqui: a checagem "NOVOS + outra tag de etapa" alimenta `hasPreviousRelationship = true`, e o fluxo `reentrada` já existente é reaproveitado — nenhuma lógica paralela nova.
- **`relationship_cadences` tem 1 linha por lead** (sem coluna de instância/ciclo). É o único bloqueio real para o E20 recorrente.

## 3. Matriz REGRA → LOCAL ATUAL → ALTERAÇÃO → DEPENDÊNCIA → RISCO

| # | Regra | Local atual | Alteração | Dependência | Risco |
|---|---|---|---|---|---|
| 18/20 | Não gravar "sincronizado — sem alterações" | `src/server/crm/lead-service.server.ts` (ramo `else if (!changed)` grava `lead_sincronizado`) | Só atualizar `last_synced_at`; classificar eventos em REAL x TÉCNICO | `crm_lead_events` | Baixo — evento puramente informativo |
| 19 | PENDENTE real | `crm_leads.sync_status` + fila de E0 adiada (`first-contact-queue.server.ts`) | Pendente só enquanto em NOVOS e não processado; limpar ao sair | Board, contadores | Baixo |
| 1 | NOVOS + outra tag = reengajamento | `src/lib/crm/board.ts` (`resolveBoardColumn`), `src/server/crm/lead-intake.server.ts` | Função pura nova (coluna=entrada **e** existe outra coluna reconhecida em `matched`); aplicada **só** no intake, antes de `registerFirstContact` | `crm_pipeline_stages` | Médio — `board.ts` alimenta o Kanban inteiro; por isso a decisão fica fora dele |
| 3 | Reengajamento reusa RE0–RE3 | `src/lib/relationship/entry.ts` | Alimentar `hasPreviousRelationship`/`newCommercialEntry` com o sinal de tags; sem novo fluxo | `machine.ts`, `decide.ts` | Baixo |
| 9 | Sem "Reenviar boas-vindas" | `src/components/crm/portal-leads-board.tsx`, composer em `crm-conversation.tsx` | Remover reenvio e o seletor de templates de cadência; **manter** composer humano e Central de Templates para conversa na janela | `crm_meta_templates` | Baixo |
| 10/24 | OPORTUNIDADE encerra | `lead-service.server.ts` (mudança de `stage_key`), `relationship_queue`, `machine.ts` | Ao entrar em OPORTUNIDADE/COF: fechar instância ativa, cancelar itens PENDING | Fila de ligações (já ignora a etapa) | Médio — etapa errada vinda da origem silenciaria lead legítimo; mitigar com log e reversão ao sair |
| 11 | AGENDAMENTO segue em cadência | `src/lib/crm/cadence.ts` (`ELIGIBLE_STAGE_KEYS`), `machine.ts` | Incluir agendamento nas etapas elegíveis; nunca rebaixar para FRIO automaticamente | Fila de ligações | Médio — muda volume das AÇÕES DO DIA |
| 4/12/14 | E20 como instância | `relationship_cadences` (1 linha/lead) | Nova tabela de **instâncias** (`origem`, `started_at`, `deadline_at`, `closed_at`, `close_reason`) + estado atual migrado como instância 1 | `relationship_events`, `relationship_queue` | Alto — é a mudança estrutural central; feita de forma aditiva |
| 12 | Ação GERAR E20 no card | `portal-leads-board.tsx`, `crm-lead-ficha.tsx` | Botão no card → cria instância, link 7 dias, mensagem pronta para copiar | Instâncias, biblioteca | Baixo |
| 7 | Link E20 com 7 dias | `portal-token.server.ts`, rotas `/e|/s|/f/$slug` | TTL por instância + rota nova que valida antes de liberar; página "link expirado"; conteúdo não acessível pelo Portal sem link válido | Portal do Investidor | Médio — não pode quebrar os links atuais de 30 dias |
| 13/5 | E27 derivado, assistido | `src/lib/relationship/calendar.ts` (dias úteis), AÇÕES DO DIA | +7 dias corridos da E20, empurrado para dia útil; entra como ação assistida | Instâncias | Baixo |
| 8/17 | Versão da mensagem congelada | `messages.ts` (textos fixos), `crm_meta_templates` + `relationship_template_bindings.version` | Snapshot do texto renderizado + `template_id` + `version` no evento de envio | Biblioteca | Médio — exige mapa completo antes (item 17) |
| 8/26 | Jornada consolidada x Notas | `crm_lead_events`, `crm_messages`, `crm_timeline`, `relationship_events`, `portal_journey_events` | Leitura consolidada (view/serverfn) ordenada; nota manual como tipo próprio; prévia com "…" e card para mensagens longas | Nenhuma escrita nova | Baixo — só leitura |
| 2 | Remarketing na jornada | `src/server/remarketing/*`, `remarketing_messages` | Projetar envios de remarketing na leitura consolidada por telefone normalizado; sem duplicar a pessoa | Dedup por telefone | Baixo |
| 6 | Botão "Falar com o Executivo" | `executive-auth.ts` (telefones iguais), `executive_profiles` | Coluna `phone` em `executive_profiles`; cada executivo edita no perfil; botão resolve pelo responsável | Perfil do executivo | Baixo |
| 15 | Edição manual com prioridade | `lead-service.server.ts` (upsert sobrescreve) | Marcar campos travados (nome/telefone) e não sobrescrever no sync; registrar a edição | `crm_leads`, `portal_leads` | Médio — não pode travar correções legítimas da origem |
| 16 | Só primeiro nome | `src/lib/relationship/names.ts` | Derivar primeiro nome do cadastro corrigido (respeitando o campo travado) | Item 15 | Baixo |
| 23 | Estado atual + histórico | `board.ts`, `machine.ts` | Decisão sempre pelo par (coluna atual, histórico de instâncias) | Instâncias | Médio |

## 4. Conflitos entre o que existe e o que foi definido

1. **`board.ts` prioriza a coluna mais avançada.** Um lead com NOVOS + OPORTUNIDADES aparece hoje em OPORTUNIDADES. Isso é compatível com a regra 1 (ele não é novo), mas o Kanban pode não ser onde você espera vê-lo.
2. **`ELIGIBLE_STAGE_KEYS` hoje é só `zero_contato` e `frio`** — AGENDAMENTO está fora da fila de ligações, contra a regra 11.
3. **RE0–RE3 exige "nova entrada comercial"** (`entry_count`/`last_entry_at`). Um recadastro que a origem não marque como nova entrada hoje não vira reentrada; a regra de tags resolve isso.
4. **Uma linha de cadência por lead** impede E20 recorrente sem sobrescrever histórico.
5. **Textos de etapa fixos em `messages.ts`** convivem com a biblioteca e com `crm_meta_templates` — três lugares para uma mesma verdade.
6. **Link atual não expira em 7 dias nem gateia conteúdo.**
7. **Telefone do executivo é o mesmo para todos** no cadastro atual.

## 5. Pontos ainda ambíguos

1. **Kanban do reengajamento**: um lead NOVOS + OPORTUNIDADES deve aparecer em qual coluna? Hoje: OPORTUNIDADES.
2. **Reengajamento é automático ou assistido?** RE0 hoje é envio do motor. Você quer que ele siga automático ou entre nas AÇÕES DO DIA?
3. **E20 durante cadência ativa**: pausa a cadência corrente ou as duas convivem?
4. **Quem pode gerar E20** — qualquer executivo responsável, ou só gestão?
5. **Após expirar o link**, o lead que já tinha acessado deve perder o acesso imediatamente ou terminar a sessão em curso?
6. **Edição manual**: nome e telefone ficam travados para sempre, ou existe um botão "voltar a seguir a origem"?
7. **Item 17 (biblioteca)**: quer o mapa completo (texto, etapa, vídeo, onde vive) como entregável separado antes da FASE 3?

## 6. Ordem técnica de implementação

Aceito sua ordem, com uma inserção: o **mapa da biblioteca (item 17)** é diagnóstico e pode sair junto da FASE 1, porque a FASE 3 depende dele.

- **FASE 0 (diagnóstico, sem código)**: inventário da biblioteca — cada mensagem, onde vive (código / `relationship_contents` / `crm_meta_templates`), qual etapa usa, quais vídeos estão associados.
- **FASE 1**: eventos falsos de sincronização, PENDENTE real, regra NOVOS+tag no intake, remoção do reenvio de E0, AGENDAMENTO elegível. Só código e leitura — nenhuma perda de dado.
- **FASE 2**: instâncias de cadência (aditivo; estado atual vira instância 1), encerramento por OPORTUNIDADE, GERAR E20 no card, E27 derivado, link de 7 dias com página de expirado.
- **FASE 3**: biblioteca reorganizada e versionada, snapshot do texto enviado, jornada consolidada com prévia/expansão, notas do executivo.
- **FASE 4**: remarketing projetado na jornada, telefone por executivo, botão dinâmico, resposta automática na janela de 24h.

## 7. Preservação

Toda estrutura nova é aditiva: colunas com default, tabelas novas, e o estado atual de cada lead vira a instância 1. Nada é apagado, nada é migrado destrutivamente. Os eventos técnicos já gravados permanecem — apenas param de ser produzidos e passam a ser filtrados na leitura.
