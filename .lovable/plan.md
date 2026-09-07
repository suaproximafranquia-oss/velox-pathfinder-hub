# Diagnóstico técnico (somente leitura) — KPI da Gestora, Ação do Dia e Templates/Remarketing

Nada foi alterado: código, banco, permissões, rotas, interface e roadmap permanecem intactos.

## 1. KPI DA GESTORA

ESTADO ATUAL
- Backend: `resolverEscopoKpi` (server function autenticada) resolve identidade por Supabase Auth → `executive_profiles` → `user_roles` e devolve o recorte: colaborador vê só a si; gestora vê a equipe operacional ativa sem a própria linha; admin vê a equipe inteira incluindo a si.
- A lista de executivos vem de `listActiveOperationalExecutives`: entra quem tem ficha ativa, sai quem está `inativo` em `executive_user_status`, sai quem é `manager` puro (gestão não é linha operacional). Executivos novos entram automaticamente.
- Frontend: a tela chama o servidor, e em caso de falha cai no recorte mínimo (a própria operação) — nunca amplia. Colaborador tem `viewId` forçado ao próprio id, mesmo que o estado local seja manipulado.
- Para a Gestora: existe "Consolidado da equipe" (padrão) e abas individuais por executivo. Não existe aba "Eu" — por decisão explícita, porque ela não tem operação própria.
- Hoje: 7 fichas de executivo, 0 inativos.

JÁ CORRETO
- Visão "Minha equipe" (consolidado) e seleção individual por executivo.
- Ausência de "Eu" para a Gestora é intencional e coerente com a regra de ownership (gestão nunca é responsável por lead).
- Segurança do `executiveId`: o escopo é decidido no servidor; o navegador não amplia por URL/parâmetro/estado.
- Exclusão da Larissa como executiva e filtro de inativos estão centralizados em uma única fonte no servidor.

DIVERGÊNCIAS
- Os NÚMEROS do KPI não são server-side: `loadDataset`/`saveDataset` leem e gravam em `localStorage` (`atlas:kpi:v1:{executivo}:{mês}`). O consolidado da equipe é a soma dos datasets locais do PRÓPRIO navegador.
- Consequência prática: a Gestora só enxerga lançamentos feitos naquele navegador. Os lançamentos reais dos executivos (feitos nos computadores deles) não aparecem — o consolidado tende a vir vazio ou incompleto, sem erro visível.
- O recorte está certo; a fonte de dados é que não é a verdade operacional.
- Há também funções de "limpar mês" e "gerar massa de homologação" gravando sobre o mesmo armazenamento local.

ARQUIVOS/FUNÇÕES/TABELAS
- `src/lib/kpi-scope.functions.ts` (`resolverEscopoKpi`)
- `src/server/operational-team.server.ts` (`listActiveOperationalExecutives`)
- `src/server/identity.server.ts` (`resolveServerIdentity`)
- `src/routes/f.executivo.kpi.tsx` (`KpiManagerBody`, `KpiManagerScoped`, `buildConsolidatedDataset`)
- `src/lib/kpi-manager.ts` (`loadDataset`, `saveDataset`, `resetDataset`, `seedHomologationDataset`)
- Tabelas: `executive_profiles`, `executive_user_status`, `user_roles`. Nenhuma tabela de KPI existe.

RISCO REAL
- Alto para gestão: decisão gerencial sobre dados que não são compartilhados nem auditáveis; perda silenciosa ao limpar cache/trocar de máquina; nenhum registro histórico no servidor.
- Baixo para segurança: nada vaza, porque cada navegador só tem o que digitou.

RECOMENDAÇÃO
- O que falta NÃO é permissão nem visão: é persistência server-side dos lançamentos de KPI (uma tabela por executivo/mês/indicador/dia, com escrita autorizada pelo mesmo escopo já existente e leitura consolidada no servidor). Menor construção: manter exatamente a tela e o `resolverEscopoKpi` atuais e trocar apenas a origem dos dados (`loadDataset`/`saveDataset` → leitura/gravação autenticada), preservando os cálculos.

## 2. AÇÃO DO DIA — RECUPERAÇÃO DE AÇÃO PULADA

