# DEPENDÊNCIAS REAIS PARA O COMANDO 2

Resultado da auditoria 1–120. Nada foi alterado. Este documento é a resposta à pergunta 120 e a base técnica do Comando 2.

## A) O que já está pronto

- Motor único de relacionamento: `src/lib/relationship/engine.ts` + `src/server/relationship/{engine,scheduler,dispatch,repository,instances}.server.ts`.
- `relationship_queue` como fonte oficial de mensagens pendentes, com upsert idempotente por `(scope, run_id, lead_id, step)`.
- Idempotência de envio: `crm_messages.id = msg_<etapa>_<lead>` (PK) e `relationship_message_sends.message_id` (único).
- Biblioteca versionada: `relationship_message_library` com `version`, `supersedes_id` e índice único de versão ativa por etapa.
- Snapshot congelado do envio: `recordMessageSnapshot()` → `relationship_message_sends` (texto renderizado, corpo do template, versão, executivo, simulado).
- Ação do Dia como camada de leitura, com `actionKey` determinística e estável entre sessões.
- Trava de instância única ativa por lead (índice parcial) e bloqueio de etapa terminal / OPORTUNIDADE.
- E20 backend completo: emissão com token aleatório, validade de 7 dias, resgate, expiração, contagem de aberturas, primeira abertura, encerramento da ocorrência anterior.
- Rota pública de resgate `/portal/convite/$token`.

## B) O que precisa apenas ser conectado

- Botão "Gerar apresentação digital": as server functions `emitirE20` e `listarOcorrenciasE20` existem e não são chamadas por nenhuma tela. Faltam apenas o gatilho na ficha do investidor e a exibição do estado da ocorrência.
- `relationship_step_content_bindings`: tabela criada, com API server (`step-media.server.ts`) e funções cliente prontas — porém com zero linhas. Falta decidir se ela substitui `relationship_content_groups` ou se é abandonada.
- WhatsApp por executivo: `resolveExecutiveContact` já resolve pelo responsável real do lead; falta preencher `executive_profiles.whatsapp` (hoje 100% nulo) e usar esse caminho no Portal.
- `decideAutoReply`: função pronta, sem call-site localizado a partir do webhook de mensagens.

## C) O que precisa ser construído

- Conteúdo oficial de E20, E27 e FINALIZACAO: existem na Biblioteca inativas e com corpo vazio.
- Definição da etapa E20 no vocabulário do motor (`CadenceStep`/`FLOW_SEQUENCE`) ou decisão explícita de mantê-la como evento fora da cadência.
- Personalização por executivo responsável na renderização das mensagens (hoje usa executivo padrão).
- Marcação estruturada de origem do texto oficial (Word) e controle de versão de importação.
- Validação da janela de atendimento de 24h da Meta antes de escolher texto livre vs template.
- Distinção visível de envio simulado na timeline (coluna/flag, não apenas prefixo textual).

## D) O que precisa ser removido / neutralizado

- Fallback do Portal para número fixo do administrador em `executive-contact-dialog.tsx` (`WHATSAPP_NUMBER`).
- Duplicidade de mecanismo de simulação: constante `E0_SIMULATION_ENABLED` versus decisão por ambiente em `channel.ts`/`environment.server.ts`.
- Registros vazios da Biblioteca (E20/E27/FINALIZACAO) enquanto não tiverem texto oficial.
- Caminho paralelo de E0 em `first-contact.server.ts` com "check-then-insert" não atômico, e o motor de boas-vindas legado em `automation.server.ts`.
- Uma das duas tabelas de vínculo etapa↔conteúdo (`relationship_content_groups` ou `relationship_step_content_bindings`).

## E) O que NÃO deve ser alterado

- Portal dos Leads e integração GreenSales: dados reais, blindagem contra exclusão e `portal_lead_guard_log`.
- Regra de ambiente antes de credenciais: homologação nunca chama a Meta.
- Snapshots já gravados em `relationship_message_sends` e mensagens já registradas em `crm_messages`.
- Índices de unicidade (versão ativa por etapa, instância ativa por lead, `message_id`).
- Semântica NOVO / EM ANDAMENTO / ENCERRADO e a lista branca de atividade real do investidor.
- Isolamento do módulo Remarketing.

## F) Riscos de regressão

- Desligar `E0_SIMULATION_ENABLED` sem antes corrigir a personalização do executivo faria toda a cadência sair assinada pelo executivo padrão.
- Popular `relationship_step_content_bindings` sem migrar `relationship_content_groups` deixaria duas verdades sobre o conteúdo de cada etapa.
- Reimportar o Word sobre a Biblioteca criaria v2 automática de mensagens já em uso.
- Introduzir E20 na sequência de cadência pode reabrir etapas em leads terminais se o bloqueio de OPORTUNIDADE não for respeitado no novo caminho.
- Alterar a chave da Ação do Dia quebraria a estabilidade do card entre sessões.
- Preencher WhatsApp dos executivos sem validação de formato produziria links `wa.me` inválidos.

## G) Ordem técnica recomendada

1. Decidir a fonte única de vínculo etapa↔conteúdo e migrar para ela.
2. Corrigir a personalização: nome e cargo do executivo responsável, com snapshot correto no envio.
3. Preencher e validar `executive_profiles.whatsapp`; eliminar o número fixo do Portal.
4. Publicar os textos oficiais de E20, E27 e FINALIZACAO na Biblioteca, com marcação de origem.
5. Definir formalmente o lugar da E20 no motor (etapa ou evento paralelo) e as travas correspondentes.
6. Implementar o botão "Gerar apresentação digital" na ficha do investidor, reutilizando `emitirE20`.
7. Unificar o mecanismo de simulação e tornar o envio simulado inequívoco na timeline.
8. Conectar `decideAutoReply` ao webhook e adicionar a validação da janela de 24h da Meta.
9. Somente ao final, avaliar o desligamento da simulação da cadência em produção.
