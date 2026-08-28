# Auditoria Técnica Final — estado real antes da Parte B

Nenhuma alteração foi feita. Cada item segue o formato pedido.

## 1. Domínio institucional (portalvelox.com.br)
STATUS ATUAL: única lógica de host é `src/server/environment.server.ts` (`getRequest()` → header `host`) usada só para decidir homologação × produção (`isHomologationHost`, fail-closed). Não há nenhuma referência a `portalvelox.com.br` no código; `.env` só contém as 6 variáveis do backend — nenhuma `VITE_INSTITUTIONAL_HOST`.
IMPLEMENTADO: detecção de host para bloquear dados fictícios. Nada mais.
CONFORMIDADE: não conforme com o conceito de host institucional do Grupo.
RISCO: hoje **qualquer** host que sirva o build serve tudo — institucional e operacional. O preview da Lovable e o publicado são o mesmo app; o preview é tratado apenas como "não homologação" ⇒ produção.
RECOMENDAÇÃO B: criar `src/lib/host-context.ts` com três modos (`institucional`, `operacional`, `preview/interno`) resolvidos no servidor a partir do host + `VITE_INSTITUTIONAL_HOST`/`VITE_OPERATIONAL_HOST` (vazias = comportamento atual); nunca inferir por caminho.

## 2. Bloqueio do ambiente operacional por host
STATUS ATUAL: não existe. Digitar `/f/executivo` em qualquer host renderiza a rota; o único filtro é `OperationalGuard`, que checa `getSession()` no `localStorage`.
IMPLEMENTADO: bloqueio por sessão, não por host.
CONFORMIDADE: não conforme.
RISCO: no host institucional a rota existirá e responderá (não 404). Sem sessão não há flash porque os layouts são `ssr: false` e o guard renderiza `null` até checar; **com** sessão válida (mesma origem, mesmo localStorage) o Workspace abre normalmente no host institucional.
RECOMENDAÇÃO B: bloqueio no servidor, antes do componente — `beforeLoad` no layout `/f` (ou middleware de request) lendo o host e lançando `notFound()` (404 real, não redirect) quando o host for institucional. Guard de sessão continua como segunda camada.

## 3. Árvore real do /f
STATUS ATUAL (TanStack, arquivos reais):
- `f.tsx` layout neutro (SSR ligado, só `<Outlet/>`);
- `f.executivo.tsx` (`ssr:false` + `OperationalGuard publicPaths=["/f/executivo"]`) com 33 folhas: index, home, dashboard, administracao, alertas, backups, biblioteca, brain, campanhas, captacao, celebracao, central-backup, configuracoes, criativa, greensales, greensales-sync, homologacao, identidade, institucional, investidores, kpi, laboratorio, perfil, recursos, relatorios, reunioes, revista, templates, teste-cadencia, usuarios;
- `f.crm.tsx` + `f.crm.index.tsx`; `f.remarketing.tsx` + `f.remarketing.index.tsx`; `f.portal-leads.tsx` (folha com guard e `ssr:false`); `f.$slug.tsx`.
IMPLEMENTADO: migração completa. As 34 rotas legadas (`executivo.*`, `crm`, `remarketing`, `portal-leads`) são stubs de 13 linhas: `beforeLoad` → `redirect({replace:true, search})`, `component: () => null`. Zero lógica remanescente.
CONFORMIDADE: conforme.
RISCO: `f.crm`/`f.remarketing` têm layout + index (2 arquivos) — subrotas futuras entram sem atrito; `f.portal-leads` é folha, então uma subrota exigirá promovê-la a layout.
RECOMENDAÇÃO B: nenhuma mudança estrutural necessária.

