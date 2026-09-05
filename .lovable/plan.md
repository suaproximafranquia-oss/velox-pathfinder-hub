# Auditoria Técnica de Leitura — Portal Velox / Corporate Workspace (/f)

Somente leitura. Nada foi alterado: sem código novo, sem migration, sem mudança de dados, permissões, rotas ou publicação. Consultas ao banco foram exclusivamente `SELECT`.

Legenda: EXISTENTE / PARCIAL / QUEBRADO / INEXISTENTE / NÃO VALIDADO.

---

## A) RESUMO EXECUTIVO

O motor de relacionamento, a Ação do Dia, a Central de Operações e a Central de Backup estão maduros, com fontes oficiais bem separadas, snapshot imutável de mensagens, histórico append-only e responsável histórico congelado por trigger de banco. Essa é a parte sólida do sistema e não deve ser tocada.

O problema estrutural está em **autorização** e em **fontes de verdade duplicadas**:

1. Convivem três sistemas de permissão desconectados — papel operacional (`super_admin/diretora/executivo`), permissões de módulo por usuário (`workspace-permissions`) e papéis do banco (`has_role` admin/manager). Menu e rota frequentemente usam regras diferentes para o mesmo recurso.
2. Central de Captação, Biblioteca de Conteúdo, Central de Homologação e Revista não têm bloqueio de acesso na rota — o menu esconde, a URL abre.
3. Perfil do executivo é gravado primeiro em `localStorage` e só depois espelhado no banco (best-effort), enquanto o motor lê direto do banco.
4. Central de Alertas é 100% `localStorage`, sem rastro no servidor e sem separar teste de produção.
5. Duas policies críticas confirmadas: `investor_notes` e `workspace_e0_actions` liberadas para leitura/escrita por qualquer usuário autenticado.

---

## B) TABELA DE SITUAÇÃO

| ITEM | SITUAÇÃO | OBSERVAÇÃO |
|---|---|---|
| Rota/layout do Workspace (`f.executivo.tsx`) | EXISTENTE | Guard único de sessão para todo `/f/executivo/*`. |
| Home do Workspace | EXISTENTE | `/f/executivo/home`; sem fallback para `/`. |
| Identificação de ambiente/unidade | PARCIAL | `navigation-environment.ts` centraliza, mas o menu hardcoda `unitPath("/executivo")` no logout. |
| Identificação de usuário/papel | PARCIAL | Sessão em `localStorage`; heartbeat valida ativo/inativo, não papel. |
| Centralização de permissões | QUEBRADO | Três sistemas paralelos, sem hook unificador. |
| Menu lateral | PARCIAL | Vários itens divergem da matriz desejada (ver bloco C). |
| Proteção de rota por papel | QUEBRADO | Captação, Biblioteca, Homologação e Revista abrem por URL. |
| CRM / GreenSales | EXISTENTE | Credenciais cifradas AES-256-GCM; vendor_id único por executivo. |
| Credencial global GreenSales | EXISTENTE (por design) | Fallback "qualquer conexão ativa" + variáveis de ambiente. |
| Responsável do lead | EXISTENTE | Persistido em `portal_leads`, histórico em `lead_ownership_history`. |
| Responsável histórico da obrigação | EXISTENTE | Congelado por trigger em `relationship_queue` e `crm_cadence_tasks`. |
| Meu Perfil | PARCIAL | Sem GreenSales user/e-mail; escrita client-first em `localStorage`. |
| Portal dos Leads | QUEBRADO (autorização) | Módulo liberável a colaborador, servidor exige `has_role admin/manager`. |
| Ação do Dia | EXISTENTE | Agregador puro, não cria obrigações; idempotência em 6 mecanismos. |
| Motor de relacionamento / versões de fluxo | EXISTENTE | Versão publicada congelada no nascimento do ciclo. |
| Biblioteca de mensagens | EXISTENTE (com desvio) | Fonte oficial versionada; existe texto fixo paralelo em `crm/templates.ts`. |
| Central de Operações | EXISTENTE | Produção x aderência separadas; escopo produção estrito. |
| Central de Backup | EXISTENTE | Retenção conforme política; sem sobra de dados fora da regra. |
| Central de Alertas | QUEBRADO | Baseada em `localStorage`, sem rastro server-side nem filtro de teste. |
| `/seg` no Workspace | INEXISTENTE | Unidade marcada como não operacional; não há rotas de workspace. |
| Ação do Dia como item de menu | INEXISTENTE (correto) | Só existe como demo em Homologação. |
| Apresentação Digital no menu | EXISTENTE (indesejado) | Item permanente enquanto houver permissão. |
| `investor_notes` / `workspace_e0_actions` | QUEBRADO (segurança) | Policies abertas a qualquer autenticado. |

---

## C) PROBLEMAS CONFIRMADOS

