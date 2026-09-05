# Bloco 4 — Fluxo administrável com versão congelada (definição arquitetural)

Resposta de arquitetura. Nada foi construído.

Princípio: a Biblioteca continua dona da EXISTÊNCIA e do CONTEÚDO da etapa. O FLUXO passa a ser uma configuração separada (quais etapas, em que ordem, com que prazo), publicada em versões imutáveis. Cada ciclo guarda a versão que usou.

## 1. Estrutura de dados proposta (2 tabelas novas, nada removido)

`relationship_flow_versions`
- `id`
- `flow_key` (texto: sem_resposta, visualizacao, reengajamento, reentrada, relacionamento_frio)
- `version` (inteiro, incremental por fluxo)
- `status`: rascunho | publicada | arquivada
- `published_at`, `published_by`
- único: (flow_key, version); apenas uma publicada por fluxo (índice parcial)

`relationship_flow_steps`
- `id`
- `flow_version_id` (referência acima)
- `step_key` (texto livre — o mesmo da Biblioteca, sem alterar nem duplicar a etapa)
- `position` (inteiro, ordem dentro do fluxo)
- `business_days_after_reference` (prazo em dias úteis, próprio da associação)
- `active` (permite desligar uma etapa numa versão sem apagar histórico)
- único: (flow_version_id, step_key) e (flow_version_id, position)

Consequências diretas:
- Associação etapa→fluxo = uma linha aqui; não exige tocar código.
- Multi-fluxo = a mesma `step_key` aparece em versões de fluxos diferentes, com posição e prazo próprios (E8 em sem_resposta pos. 8 / 3 dias; E8 em reengajamento pos. 3 / 5 dias).
- `display_position` da Biblioteca (Bloco 3) continua sendo só visual e não é lido pelo motor.
- Editar um fluxo nunca faz UPDATE numa versão publicada: cria-se uma nova versão (cópia das linhas), edita-se em rascunho e publica-se.

## 2. Onde a versão fica vinculada ao ciclo

Em `relationship_cadences`, dois campos: `flow_version_id` e `flow_version` (número, redundante para leitura/auditoria). Gravados uma única vez, na criação do ciclo, com a versão publicada naquele instante. Nunca atualizados depois.

Para itens já enfileirados, `relationship_queue` carrega o `flow_version_id` herdado do ciclo, de modo que uma ação pendente continua explicável mesmo se o ciclo for reprocessado.

Ciclos legados (sem `flow_version_id`) resolvem para uma "versão 1" gerada a partir do `config.ts` atual — histórico permanece intacto e coerente.

## 3. Comportamento de ciclos novos x existentes

- Ciclo existente: lê sempre a sua `flow_version_id`. Publicar uma nova versão com E8 no meio não injeta E8 nele.
- Ciclo novo: recebe a versão publicada no momento da criação e segue a nova sequência.
- Nada é apagado: publicar versão não mexe em `relationship_queue`, `relationship_message_sends`, `crm_timeline`, `relationship_engine_log`.
- Etapas já executadas não são recalculadas: o motor só decide a PRÓXIMA etapa, e sempre dentro da versão do ciclo.
- Mudança futura é sempre "para frente": nenhuma escrita retroativa.

## 4. Etapa em múltiplos fluxos

A etapa é identificada apenas por `step_key` na Biblioteca (conteúdo/versão da mensagem). Participação, ordem e prazo vivem em `relationship_flow_steps`, por versão de fluxo. Logo, a mesma etapa participa de N fluxos sem cópia de conteúdo e sem novo cadastro em código.

## 5. Partes do motor que passariam a ler essa configuração (no Bloco 4)

Somente leitura substituída, sem reescrever o motor:
- `src/lib/relationship/config.ts`: `FLOW_SEQUENCE` e `businessDaysAfterReference` deixam de ser a fonte e viram fallback/semente da versão 1.
- `decide.ts` / máquina de estados: "próxima etapa do fluxo" e "prazo" passam a vir de um resolvedor por `flow_version_id`.
- Scheduler / `dispatch.server.ts`: cálculo de vencimento usa o prazo da associação.
- Criação de ciclo (repositório de cadências): grava `flow_version_id`.
- `step-registry.server.ts` (Bloco 2): passa a considerar também etapas presentes em versões de fluxo como conhecidas.
- Painel da Biblioteca ganha uma aba/tela separada de Fluxos (associar, ordenar, prazo, publicar).

Permanecem em código e fora de dados: E0/RE0/E30 e os especiais (E20, E27, FINALIZACAO, RESPOSTA_AUTOMATICA), Safety Lock, janelas de envio, ownership/redistribuição.

## Menor alteração necessária

Duas tabelas novas + dois campos em `relationship_cadences` (e um em `relationship_queue`) + um resolvedor de fluxo por versão que o motor consulta no lugar das constantes. Nenhuma tabela existente é reescrita, nenhum histórico é migrado, o motor atual continua o mesmo.