## 4. /f/$slug e slugs reservados
STATUS ATUAL: o roteador dá precedência a segmentos estáticos; `/f/$slug` só recebe o que não casa com `executivo|crm|remarketing|portal-leads`. `f.$slug.tsx` redireciona para `/` com `search {e,m,o,b}`.
IMPLEMENTADO: `RESERVED_UNIT_SLUGS = ["executivo","crm","remarketing","portal-leads"]`; `validateExecutiveSlug()` **rejeita** com mensagem + sugestão (não corrige em silêncio); UI de usuários valida na criação e na edição; `saveUsers()` lança `InvalidExecutiveSlugError` antes de gravar.
CONFORMIDADE: conforme na regra.
RISCO: o "ponto central de persistência" é `window.localStorage` — a base de executivos não está no banco. É proteção de cliente; nenhuma constraint de servidor existe.
RECOMENDAÇÃO B: manter a regra e, se/quando executivos forem para tabela, replicar como CHECK/trigger.

## 5. Business unit
STATUS ATUAL: `unitPath()` existe e **não é chamado por nenhum arquivo** além do próprio módulo. Há ~166 literais `/f/...` no código.
IMPLEMENTADO: `BUSINESS_UNITS`, `getUnit`, `currentUnit`, `isOperationalPath` (este sim em uso no `__root`), `normalizeSlug`, validação de slug.
Arquivos mais afetados: `__root.tsx` (8), `src/config/modules.ts`, `components/executive/executive-shell.tsx`, `components/crm/portal-leads-board.tsx`, `recognition-host.tsx`, `google-status-indicator.tsx`, `lib/executive-auth.ts`, `lib/portal-brands.ts`, além de quase todas as rotas.
CONFORMIDADE: parcialmente conforme (modelo pronto, uso ausente).
RISCO: trocar 166 strings de uma vez é a maior fonte de regressão de navegação da Parte B; `<Link to>` do TanStack é tipado por rota literal, então `unitPath()` em `to=` quebra a tipagem.
RECOMENDAÇÃO B: **não** varrer tudo. Usar `unitPath()` apenas onde a unidade é variável (menus, redirecionamentos, geração de links); manter literais nos `createFileRoute`/`<Link to>` de rotas fixas. `/s` e `/seg` já são viáveis sem reescrever a lógica de unidade.

## 6. Guard operacional
STATUS ATUAL: `src/components/auth/operational-guard.tsx`, aplicado nos layouts `f.executivo`, `f.crm`, `f.remarketing` e na folha `f.portal-leads`, todos `ssr:false`.
IMPLEMENTADO: leitura de sessão em `useEffect`; enquanto `!checked || !session` renderiza `null`; sem sessão navega para `/f/executivo` (tela de acesso existente, declarada em `publicPaths`). Reutiliza a autenticação existente — **não** foi criada segunda autenticação.
CONFORMIDADE: conforme quanto a "guard único" e "sem flash".
RISCO: a checagem ocorre **depois** da montagem (efeito), não antes; funciona só porque nada é renderizado antes. Várias telas ainda chamam `getSession()` por conta própria (ex.: `f.portal-leads.tsx`, `f.remarketing.index.tsx`, `f.executivo.templates.tsx`) — redundante, não conflitante. Permissões por módulo continuam separadas e respeitadas (`useModuleAccess` + `ModuleAccessDenied`), pois o guard só trata sessão.
RECOMENDAÇÃO B: mover a decisão para `beforeLoad` client-side do layout e remover os `getSession()` redundantes das folhas (baixo risco, ganho de clareza).

## 7. Remarketing
STATUS ATUAL: `__root.tsx` classifica `/f/remarketing` como operacional — `resolveShell` devolve `"executive"` e o ramo de render é o mesmo do CRM: `<Outlet/> + AgendaDock + Toaster`, **sem** `EditorialShell`, `JourneyChrome`, `JourneyTracker`, `WhatsAppFloating` e fora do redirecionamento do Gateway (o `useEffect` do Gateway ignora o path).
IMPLEMENTADO: isolamento completo.
CONFORMIDADE: conforme.
RISCO: nenhum encontrado.
RECOMENDAÇÃO B: nada a fazer.

