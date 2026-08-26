# Diagnóstico Arquitetural — Motor de Relacionamento Velox

Análise apenas. Nada implementado, nenhuma migration, nenhum dado tocado.

## 1. Entendi as regras — resumo do que li

Sim. O núcleo é: **coluna decide posição, tags decidem histórico**; E0 é a única mensagem automática de entrada; recadastro com tag antiga = reengajamento, nunca E0; E20 é um **evento gerador de instância** (não um dia); OPORTUNIDADE encerra a cadência; a jornada precisa ser única entre Portal, Workspace e Remarketing; e a mensagem enviada precisa ficar congelada em versão, mesmo quando a biblioteca mudar.

## 2. Estado atual verificado

### Já existe e deve ser preservado
- **Identidade**: `crm_leads.external_source + external_id` (ID do GreenSales). Nome nunca é chave. Dedup extra por telefone normalizado. Card do Workspace nasce como `gs_<external_id>`.
- **Coluna x tag já são separadas**: `src/lib/crm/board.ts` resolve a coluna pelas etiquetas que **são colunas do funil** (`crm_pipeline_stages.external_tag`); etiquetas avulsas ficam preservadas em `crm_leads.tags` sem interferir.
- **E0 automática** já é disparada só na **transição real** para a coluna de entrada (`entered_entry_stage_at`), com janela operacional, fila de adiadas e chave idempotente `msg_e0_<leadId>`. Hoje em modo simulado.
- **Janela de 24h** já é real: `relationship_cadences.window_open_until`, aberta por mensagem recebida em `machine.ts`.
- **Motor com estado, fila e auditoria**: `relationship_cadences`, `relationship_queue`, `relationship_events`, `relationship_decisions`.
- **Fluxos de reentrada já existem**: `reentrada` (RE0–RE3) e `relacionamento_frio` (RF0/RF1) em `entry.ts`.
- **Biblioteca de Conteúdos** já é central (`relationship_contents`, `/executivo/biblioteca`) e o motor consome dela por **grupo/finalidade**, não por texto fixo.
- **Blindagem dos leads** (triggers contra DELETE/TRUNCATE) e `portal_lead_guard_log`.

### Parcialmente implementado
- **Reengajamento**: a decisão hoje usa `hasPreviousRelationship` + `entry_count`/`last_entry_at`, e a etiqueta REMARKETING. **Não** olha "tem outra tag de etapa do funil". É onde sua regra entra.
- **Biblioteca de mensagens**: conteúdos são centralizados, mas os **textos das etapas** de homologação estão fixos em `src/lib/relationship/messages.ts`, e os oficiais vivem em `crm_meta_templates` com `relationship_template_bindings` (que já tem coluna `version`). Ou seja: existe o esqueleto de versionamento, mas não a edição versionada nem o congelamento do texto enviado.
- **Notas / jornada**: existem `crm_lead_events`, `crm_timeline`, `crm_messages`, `relationship_events` — quatro trilhas, sem uma leitura unificada. A aba "Notas do Executivo" existe em `investor-profile-view.tsx`.
- **Encerramento**: existe terminal por etapa (E12/E30) e estados `COMPLETED/CLOSED/INTERRUPTED`, mas **não** por OPORTUNIDADE.

### Não existe
- Ação **GERAR E20** no card, link personalizado com 7 dias corridos, E27 e finalização derivada.
- **Instância de cadência** (hoje há UM registro por lead em `relationship_cadences`; uma nova E20 dois anos depois não tem onde nascer sem sobrescrever a antiga).
- **Congelamento do texto enviado** com referência de versão.
- **Telefone do executivo** em `executive_profiles` (não há coluna) — o botão "Falar com o executivo" não tem fonte.
- **Resposta automática dentro da janela** com botão dinâmico.
- Ponte **Remarketing → jornada do lead** ("qual campanha foi enviada").

## 3. Causa raiz do "Lead reconhecido — sem alterações"

Encontrada: `src/server/crm/lead-service.server.ts`, no `upsertLead`, o ramo final `else if (!changed)` grava o evento `lead_sincronizado` **toda vez que o lead é revisto sem nenhuma mudança**. O `pg_cron` roda a cada minuto e o agendador executa a varredura **completa da base** a cada 5 minutos — logo cada lead gera ~288 eventos falsos por dia. Correção: não gravar evento nesse ramo (apenas `last_synced_at`).

## 4. Modelo conceitual proposto (a separação que você pediu)