**Autorização**
1. `executive-shell.tsx:161` — Central de Captação aparece para todos; `f.executivo.captacao.tsx:85` só verifica sessão. Dados vêm de `localStorage`, sem server function. Desejado: ADMIN.
2. `f.executivo.biblioteca.tsx` — sem checagem de papel; `library.functions.ts` usa só `requireSupabaseAuth`. Qualquer autenticado pode **publicar versão de mensagem oficial**.
3. Central de Homologação — menu exige `super_admin`, rota não checa nada, servidor aceita `admin` OU `manager`. Três regras para o mesmo recurso.
4. Portal dos Leads — três camadas: override de módulo (pode liberar a colaborador), `isCrmAdministrator || isCrmSupervisor` no componente e `assertManager` (`has_role admin|manager`) no servidor. Resultado possível: tela abre, dados não carregam.
5. Central de Operações e Revista — arquivo de rota sem verificação própria; proteção real depende de componentes internos. NÃO VALIDADO.
6. `f.executivo.unidades.tsx` — removida do menu, rota ainda acessível por URL.

**Segurança (findings já reportados)**
7. `investor_notes`: policies `SELECT qual=true` e `INSERT with_check=true` para `authenticated`. Qualquer usuário logado lê e cria notas de qualquer investidor. Escrita ocorre em `investor-notes.server.ts` a partir da Ação do Dia.
8. `workspace_e0_actions`: `SELECT`, `INSERT` e `UPDATE` liberados a `authenticated` sem restrição. Permite ler e alterar ações de primeiro contato de todos os leads. Depende dela: Ação do Dia, E0, Central de Operações.

**Fontes de verdade**
9. Perfil do executivo gravado em `localStorage` e espelhado ao banco em best-effort; motor lê `executive_profiles`. Divergência possível entre o que o usuário vê e o que o sistema usa.
10. `crm/templates.ts` mantém textos fixos de primeiro contato/abertura usados na Central de Templates e no CRM, fora da Biblioteca — sem `library_id`, sem snapshot.
11. Central de Alertas deriva de `localStorage` (jornada e alertas), sem espelho no servidor. Não é possível comprovar por SQL a origem dos alertas de "Thiago" ou "Augusto"; "Augusto" não existe em nenhuma tabela nem no código.

**Dados**
12. Leads `TEST META Canal` e `TEST TIKTOK Canal` estão com `is_test = false` — escapam do filtro anti-teste da Central de Operações, que se baseia só na flag.
13. Backup automático teve lacuna real entre 29/08 e 02/09 (1 execução por dia em vez de ~24). A retenção reagiu corretamente preservando os dias sem o marco das 23:00 locais.

**Nomenclatura (apenas registro, sem renomear)**
14. Negócio E2, E5, E7 não têm etapa executável — existem só como rótulos legados. E8 não existe no código. O que o negócio chama de "E6 — Apresentação Digital" é tecnicamente `E20`. "ER" é `RE0..RE3`. "R" é `R1..R3`. "V" é `V3`/`V4`. Existem ainda `E12`, `E27`, `E30`, `FINALIZACAO`, `RESPOSTA_AUTOMATICA`, `E0_V1` sem par no modelo de negócio.

---

## D) RISCOS

- **Alto**: publicação de mensagem oficial por usuário sem papel (Biblioteca aberta) — afeta produção diretamente.
- **Alto**: leitura/escrita irrestrita de notas de investidor e de ações E0 (policies abertas).
- **Alto**: operação do Motor de Homologação por URL sem gate de rota.
- **Médio**: exposição de métricas e origens de captação a colaborador.
- **Médio**: divergência silenciosa de perfil (WhatsApp/vendor_id) entre navegador e banco, afetando assinatura, E0 e link do executivo.
- **Médio**: leads de teste não sinalizados contaminando indicadores de produção.
- **Baixo/Médio**: alertas sem rastreabilidade — não auditáveis, não reproduzíveis e não filtráveis por ambiente.

---

## E) DEPENDÊNCIAS

- Unificar permissões depende de decidir **uma** fonte de papel (papel operacional em `executive_profiles` x `has_role` no banco) antes de mexer em qualquer menu ou rota.
- Corrigir as policies de `workspace_e0_actions` depende de existir identidade de executivo confiável no servidor (hoje parcialmente client-first).
- Centralizar a cadeia usuário → GreenSales user → vendor_id → WhatsApp depende de mover a escrita do Perfil para o servidor.
- Sanear alertas depende de existir um evento server-side de jornada com `scope`/`is_test` (hoje `portal_journey_events` não tem essas colunas).
- Marcar leads de teste depende de decisão de negócio sobre histórico já contabilizado.

---

## F) O QUE JÁ ESTÁ PRONTO E NÃO DEVE SER TOCADO

- Motor de relacionamento, fila, ciclos e congelamento de versão de fluxo.
- Ação do Dia como agregador puro, com skip/nota/conclusão e idempotência.
- Snapshot imutável em `relationship_message_sends` e histórico em `relationship_engine_log` / `crm_timeline`.
- Responsável histórico congelado por trigger em `relationship_queue` e `crm_cadence_tasks`.
- Criptografia das credenciais GreenSales e unicidade de `greensales_vendor_id`.
- Central de Operações (separação produção x aderência, escopo produção estrito).
- Central de Backup e sua política de retenção.
- Safety Lock de WhatsApp e todo o isolamento produção x homologação.