ESTADO ATUAL
- Pular exige justificativa (mínimo 3 caracteres) e grava em `relationship_engine_log` (ação `acao_do_dia_pulada`, com `actionKey`, lead, etapa, motivo, autor e `operationalDate`), mais linha legível em `crm_timeline` e registro no histórico da ficha. Nada é apagado.
- A ação some da fila porque a montagem do dia filtra as chaves puladas: `listSkippedActionKeys` lê os pulos das últimas 72h e mantém apenas os cujo `operationalDate` é o dia de hoje. Ou seja, o "sumiço" vale só para o dia corrente — no dia seguinte a ação volta a aparecer naturalmente, se ainda for devida.
- `recordSkipRecovery` não é acionável pelo usuário: é chamado automaticamente quando a MESMA `actionKey` é efetivamente concluída depois — ao registrar a mensagem (quando o motor conclui o passo) ou ao concluir reunião com comparecimento. Ele varre os últimos 90 dias, confirma que houve pulo e que ainda não há recuperação, e só então grava `acao_do_dia_pulo_recuperado`.
- Idempotência: garantida pela checagem "já existe recuperação para esta `actionKey`" antes de gravar; e a função é envolvida em try/catch, de modo que falha de recuperação nunca invalida a conclusão.
- Contadores: a Central de Operações lê os dois eventos; o pulo recuperado deixa de contar como pulo, mas continua listado com marca `recuperada`. Histórico é append-only, nunca reescrito.
- Hoje: 5 pulos registrados, 0 recuperações.

JÁ CORRETO
- Persistência, justificativa obrigatória, auditoria append-only, filtro por dia operacional, idempotência e contabilidade corrigida sem apagar histórico.

DIVERGÊNCIAS
- Não existe recuperação MANUAL: dentro do próprio dia, uma ação pulada por engano não pode ser trazida de volta à fila; só reaparece no dia seguinte (se ainda devida) ou é "recuperada" indiretamente ao concluir a mensagem/reunião por outro caminho.
- Os 0 registros de recuperação indicam que o caminho automático ainda não foi exercitado em produção — o mecanismo está implementado, mas não comprovado por dados reais.

ARQUIVOS/FUNÇÕES/TABELAS
- `src/server/crm/daily-actions-log.server.ts` (`skipDailyAction`, `recordSkipRecovery`, `listSkippedActionKeys`, `registerDailyActionMessage`, resolução de reunião, `DAILY_ACTION_EVENTS`)
- `src/server/crm/daily-actions.server.ts` (filtro `visible` na montagem do dia)
- `src/server/crm/operations-center.server.ts` (contagem de pulos e marcação `recuperada`)
- `src/server/crm/daily-actions-history.server.ts`
- Tabelas: `relationship_engine_log`, `crm_timeline`, `portal_meetings`

RISCO REAL
- Baixo. O pior caso é operacional e temporário: um pulo acidental tira a ação da fila até o dia seguinte, sem perda de histórico nem de cadência.

RECOMENDAÇÃO
- Não é necessário construir uma "recuperação" nova. Se quiser resolver o erro de clique, o menor ajuste possível é um botão "Trazer de volta" na lista de pulos do dia, que grava um evento de recuperação (o já existente) e passa a ser considerado por `listSkippedActionKeys` ao remontar a fila — sem tocar em geração de ações, janelas, cadência ou contadores. Prioridade baixa.

## 3. TEMPLATES + REMARKETING