```text
LEAD (pessoa)            → crm_leads / portal_leads, chave = external_id
 ├─ COLUNA (posição)     → stage_key, resolvida pelo board
 ├─ TAGS (histórico)     → tags[] íntegras, nunca decidem posição sozinhas
 ├─ INSTÂNCIA DE CADÊNCIA→ NOVA tabela: 1 linha por ciclo (E0-ciclo, E20-ciclo…)
 │    ├─ origem: entrada | reengajamento | e20_manual
 │    ├─ started_at, deadline_at, closed_at, close_reason
 │    └─ ETAPAS EXECUTADAS (E0, E1, E20, E27, finalização)
 ├─ MENSAGEM (identidade)→ biblioteca: E1, E3, E20… com versão ativa
 ├─ VERSÃO ENVIADA       → snapshot do texto no ato do envio (imutável)
 └─ EVENTO HISTÓRICO     → trilha única e legível da jornada
```

Isso resolve de uma vez: nova E20 após E30 = **nova instância**, histórico antigo intacto; OPORTUNIDADE = `closed_at` na instância ativa; "qual E1 ele recebeu" = o snapshot, não a biblioteca.

## 5. Respostas diretas às suas 18 perguntas (as que faltaram)

- **9. NOVOS + outra tag = reengajamento**: uma função pura nova sobre `board.ts` — o lead está na coluna de entrada **e** carrega pelo menos uma outra etiqueta que é coluna do funil → reengajamento. Aplicada em **um único ponto** (`lead-intake.server.ts`, antes do `registerFirstContact`), para não existirem duas verdades.
- **11. OPORTUNIDADE encerra**: gatilho no `upsertLead` quando `stage_key` muda para oportunidade → fecha a instância ativa com motivo, cancela itens PENDING da `relationship_queue`. A fila de ligações já ignora essa etapa.
- **13. Jornada unificada**: manter as trilhas de escrita como estão e criar uma **leitura consolidada** (uma view/servidor) que junta `crm_lead_events` + `crm_messages` + `relationship_events` + remarketing por lead, ordenada. Sem migrar dado, sem duplicar evento.
- **14. Texto congelado**: no ato do envio, gravar `template_id + version + corpo renderizado` na própria mensagem. A biblioteca muda; o histórico não.
- **16. Descontinuar no CRM**: o botão "Reenviar boas-vindas" (`portal-leads-board.tsx:183`) e o seletor de templates de cadência no composer (`crm-conversation.tsx`) — mantendo o composer para conversa humana dentro da janela.
- **17. Riscos de regressão**: (a) mexer em `board.ts` afeta o Kanban inteiro; (b) fechar cadência por OPORTUNIDADE pode silenciar leads legítimos se a etapa vier errada da origem; (c) criar instâncias exige migrar o estado atual de `relationship_cadences` como "instância 1" sem perder `executed_steps`; (d) parar de gravar `lead_sincronizado` é seguro (evento puramente informativo).
- **18. Ordem recomendada**: 1) higiene do histórico + PENDENTE; 2) regra NOVOS/reengajamento + remover reenvio de boas-vindas; 3) instância de cadência + OPORTUNIDADE encerra; 4) biblioteca versionada + snapshot da mensagem; 5) E20/E27/finalização + link 7 dias; 6) jornada unificada + notas + ponte do remarketing.

## 6. Preservação de dados

Nada é apagado nem migrado destrutivamente. Toda estrutura nova é aditiva: colunas novas com default, tabelas novas, e o estado atual de cada lead vira a **instância 1** da nova estrutura. O histórico atual (inclusive os eventos poluídos) permanece — só paramos de **produzir** novos.

## 7. Pontos que preciso confirmar antes de implementar

1. **Kanban**: lead com NOVOS + OPORTUNIDADES aparece em qual coluna? Hoje aparece na mais avançada (OPORTUNIDADES). Manter assim e só bloquear a E0, ou movê-lo para NOVOS?
2. **"Outra tag de etapa"** inclui REMARKETING nessa checagem, ou REMARKETING continua sendo tratado à parte?
3. **Reengajamento** usa o fluxo RE0–RE3 existente ou é fluxo novo? E ele é automático ou assistido?
4. **E20 pausa a cadência corrente** (E1/E3/E4) ou as duas convivem em paralelo?
5. **E27 e finalização**: automáticas (exigem template Meta aprovado — não existe hoje) ou assistidas (executivo copia e envia)?
6. **Telefone do executivo**: crio o campo em `executive_profiles` e cada executivo preenche no perfil? Confirma?
7. **Link E20**: domínio/formato e o destino após 7 dias (home do Portal ou página "expirado").
8. **Notas do Executivo**: leitura consolidada (nada é copiado entre ambientes) ou você quer as notas efetivamente gravadas nos dois lugares?
9. **Botão de templates no CRM**: remover por completo ou manter só para respostas humanas fora de cadência?
