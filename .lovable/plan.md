# Etapa 3 — Fechamento do ciclo de relacionamento

Diagnóstico já entregue (respostas 1–120). Este plano cobre apenas o que a Etapa 3 precisa implantar, na ordem segura.

## Revisão dos vínculos duplicados (pedido caso a caso)

Os "duplicados" não são erro de vínculo: são **pools de conteúdo por etapa**, todos migrados de `relationship_content_groups` com `position = 0`.

- **E1 (5 vídeos)**: Democratização do acesso ao crédito; Ecossistema de soluções Velox; O mercado financeiro está mudando; O mercado financeiro não é exclusividade dos grandes bancos; Desertos financeiros.
- **E3 (6 vídeos)**: Blindagem patrimonial; Home Office ou Loja Física; e mais 4 do mesmo grupo.
- **R2 (4) e V3 (2)**: mesma origem.

Problema real: como todos têm `position = 0`, **não existe ordem determinística de rotação** — a escolha depende da ordenação do banco. A Etapa 3 deve dar ordem explícita e registrar o consumo, sem apagar nenhum conteúdo.

## O que a Etapa 3 implanta

1. **Neutralização dos legados**
   - Remover as chamadas remanescentes a `processWelcome` (`lead-intake.server.ts`, `leads.functions.ts`) e o `retryCrmWelcome` passa a reexecutar o motor oficial.
   - Tirar `CRM_FIRST_CONTACT` da lista `CRM_TEMPLATES`.
   - Eliminar `WHATSAPP_NUMBER` como fallback nos 5 componentes públicos: sem executivo com WhatsApp, o botão não aparece.

2. **Conteúdo oficial pendente**
   - Publicar na Biblioteca: `E20`, `E27` e `RESPOSTA_AUTOMATICA` (textos a fornecer). Sem texto ativo, o motor continua bloqueando com motivo legível.

3. **Rotação determinística de conteúdo**
   - Ordem explícita por etapa (`position` sequencial) e registro de uso, para que E1/E3/R2/V3 girem de forma previsível e auditável.

4. **Executores temporais (decisão: mensagem automática)**
   - **E27** enviada automaticamente no `checkpoint_due_at` da ocorrência E20 vigente.
   - **FINALIZAÇÃO** enviada automaticamente no `finalization_due_on` (dia útil seguinte).
   - Ambas passam pelo motor oficial: Biblioteca + executivo responsável + ambiente + snapshot congelado; idempotência por chave determinística; OPORTUNIDADE e nova E20 cancelam o pendente.

5. **Integração na Ação do Dia**
   - E20/E27 entram como leitura, respeitando "um lead = uma ação": mensagem dentro da precedência atual, pendências extras como `secondary`.

6. **Dados externos**
   - Cadastro do template Meta de `primeiro_contato` (tabela hoje vazia) e preenchimento de `executive_profiles.whatsapp` (0 de 7).

## Detalhes técnicos

- Tabelas reutilizadas: `relationship_e20_occurrences`, `relationship_e20_accesses`, `relationship_message_library`, `relationship_message_sends`, `relationship_queue`, `crm_meta_templates`, `portal_leads`, `executive_profiles`.
- Nenhuma tabela nova. Migrations: seed/ativação das 3 etapas de texto e ordenação dos vínculos existentes.
- Módulos reutilizados: `message-library.server`, `e20.server`, `instances.server`, `executive-identity.server`, `destinations.server`, `execution-mode.server`, `daily-actions`.
- Intocáveis: Portal dos Leads/GreenSales, snapshots históricos, identidade atômica, `set_lead_operational`, arquivos gerados da integração.
- Testes obrigatórios: precedência com E20/E27, idempotência do checkpoint e da finalização, cancelamento por OPORTUNIDADE/nova E20, expiração e reuso de convite, auto-reply com etapa própria ativa.

## Ordem de implantação

1. Neutralizar legados.
2. Ordenação/rotação dos vínculos.
3. Publicar textos oficiais (E20, E27, RESPOSTA_AUTOMATICA).
4. Executores automáticos de E27 e FINALIZAÇÃO.
5. Integração na Ação do Dia.
6. Unificação dos pontos de contato públicos.
7. Testes e homologação (sem chamada real à Meta).

## Pendências que dependem de você

- Textos oficiais de E20, E27 e resposta automática.
- Template Meta aprovado (nome, idioma, índices dos botões).
- WhatsApp dos executivos.