ESTADO ATUAL
- `crm_meta_templates` (tabela oficial e viva): `meta_name`, `meta_id`, `language`, `category`, `status`, `meta_updated_at`, `header`, `body`, `footer`, `variables` (jsonb), `buttons` (jsonb), `purpose`, `is_active`, `notes`, `created_by`, `created_by_name`, `created_at`, `updated_at`.
- `meta_templates` (legada): apenas `name`, `body`, `category`, `language`, `status`, `created_by`, datas.
- Existe SIM tela de cadastro: `/f/executivo/templates` (protegida por `WorkspaceResourceGuard resource="templates"`, hoje restrita a Administrador). O cadastro é feito colando as capturas do Gerenciador da Meta; o sistema interpreta e grava em `crm_meta_templates`. O Portal não cria nem submete templates à Meta.
- Status/aprovação: o campo `status` é texto livre vindo da leitura da tela da Meta. Quem valida de fato é a E0: `loadE0MetaTemplate` aceita apenas `aprovado`, `approved` ou `ativo`; qualquer outro valor bloqueia a entrega externa com motivo legível.
- Relação com E0: a E0 lê o template de finalidade `primeiro_contato`, mais recente por `updated_at`; sem cadastro aprovado, o envio real é bloqueado (a lógica interna continua rodando).
- Remarketing (`/f/remarketing`, ambiente independente): campanhas em `remarketing_campaigns` com snapshot textual próprio (`template_name`, `template_label`, `template_language`, `template_body`, `template_version` incrementado a cada edição); contatos e conversas em tabelas próprias. Não há chave estrangeira nem leitura de `crm_meta_templates`.
- Os "filtros" do Remarketing hoje são de operação da campanha (status: em execução, pausada, cancelada) e status do contato — não há segmentação por origem/etapa do CRM.
- Volumes atuais: `crm_meta_templates` 0, `meta_templates` 0, campanhas/contatos/mensagens de remarketing 0.

JÁ CORRETO
- Infraestrutura de cadastro, ativação/desativação, finalidade, variáveis e botões existe e está protegida por papel.
- Snapshot versionado por campanha preserva o conteúdo efetivamente usado.
- Isolamento entre CRM operacional e CRM de Remarketing está respeitado.

DIVERGÊNCIAS
- `meta_templates` (legada) está vazia e sem nenhum consumidor de interface: só `listTemplates`/`saveTemplate`/`deleteTemplate` em `src/lib/comms.functions.ts`, que não são importados por nenhuma tela — código órfão.
- `status` não tem vocabulário fechado: aceita qualquer texto; só a E0 aplica a regra de aprovação. Nada impede um template "pendente" ser marcado ativo na tela.
- Remarketing não reaproveita o cadastro oficial: o operador digita nome/corpo do template livremente, sem vínculo com `crm_meta_templates`, o que permite divergência com o que a Meta aprovou.
- A E0 escolhe o template mais recente por finalidade, sem seleção explícita de "vigente" — com dois cadastros de `primeiro_contato`, a escolha é implícita.
- Como tudo está zerado, hoje a E0 real está, na prática, bloqueada por ausência de template cadastrado.

ARQUIVOS/FUNÇÕES/TABELAS
- `src/routes/f.executivo.templates.tsx`, `src/lib/crm/meta-templates.functions.ts`, `src/lib/crm/meta-templates.ts`
- `src/server/relationship/e0-template.server.ts` (`loadE0MetaTemplate`, `E0_TEMPLATE_MISSING_REASON`)
- `src/server/remarketing/engine.server.ts`, `src/components/remarketing/*`, `src/routes/f.remarketing.index.tsx`
- `src/lib/comms.functions.ts` (funções legadas órfãs de `meta_templates`)
- Tabelas: `crm_meta_templates`, `meta_templates` (legada), `remarketing_campaigns`, `remarketing_contacts`, `remarketing_conversations`, `remarketing_messages`

RISCO REAL
- Operacional alto no curto prazo: sem template cadastrado, a E0 não tem entrega externa possível.
- Médio de conformidade: nome/corpo digitados à mão no Remarketing podem divergir do aprovado pela Meta.
- Baixo: tabela legada vazia e sem uso.

RECOMENDAÇÃO
- Não é necessário construir uma "Central de Templates" nova — ela já existe e é suficiente. O que falta é conteúdo (cadastro dos templates aprovados) e três ajustes pequenos, em ordem: (a) vocabulário fechado de status com marcação explícita do template vigente por finalidade; (b) no Remarketing, seleção a partir do cadastro oficial em vez de digitação livre, mantendo o snapshot atual; (c) remoção do código legado órfão de `meta_templates`.

## ORDEM RECOMENDADA

1. Persistência server-side dos lançamentos do KPI (única divergência que compromete decisão gerencial hoje).
2. Cadastro/definição do template oficial da E0 com status fechado e vigente explícito por finalidade.
3. Vínculo do Remarketing ao cadastro oficial de templates, preservando o snapshot versionado.
4. Botão "Trazer de volta" para ação pulada no mesmo dia (opcional, baixo impacto).
5. Remoção do código legado órfão de `meta_templates`.
