# Refinamento Final — Etapa 2

Fecha as pontas encontradas na auditoria antes da Etapa 3. Nenhuma mudança em identidade, GreenSales, Portal dos Leads, Remarketing ou na regra NOVO/EM ANDAMENTO/ENCERRADO. E20 e E27 continuam sem texto oficial.

## 1. WhatsApp dos executivos
Preencher `executive_profiles.whatsapp` dos 7 perfis (hoje todos vazios) e validar pelo normalizador único. Sem isso o motor bloqueia o envio e as telas públicas caem no número fixo.

## 2. Higienizar etapa ↔ conteúdo
`relationship_step_content_bindings` tem duplicidades que anulam o vínculo explícito: E1 (5), E3 (6), R2 (4), V3 (2), além de vínculo para FINALIZACAO. Manter um conteúdo ativo por etapa (ou posições reais quando a rotação for intencional) e congelar `relationship_content_groups` como legado, sem apagar histórico.

## 3. Importar a Biblioteca oficial do Word
Executar a importação idempotente: hoje nenhuma linha tem procedência `word` e `body_without_name` está vazio em todas — o texto ativo ainda é a semente de homologação. Após a importação, conferir a variante sem nome e o tratamento de fallback. E20, E27 e FINALIZACAO permanecem como slot vazio e inativo.

## 4. Alinhar o mapa de etapas
Cadastrar E2, E5, E6 e E7 no motor conforme o Word e reclassificar E4/E12/V3/V4/E0_V1 como legado, preservando as chaves já gravadas em filas, tarefas e snapshots.

## 5. Neutralizar caminhos legados de disparo
Deixar um único caminho oficial de envio: desativar `processWelcome` como motor concorrente e impedir que os textos fixos do CRM (`CRM_TEMPLATES`, pós-apresentação) sirvam de conteúdo de produção. `WHATSAPP_NUMBER` deixa de ser fallback nas telas públicas.

## 6. UI da Apresentação Digital (E20) na ficha
Na ficha canônica do investidor: botão de emitir, aviso quando já existe apresentação válida, opção de copiar o link vigente e histórico (quem gerou, quando, expira, primeira abertura, total de aberturas). Chave técnica continua E20; rótulo visual "E6 — Apresentação Digital". Listagem passa a respeitar o escopo do executivo e o resgate público passa a registrar o user agent.

## 7. E20/E27 na Ação do Dia e executor de checkpoint
Integrar acompanhamento da apresentação e o checkpoint de +7 dias ao agregador oficial, respeitando precedência e a trava de OPORTUNIDADE.

## 8. Presença derivada de acesso
Indicador de atividade calculado no servidor a partir dos acessos à apresentação e do engajamento do Portal, com janela de 15 minutos. Sem estado paralelo no navegador.

## Detalhes técnicos
- Fontes: `relationship_e20_occurrences`, `relationship_e20_accesses`, `relationship_step_content_bindings`, `relationship_message_library`.
- E20 permanece evento paralelo com instância própria, nunca etapa de cadência.
- Riscos a controlar: troca simultânea do texto ativo de todas as etapas; etapa sem conteúdo após a limpeza; mudança do destino real das mensagens ao preencher WhatsApp.