## 8. Agenda — identidade do executivo
STATUS ATUAL: `src/lib/agenda.functions.ts` resolve tudo por `supabase.rpc("current_executive_id")` sob `requireSupabaseAuth`; os tipos (`AgendaRange`, `AgendaDraft`) **não possuem** campo de executivo — o cliente não envia ID. RLS em `workspace_agenda_events`: 4 policies `has_role(auth.uid(),'admin') OR executive_id = current_executive_id()`.
IMPLEMENTADO: identidade servidor + isolamento por RLS em SELECT/INSERT/UPDATE/DELETE.
CONFORMIDADE: conforme.
RISCO: `executive_id` é `text` sem FK para `executive_profiles`; `anon` tem grants de tabela (inócuo porque as policies exigem identidade, mas mais amplo que o necessário).
RECOMENDAÇÃO B: revogar `anon` e avaliar FK.

## 9. Agenda — conflito de horário
STATUS ATUAL: dois mecanismos.
- Banco: `EXCLUDE USING gist (executive_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE priority='maxima'` + CHECK `ends_at > starts_at`.
- Código: antes do insert, varre `portal_meetings` (`scheduled_at` + `duration_min`) numa janela de ±12h e recusa se houver interseção.
O caso 10:00–11:00 × 10:30–11:30 é bloqueado pelo banco (`23P01`, tratado e devolvido como `reason:"conflito"` com o item conflitante). Sobreposição parcial, total, evento começando antes ou terminando depois da faixa consultada: todos cobertos, porque `&&` compara intervalos, não a janela de listagem.
CONFORMIDADE: conforme para evento × evento.
RISCO: evento × **reunião** está protegido apenas no código — sem lock e sem constraint. Duas gravações concorrentes (compromisso + criação/reagendamento de reunião) podem produzir sobreposição. Além disso a janela ±12h falharia com reunião de duração muito longa.
RECOMENDAÇÃO B: representar ocupação num único range consultável (tabela de ocupação ou espelho de reuniões com o mesmo EXCLUDE), ou `pg_advisory_xact_lock` por executivo + revalidação dentro da transação.

## 10. Agenda — timezone
STATUS ATUAL: criação usa `new Date("YYYY-MM-DDTHH:mm:00")` (fuso **do navegador**) → `toISOString()`; banco é `timestamptz` (absoluto, correto); consulta usa `dayRange()` também em fuso do navegador; exibição usa `toLocaleString("pt-BR")` **sem** `timeZone`; agrupamento por dia (`dayOf`) é feito no servidor **forçando** `America/Sao_Paulo`.
CONFORMIDADE: correto para quem está em horário de Brasília.
RISCO: estratégia incoerente entre camadas. Em máquina com outro fuso, o horário exibido (fuso local) e o dia calculado (São Paulo) divergem: um compromisso pode ser listado sob o dia errado, e o `date`+`time` digitados viram outro instante. Horário de verão em outros países agrava.
RECOMENDAÇÃO B: fixar `America/Sao_Paulo` como fuso do negócio nos três pontos (montagem do instante, `dayRange`, `toLocaleString({timeZone})`).

## 11. Agenda — ações de cadência
STATUS ATUAL: `agenda_cadence_tasks(_from,_to,_executive_id)` é `STABLE SECURITY DEFINER`: resolve `current_executive_id()`, aceita `_executive_id` só para admin, e faz um SELECT de `crm_cadence_tasks` join `portal_leads` com `status='pendente'` e `due_date` na faixa. Nenhum ponto da Agenda escreve em cadência.
IMPLEMENTADO: leitura pura; executivo comum vê as próprias tarefas (SECURITY DEFINER contorna RLS mas filtra por responsável).
CONFORMIDADE: conforme.
RISCO: nenhum de escrita. Só o vínculo de `responsible_executive_id` define visibilidade — lead sem responsável não aparece para ninguém.
RECOMENDAÇÃO B: manter.

## 12. Agenda — nomenclatura da cadência
STATUS ATUAL: `listAgenda` monta o título como `` `D${t.step_day} · ${t.channel === "ligacao" ? "Ligação" : "Mensagem"} — ${lead_name}` ``, direto da coluna `step_day` de `crm_cadence_tasks`.
CONFORMIDADE: não conforme com E0/E1/E3/E5/E6/E7.
RISCO: acoplamento em dois pontos exatos: (a) a assinatura de retorno de `agenda_cadence_tasks` (não devolve etapa); (b) a linha de título em `src/lib/agenda.functions.ts`.
RECOMENDAÇÃO B: acrescentar `step_key`/`etapa` ao retorno da função e passar a Agenda a exibir rótulo de etapa, com `step_day` mantido apenas como dado interno de vencimento.