---

## G) O QUE PRECISA SER IMPLANTADO

1. Matriz única de permissões (uma fonte de papel), consumida por menu **e** rota **e** server function.
2. Gate de rota real para Captação, Biblioteca, Homologação, Revista, Unidades e Central de Operações.
3. Correção das duas policies críticas com escopo por responsável/papel.
4. Alinhamento do Portal dos Leads: uma única regra entre módulo, componente e servidor.
5. Perfil server-first: eliminar escrita client-first e expor GreenSales user + vendor_id + WhatsApp validados na mesma tela.
6. Remoção da Apresentação Digital como item permanente do menu.
7. Alertas com origem server-side, com `scope` e exclusão de teste.
8. Sinalização correta de leads de teste remanescentes.
9. Decisão sobre o texto fixo em `crm/templates.ts` (manter como manual explícito ou migrar para a Biblioteca).

---

## H) O QUE PRECISA SER VALIDADO PRIMEIRO EM HOMOLOGAÇÃO

- Nova matriz de permissões, perfil a perfil, item a item, incluindo acesso direto por URL.
- Policies corrigidas de `investor_notes` e `workspace_e0_actions` contra a Ação do Dia e a Central de Operações.
- Perfil server-first: assinatura de mensagem, link do executivo e E0 após a migração da fonte de verdade.
- Reclassificação de leads de teste e o efeito nos números da Central de Operações.
- Nova origem de alertas antes de desligar a origem local.

---

## I) ARQUIVOS, TABELAS, FUNCTIONS E POLICIES ENVOLVIDOS

**Arquivos**: `src/components/executive/executive-shell.tsx`, `src/lib/navigation-environment.ts`, `src/lib/business-unit.ts`, `src/lib/executive-auth.ts`, `src/lib/workspace-permissions.ts`, `src/lib/portal-workspace.ts`, `src/lib/crm/permissions.ts`, `src/lib/crm/leads.functions.ts`, `src/lib/crm/templates.ts`, `src/server/authorization.server.ts`, `src/server/executive-auth.server.ts`, `src/server/crm/connections.server.ts`, `responsible.server.ts`, `ownership.server.ts`, `lead-intake.server.ts`, `cadence.server.ts`, `daily-actions.server.ts`, `daily-actions-log.server.ts`, `e0-actions.server.ts`, `investor-notes.server.ts`, `operations-center.server.ts`, `src/server/relationship/*` (engine, dispatch, closure, e0, e20, flow-versions, message-library, step-message, repository, executive-identity, executive-contact), `src/server/backup.server.ts`, `backup-queue.server.ts`, `src/server/connectionKeyCrypto.ts`, `src/lib/workspace-alerts.ts`, `src/lib/journey/engine.ts`, rotas `src/routes/f.executivo.*.tsx`, `f.portal-leads.tsx`.

**Tabelas**: `portal_leads`, `crm_leads`, `crm_connections`, `crm_cadence_tasks`, `crm_timeline`, `crm_messages`, `executive_profiles`, `executive_user_status`, `lead_ownership_history`, `workspace_e0_actions`, `workspace_agenda_events`, `workspace_module_permissions`, `portal_meetings`, `portal_backups`, `portal_backup_requests`, `portal_backup_blobs`, `portal_journey_events`, `investor_notes`, `investors`, `investor_identifiers`, `relationship_queue`, `relationship_cadences`, `relationship_flow_versions`, `relationship_flow_steps`, `relationship_engine_log`, `relationship_message_library`, `relationship_message_sends`, `user_roles`.

**Functions/RPC**: `has_role`, `can_access_investor`, `can_access_relationship`, `current_executive_id`, `crm_cadence_tasks_freeze_responsible`, trigger `trg_relationship_queue_stamp_responsible`.

**Policies críticas**: `investor_notes` (SELECT `qual=true`, INSERT `with_check=true`, role `authenticated`); `workspace_e0_actions` (SELECT/INSERT/UPDATE liberados a `authenticated`).

---

## J) ORDEM RECOMENDADA DE IMPLANTAÇÃO (nada executado)

1. Decisão de arquitetura: qual é a fonte única de papel do usuário.
2. Fechamento das duas policies críticas, validado em homologação.
3. Gate de rota nos módulos hoje abertos por URL (Biblioteca e Homologação primeiro, por impacto em produção).
4. Matriz única de permissões aplicada a menu, rota e server function.
5. Alinhamento do Portal dos Leads a essa matriz.
6. Perfil server-first e centralização da cadeia GreenSales/WhatsApp.
7. Ajuste do menu: remoção da Apresentação Digital como item permanente.
8. Reclassificação dos leads de teste remanescentes.
9. Nova origem server-side dos alertas.
10. Decisão final sobre o texto fixo fora da Biblioteca.