## 13. Estrutura de cadência existente
STATUS ATUAL: banco — `crm_cadence_tasks` (`lead_id, channel, step_day, due_date, status, completed_at/by, note, cycle_date, outcome`), `crm_automation_settings`, `crm_pipelines`/`crm_pipeline_stages`, `crm_lead_events`, `crm_timeline`, `relationship_cadences` (35 col.), `relationship_queue`, `relationship_decisions`, `relationship_events`, `relationship_message_sends`, `relationship_e20_occurrences/accesses`, `relationship_sim_runs`, `relationship_engine_log`. Função `agenda_cadence_tasks`. Código — motor antigo em `src/lib/crm/cadence.ts` (L2–L4 + 4ª tentativa ≈7 dias corridos, dias úteis) e motor novo em `src/lib/relationship/*` + `src/server/relationship/*` (machine, decide, calendar, clock, engine).
CONFORMIDADE: dois vocabulários coexistem (D-n do Portal dos Leads × E-n do motor de relacionamento).
RISCO: memória do projeto proíbe dois motores ativos simultaneamente; a Agenda hoje lê o **antigo**.
RECOMENDAÇÃO B: definir na Parte B qual tabela passa a ser a fila oficial e apontar a Agenda para ela num único ponto (a função SQL).

## 14. Central de Templates
STATUS ATUAL: `/f/executivo/templates` gerencia `crm_meta_templates` (nome Meta, id, idioma, categoria, status, header/body/footer, variáveis, botões, `purpose`) com leitura por OCR de capturas; é explicitamente "templates aprovados na Meta". A biblioteca operacional é outra coisa: `relationship_message_library`.
CONFORMIDADE: parcialmente conforme — E0 (template Meta) já tem lugar; E1…RF1 não pertencem a essa tela.
RISCO: duas telas com nomes próximos podem virar duas fontes de verdade.
RECOMENDAÇÃO B: manter Templates = registro Meta (E0) e promover a Biblioteca (`/f/executivo/biblioteca`) a "Central de Mensagens do Motor", com o vínculo E0 → `meta_template_name` (coluna já existente em `relationship_message_library`).

## 15. Versionamento das mensagens
STATUS ATUAL: já existe e é real. `relationship_message_library` tem `version`, `active`, `supersedes_id`, `step_key`, `code`, `scope`; `message-library.server.ts` cria nova versão ao editar e desativa a anterior (uma ativa por etapa, índice único), e `recordMessageSnapshot` congela o texto renderizado no envio. E20/E27/FINALIZACAO nascem como slot vazio e inativo — o motor bloqueia em vez de inventar texto.
CONFORMIDADE: conforme ao conceito V1→V2→V3 com histórico preservado.
RISCO: nenhum estrutural; falta apenas o texto oficial das etapas pendentes e as novas chaves (E2, E5, E6, E7, R0, RF0, RF1) que ainda não existem em `LIBRARY_STEP_ORDER`.
RECOMENDAÇÃO B: só acrescentar as chaves novas e os textos aprovados.

## 16. Biblioteca de conteúdo
STATUS ATUAL: `relationship_contents` (`scope, content_group, name, kind, url, active, usage_count, body`) + `relationship_step_content_bindings` (`step_key → content_id`, `active`) + `step-media.server.ts`. O motor prioriza o vínculo declarativo por etapa; não há inferência por nome/posição.
CONFORMIDADE: conforme ao conceito "conteúdo classificado como E3 é o conteúdo da E3".
RISCO: o vínculo é por `step_key` sem regra de desempate quando houver mais de um conteúdo ativo para a mesma etapa, e as etapas novas (E5/E6/E7) ainda não têm binding.
RECOMENDAÇÃO B: definir a regra de elegibilidade (um ativo por etapa, ou ordem/rodízio explícito) e cadastrar os bindings das novas etapas.

## 17. Notas do executivo
STATUS ATUAL: `portal_leads.notes` é um campo **texto livre único** (gravado por `set_lead_operational(_notes)`); `crm_cadence_tasks.note` e `crm_timeline` guardam registros pontuais. Não existe tabela de notas por evento, nem card compacto de ligação, nem nota de mensagem truncada clicável.
IMPLEMENTADO: campo livre + trilhas de timeline/jornada.
CONFORMIDADE: não conforme ao conceito descrito.
RISCO: usar `notes` como acumulador de eventos destrói o texto livre atual e não é consultável.
RECOMENDAÇÃO B: tabela `lead_notes` (lead_id, tipo `ligacao|mensagem`, ocorrido_em, etapa, resultado da ligação, corpo, autor) com RLS por responsável; card compacto para ligação e truncado+modal para mensagem, alimentado pelo snapshot já existente.

## 18. Ações do Dia
STATUS ATUAL: existe `DailyCallsOverlay` ("Ligações do Dia"), que consome `listCadenceQueue({channel:"call"})` e oferece concluir, registrar tentativa e abrir a ficha. A Agenda já mostra ações sem horário sob o rótulo "Ação do dia".
CONFORMIDADE: parcial — só ligações, sem mensagens nem "copiar mensagem".
RISCO: duas superfícies (overlay + Agenda) podem divergir se cada uma ler uma fila diferente.
RECOMENDAÇÃO B: renomear/generalizar o overlay para "Ações do Dia" com `channel` múltiplo, reaproveitando `DailyCallsOverlay`, `cadence.functions.ts` e o render da Biblioteca para o botão Copiar; a Agenda continua sendo só leitura da mesma fonte.

## 19. E6 — apresentação digital
STATUS ATUAL: não existe E6. Existe o equivalente conceitual na E20: `src/server/relationship/e20.server.ts` gera ocorrência com token, `link_url`, validade de 7 dias, `checkpoint_due_at`, `finalization_due_on`, encerramento da anterior por `encerrada_por_nova`, snapshot da mensagem e abertura de instância de cadência; tabela `relationship_e20_occurrences` e `relationship_e20_accesses`.
CONFORMIDADE: a mecânica pedida já existe, com outro nome; falta a ação no card do lead e a chave de biblioteca E6.
RISCO: recriar do zero produziria dois geradores de link.
RECOMENDAÇÃO B: renomear/mapear E20 → E6 na camada de apresentação e reaproveitar integralmente a infraestrutura.

## 20. E7 — encerramento
STATUS ATUAL: o encadeamento parcial existe (checkpoint em +7 dias = E27, finalização no dia útil seguinte), e `crm_cadence_tasks.outcome` + `CallOutcome "SIM"|"NAO"` já modelam o resultado da ligação. O que **não** existe é a regra "ligação primeiro; se ATENDEU=SIM, não envia a mensagem".
CONFORMIDADE: parcial.
RISCO: a condicional depende de o executivo registrar o desfecho; sem registro, indefinido.
RECOMENDAÇÃO B: no novo motor, tornar a E7 uma tarefa dependente do `outcome` da ligação de checkpoint, com comportamento explícito para "sem registro".

## 21. Link personalizado temporário
STATUS ATUAL: existe e está completo: token aleatório de 24 bytes URL-safe, `expires_at` de 7 dias, rota `/portal/convite/$token` (`ssr:false`) que valida no servidor e, quando inválido, exibe mensagem explicativa sem dar acesso a outras áreas; acessos registrados em `relationship_e20_accesses`.
CONFORMIDADE: conforme.
RISCO: o texto de expiração atual não é exatamente o exigido, e o convite válido entrega o visitante à Home com contexto (não a uma área restrita).
RECOMENDAÇÃO B: ajustar somente o texto e, se desejado, o destino pós-validação.

## 22. Captação institucional do Grupo
STATUS ATUAL: nada institucional do Grupo existe. Reaproveitável: `origem.$channel.tsx` (origem determinada pela rota, não por campo oculto — exatamente o padrão pedido), `s.$slug.tsx`/`seg.$slug.tsx`, `portal-brands.ts`, `resolve_portal_identity` e os formulários existentes.
CONFORMIDADE: não implementado, mas com base sólida.
RISCO: reutilizar o formulário da Financeira levaria leads de Solar/Seguros para `portal_leads`.
RECOMENDAÇÃO B: rotas próprias por modalidade com a origem fixada no handler do servidor, gravando em tabela separada (ver item 23).

## 23. Destino dos leads Solar e Seguros
STATUS ATUAL: não existe `group_leads` nem qualquer tabela de fila Solar/Seguros. Hoje todo lead cai em `portal_leads`, que é a fonte de GreenSales, cadência, Portal dos Leads e backup.
CONFORMIDADE: não conforme (por ausência).
RISCO: alto — qualquer atalho que grave Solar/Seguros em `portal_leads` contamina cadência, GreenSales e backup financeiro, e esbarra na blindagem de leads.
RECOMENDAÇÃO B: tabela independente, sem FK para `portal_leads`, sem trigger financeiro, fora de todas as rotinas atuais.

## 24. Filas Solar e Seguros
STATUS ATUAL: inexistentes. Nenhum componente minimalista de fila; o que existe (`portal-leads-board`) é o Kanban rico da Financeira.
CONFORMIDADE: não implementado.
RISCO: reaproveitar o board traria jornada, notas, cadência e reunião — tudo o que o conceito proíbe.
RECOMENDAÇÃO B: componente novo e enxuto (nome, telefone, e-mail, origem, modalidade, data, status NOVO→ATENDIDO com `attended_by`/`attended_at`), sem exclusão.

## 25. Regra geral de preservação — pontos sensíveis
1. **Portal dos Leads / blindagem**: triggers `guard_lead_delete`/`guard_lead_truncate` e `portal_lead_guard_log`. Nada da Parte B pode tocar `portal_leads`.
2. **GreenSales**: `greensales.server.ts` + `lead-sync.server.ts` leem `portal_leads` inteira; uma coluna nova de modalidade mudaria o comportamento de reconciliação.
3. **Identidade**: `resolve_portal_identity` deduplica por telefone/e-mail globalmente — leads Solar/Seguros na mesma tabela criariam falsas fusões.
4. **Backup**: `portal_backups`/`portal_backup_requests` fotografam o conjunto financeiro; novas tabelas precisam de decisão explícita de incluir/excluir.
5. **Cadência**: risco de dois motores ativos ao trocar a fila lida pela Agenda e pelas Ações do Dia.
6. **Portal do Investidor / E20**: mudar rota ou token invalidaria links já enviados (7 dias em circulação).
7. **Links personalizados e origem TikTok/Meta**: `f.$slug`, `origem.$channel`, `portal-brands` — qualquer bloqueio por host precisa preservar esses caminhos públicos.
8. **Permissões/ownership**: `workspace_module_permissions`, `useModuleAccess`, `current_executive_id()`, `manual_overrides` de nome; o guard não pode substituir a verificação por módulo.
9. **Autenticação**: sessão em `localStorage` + bearer via `src/start.ts`; bloqueio por host não pode quebrar o anexador do token.
10. **Navegação**: os ~166 literais `/f/...` — migração ampla para `unitPath()` é o item de maior chance de regressão silenciosa.

## Síntese das decisões a fechar antes da Parte B
1. Hosts institucional × operacional e valor das variáveis (ou adiar o bloqueio).
2. 404 vs redirect para rota operacional em host institucional.
3. E20 é renomeada para E6 ou passam a coexistir?
4. Qual fila de cadência é a oficial para Agenda e Ações do Dia.
5. Notas: tabela nova (recomendado) ou continuar no campo texto.
6. Escopo da migração para `unitPath()`.
7. Fuso fixo `America/Sao_Paulo` na Agenda.
8. Solar/Seguros: uma tabela com coluna de modalidade ou duas tabelas.
