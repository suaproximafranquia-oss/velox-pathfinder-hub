# INVESTIGAÇÃO 4 — FUNDAÇÃO PARA EXPANSÃO FUTURA SEM PARAR A FINANCEIRA

Rodada somente de leitura. Nada foi alterado: sem código, sem banco, sem migration, sem rota, sem cron, sem Meta, sem GreenSales, sem mensagem, sem refatoração, sem tocar a Global WhatsApp Safety Lock.

---

## ⚠️ CONFLITO COM INVESTIGAÇÃO ANTERIOR

A Investigação 3 concluiu: *"NÃO existe entidade de ambiente de negócio"*. **Isso está incompleto.** Três estruturas de Solar/Seguros já existem no projeto e não foram encontradas naquela varredura, porque nenhuma delas usa as palavras `tenant`, `environment` ou `workspace_id`:

**1. `src/lib/portal-brands.ts` — as três marcas já existem em código.**
```ts
PORTAL_BRANDS = [ financeira (prefixo "f"), solar (prefixo "s"), seguros (prefixo "seg") ]
DEFAULT_BRAND_KEY = "financeira"
```
Já há `getBrand`, `getBrandByPrefix`, `investorPortalPath`, `investorPortalUrl`. **Atenção:** o prefixo da Solar já reservado é **`/s`**, não `/sol` como o senhor escreveu. Decidir agora qual dos dois vale evita um renome de link público depois.

**2. `group_unit_leads` / `group_unit_lead_events` — carteira Solar/Seguros já no banco.**
```sql
CHECK (unit = ANY (ARRAY['solar','seguros']))
```
Colunas próprias de operação: `responsible_executive_id`, `first_contact_status`, `assigned_by`, `close_reason`, `whatsapp_key`, `email_key`. Tela em `/f/executivo/unidades`, funções em `src/lib/group/unit-leads.functions.ts`, filtragem **server-side real** (`.eq("unit", data.unit)`), autorização em `assertUnitPortfolioAccess` ("Carteiras das unidades do Grupo (Solar/Seguros)").

**3. Estado dos dados:** `group_unit_leads` está **vazia — 0 linhas**. É estrutura pronta, ainda não usada.

**O que muda no diagnóstico:** Solar e Seguros já existem como **captação de interesse** (formulário → lead → primeiro contato → responsável), com isolamento por `unit` funcionando. O que não existe é Solar/Seguros como **operação completa** (CRM, motor, cadência, Meta, campanhas). E — este é o ponto crítico — a forma escolhida daquela vez foi **tabela separada e telas separadas**, exatamente o caminho que não escala para três operações inteiras. O precedente do projeto hoje aponta para duplicação.

O resto da Investigação 3 permanece válido: `scope` ocupado com dois sentidos, Meta em `process.env`, campanhas sem barreira, RLS sem ambiente.

---

## BLOCO 1 — ESPINHA DORSAL DO LEAD

| Etapa | Sabe a origem? | Onde a informação de ambiente existiria | Perdida hoje? |
|---|---|---|---|
| GreenSales (payload) | Não traz marca nem responsável | — | — |
| `crm_connections` | Sabe **de quem é a conta** (`user_id`) | Aqui nasceria o ambiente | **Sim** |
| `resolveCredentials` | Abre a conexão, devolve `{email,password}` | Deveria propagar o dono/ambiente | **PONTO DE PERDA Nº 1** |
| `runLeadSync(modo, actorUserId)` | Recebe o ator, usa só p/ credenciais | Deveria carregar o contexto adiante | **PONTO DE PERDA Nº 2** |
| `intakeLead(raw, {pipeline, settings})` | Não recebe ator nem conta | Assinatura precisaria do contexto | **PONTO DE PERDA Nº 3** |
| `ensureWorkspaceCard` | Grava `responsible_executive_id: null` | Gravaria o ambiente junto | **PONTO DE PERDA Nº 4** |
| `portal_leads` | Tem `scope` (carteira) e `origin` | Precisaria de coluna própria de ambiente | Não há onde guardar |
| CRM / `listConversations` | Filtra por executivo e carteira | Filtraria por ambiente | Não existe |
| Motor / decisão | Conhece `production`/`homologation` | Segundo eixo | Não existe |
| Conteúdo / template | Por finalidade, global | Por (ambiente, finalidade) | Não existe |
| Meta / envio | `process.env` fixo | Por ambiente | Não há o que escolher |

**Respostas às 8 perguntas:**
1. **Origem:** `portal_leads.origin` (texto) e `scope` (carteira). Nenhum dos dois é ambiente de negócio.
2. **Qual conta importou:** em lugar nenhum. A conexão é usada e esquecida.
3. **Dono da conexão preservado:** **não é.** Morre em `resolveCredentials`.
4. **Lead recebe responsável:** hoje, retroativamente, no navegador, via `ensureOwnership` → executivo padrão. Não na entrada.
5. **Onde faria falta saber o ambiente:** nos 4 pontos de perda acima, mais toda consulta de CRM, motor, campanha e envio.
6. **Onde se perde:** os 4 pontos numerados.
7. **Já precisa correção mesmo sem Solar/Seguros:** **os quatro.** A Investigação 2 provou que essa mesma cadeia faz o lead perder a única tentativa de E0. **Esta é a sobreposição feliz da investigação: o conserto que a Financeira já precisa é exatamente a fundação do multiambiente.**
8. **O que dá para preparar sem criar multiambiente:** propagar um objeto de contexto de sincronização (de onde veio, quem é o dono da conta) da conexão até o card. Hoje ele carregaria um campo; amanhã, dois. A assinatura não muda de novo.

## BLOCO 2 — O MÍNIMO PREPARÁVEL AGORA

| ITEM | FAZER AGORA? | MOTIVO | IMPACTO FUTURO |
|---|---|---|---|
| Propagar contexto da conexão até o card | 🟢 **SIM** | Corrige o bug de posse da E0, que já dói hoje | É literalmente a espinha do multiambiente |
| Resolver responsável no servidor, não no navegador | 🟢 **SIM** | Hoje a posse é atribuída horas depois, por padrão de workspace | Amanhã o ambiente viria pelo mesmo caminho |
| Resolvedor único de credenciais Meta (uma função, em vez de 7 `process.env`) | 🟡 Preparar | Não muda comportamento com um só conjunto de credenciais | Vira o único ponto a tocar quando houver Meta por marca |
| Decidir vocabulário: `unit`/`brand`/`ambiente` — uma palavra só | 🟡 **SIM, decidir** | `scope` já tem 2 sentidos; `unit` e `brand` já existem com 3º e 4º | Custo zero agora, evita renome caro depois |
| Decidir prefixo definitivo da Solar (`/s` reservado x `/sol` pedido) | 🟡 **SIM, decidir** | Link público é permanente | Renomear link já divulgado é doloroso |
| Parar de criar telas por cópia (padrão dos 42 arquivos `f.*`) | 🟡 **SIM, princípio** | Toda tela nova hoje é uma tela a triplicar amanhã | Evita 84 arquivos futuros |
| Coluna de ambiente em `portal_leads` | 🔵 Depois | Sem Solar, coluna com um valor único é ruído | Barato de adicionar com default `financeira` |
| RLS por ambiente | 🔵 Depois | Mexer em `has_role`/`can_access_*` sem necessidade é risco puro | Precisa ser feito de uma vez, com Solar real |
| Criar `/sol` e `/seg`, mesmo vazias | 🔴 **NÃO** | Cria expectativa, rotas mortas e dívida | Nenhum ganho |
| Reciclar `scope` para ambiente | 🔴 **NÃO** | Quebra carteira **e** produção↔homologação | Incidente garantido |
| Tabelas separadas por marca (`solar_leads`…) | 🔴 **NÃO** | É o precedente de `group_unit_leads` levado ao extremo | Triplica motor, CRM e backup |
| Duplicar biblioteca/templates por marca agora | 🔴 **NÃO** | Sem Solar, é conteúdo órfão | Confunde o motor |

## BLOCO 3 — BANCO DE DADOS

Legenda de herança: **herda** = pode descobrir o ambiente pelo lead via join; **própria** = precisa de coluna.

| Tabela | Função | Hoje | Precisará ambiente? | Herda ou coluna | Risco de adiar | Esforço |
|---|---|---|---|---|---|---|
| `portal_leads` | Lead oficial | por executivo + carteira | **Sim** | **Coluna** — é a raiz | Alto: sem ela nada herda | Médio |
| `crm_leads` | Espelho origem | por lead | Sim | Herda | Baixo | Baixo |
| `crm_messages`, `crm_lead_events`, `crm_timeline` | Conversa/auditoria | por lead | Sim | Herda | Baixo | Baixo |
| `crm_connections` | Conta GreenSales | **por usuário** | **Sim** | **Coluna** | **Alto** — fallback perigoso | Baixo |
| `crm_automation_settings` | Config do sync | **global, linha única** | Sim | **Coluna + linha por ambiente** | Médio | Baixo |
| `relationship_cadences/queue/decisions/events/sends/engine_log` | Motor | por lead + `scope` teste | Sim | Herda (recomendado) | Médio | Médio |
| `relationship_message_library` | Biblioteca | global por finalidade | Sim | **Coluna anulável** | Médio | Baixo |
| `relationship_step_content_bindings` | Etapa↔conteúdo | global | Sim | Coluna anulável | Médio | Baixo |
| `crm_meta_templates` / `meta_templates` | Templates Meta | global | **Sim** | **Coluna** (template pertence a WABA) | Alto | Médio |
| `relationship_template_bindings` | Etapa↔template | global | Sim | Coluna anulável | Médio | Baixo |
| `campaigns` | Campanhas | **global** | **Sim** | **Coluna** | **Alto** — vazamento entre marcas | Médio |
| `remarketing_campaigns` | Remarketing | **global** | **Sim** | **Coluna** | **Alto** | Médio |
| `remarketing_contacts/conversations/messages` | Execução | por campanha | Sim | Herda da campanha | Baixo | Baixo |
| `creative_templates`, `creative_official_model` | Criativos | global (chave `model`) | Sim | Coluna anulável | Baixo | Baixo |
| `workspace_agenda_events` | Agenda | por executivo | Talvez | Herda pelo lead | Baixo | Baixo |
| `crm_cadence_tasks` (Ações do Dia) | Tarefas | por lead (FK) | Sim | Herda | Baixo | Baixo |
| `user_roles`, `workspace_module_permissions` | Permissões | por usuário | **Sim** | **Tabela de vínculo N-para-N** | Alto | Alto |
| `executive_profiles` | Cadastro | por usuário | Sim (via vínculo) | Vínculo | Médio | Baixo |
| `portal_backups`, `portal_restores`, `portal_backup_blobs` | Backup | **global (snapshot inteiro)** | **Sim** | Coluna + filtro no restore | **Alto** | Alto |
| `portal_lead_guard_log`, `relationship_engine_log` | Logs | global | Desejável | Herda | Baixo | Baixo |
| **`group_unit_leads` / `group_unit_lead_events`** | **Captação Solar/Seguros** | **por `unit`** | **Já tem** | **Já isolada** | — | — |
| `test_batches`, `test_batch_events` | Homologação | por lote | Não (eixo teste) | — | — | — |

**Padrão que emerge:** só ~8 tabelas precisam de coluna própria. Todo o resto herda pelo lead ou pela campanha. Isso reduz muito o susto da Investigação 3 — desde que `portal_leads` seja a raiz e o join seja respeitado.

## BLOCO 4 — MOTOR DE RELACIONAMENTO

Cadeia atual: `LEAD → loadLeadStageContext → decisão (machine) → cadência (relationship_cadences) → fila (relationship_queue) → conteúdo (biblioteca por finalidade) → template (purpose) → dispatch → whatsapp.server`.

1. **Como sabe qual lead:** `leadId` viaja em tudo — `EngineEvent.leadId`, `CadenceRecord.leadId`, `QueueItem.leadId`, `EngineDecision.leadId`. A identidade do lead é sólida.
2. **Onde saberia o ambiente:** em `productionEngine()`, na montagem — o motor já é **montado por escopo** (`createRepository("production", null)`). Esse é o encaixe natural: o mesmo lugar onde hoje entra `production` receberia o ambiente como segundo parâmetro.
3. **Explícito ou por JOIN?** **Explícito na montagem, herdado por join na leitura.** O motor deve ser *instanciado já sabendo* em que ambiente opera (como faz com `production`/`homologation`) e recusar leads de outro. Descobrir por join a cada decisão espalha a responsabilidade e deixa a porta aberta a esquecimento.
4. **Global x por ambiente:** globais e devem continuar — máquina de estados, relógio, regras de janela/dia útil, calendário. Por ambiente — repositório (filtro), despachante (credencial Meta), biblioteca de conteúdo, templates.
5. **Como não confundir com produção/homologação:** são **dois eixos independentes** e a instância do motor é o par `(ambiente, execução)`. Nunca um enum único com cinco valores. `EngineScope` deve continuar sendo só `production|homologation`; o ambiente entra como campo separado. Reutilizar `EngineScope` para marca seria o erro mais destrutivo possível — quebraria a trava de homologação.
6. **Cadência da Financeira executar sobre lead Solar?** Hoje impossível (não há Solar no motor). Amanhã, **sim**, se o repositório não filtrar — a fila é lida por `dueAt`/status, sem qualquer noção de marca.
7. **Onde está o risco:** no repositório e no despachante. Se o filtro ficar na tela, um item de fila de outra marca é processado silenciosamente e sai pelo número errado. É o pior incidente imaginável aqui: mensagem de uma empresa saindo pelo WhatsApp de outra.
8. **O que evitar agora:** ampliar `EngineScope`; criar uma segunda máquina de estados; ler credencial Meta dentro do dispatcher em vez de recebê-la; adicionar consultas novas a `portal_leads` sem passar por um ponto único de leitura.

## BLOCO 5 — GREENSALES

1. **Conexão pertencer a um ambiente?** Não hoje (`crm_connections` = `user_id` + `provider`). Uma coluna resolveria — é a mudança mais barata de todo o mapa.
2. **Conexão compartilhada entre ambientes?** Só com uma tabela de vínculo (conexão↔ambientes) ou coluna anulável. Suportar A, B e C exige N-para-N; coluna simples só cobre "uma conexão, um ambiente".
3. **Usuário com mais de uma conexão?** Estruturalmente sim (nada impede várias linhas). Mas `loadConnection(userId)` busca **uma** por `user_id`+`provider` — hoje o código assume uma só.
4. **Usuário em mais de um ambiente?** Não representável.
5. **Como o cron deveria saber:** percorrendo as conexões ativas **uma a uma**, cada iteração carregando seu próprio contexto — nunca escolhendo "a mais recente".
6. **Fallback perigoso? SIM, confirmado:** `resolveCredentials(undefined)` → conexão ativa mais recente (`order by updated_at desc limit 1`) → depois variáveis de ambiente. Com duas contas, o cron sincroniza uma delas de forma imprevisível e importa os leads sem marcação de origem. **Este é o risco isolado mais grave do mapa inteiro.**
7. **Informação mínima que deveria acompanhar a sincronização:** identificador da conexão, dono da conexão e (futuro) ambiente. Três campos, um objeto, viajando de `resolveCredentials` até `ensureWorkspaceCard`.
8. **A correção da Investigação 2 já prepara isso? SIM** — e é a conclusão mais importante desta investigação. É o mesmo caminho, os mesmos quatro pontos de perda, a mesma assinatura. Fazer a correção da posse **sem** carregar o contexto significa refazer o mesmo trabalho duas vezes.

## BLOCO 6 — META / WHATSAPP

1. **Suporta hoje:** apenas o **Cenário B** (tudo compartilhado) — e não por escolha, por ausência de alternativa.
2. **Não suporta:** A e C.
3. **Onde acopla:** `process.env["WHATSAPP_TOKEN"]` e `["WHATSAPP_PHONE_NUMBER_ID"]` lidos **direto em 6 pontos** de `src/server/whatsapp.server.ts` (72, 73, 133, 183, 244, 475), mais `remarketing/engine.server.ts`. Não há função única de resolução.
4. **Hardcode:** `graph.facebook.com/v20.0` literal em várias chamadas; `WHATSAPP_APP_SECRET` global no webhook.
5. **Menor ponto central:** uma função `resolveWhatsAppCredentials(contexto)` — hoje ignorando o argumento e devolvendo o mesmo par de sempre. Todos os pontos passam a chamá-la.
6. **Preparável agora sem mudar comportamento:** exatamente isso — a centralização. O valor devolvido continua idêntico; muda só o número de lugares que sabem de onde ele vem: de sete para um.
7. **Risco de preparar agora:** baixo, **mas não nulo** — é refatoração em caminho de envio real, sob a Safety Lock. Se for feita, deve ser mudança mecânica pura, sem alterar nenhuma condição, e verificada com o envio simulado antes de qualquer coisa. Se houver a menor dúvida, é 🔵, não 🟡.

## BLOCO 7 — TEMPLATES E BIBLIOTECA

1. **Permite hoje?** Não. `relationship_message_library` organiza por finalidade + `scope` de teste; `crm_meta_templates` por `purpose`, sem vínculo a número/WABA/marca.
2. **Menor mudança conceitual:** a chave de resolução passa de `finalidade` para `(ambiente, finalidade)`, com o resolvedor preferindo o específico e caindo no compartilhado.
3. **"Ambiente vazio = compartilhado"? Sim** — é o padrão certo, e vale igualmente para biblioteca, bindings e criativos. Migração indolor: tudo que existe hoje começa como compartilhado ou como financeira, conforme a decisão.
4. **Conflito com production/homologation? Não**, desde que sejam colunas distintas. Conflito só existiria ao empilhar tudo num enum só.
5. **Preparar agora:** o **princípio** de que a resolução é por par, e não por nome de template. Isso guia a reengenharia sem escrever uma linha.
6. **Depois:** as colunas e a UI de "compartilhado x exclusivo".

**Ressalva real:** template Meta aprovado pertence a uma WABA. Se a Solar tiver número próprio, compartilhar template é ilusão de banco — o mesmo `meta_id` não vale nas duas contas. Compartilhamento de template só é honesto quando o número também é compartilhado.

## BLOCO 8 — CAMPANHAS / REMARKETING

1. **Onde define o público:** `campaigns.audience` (critério/lista) e, no remarketing, a importação de contatos para `remarketing_contacts`.
2. **Barreira server-side: NENHUMA.** Nem coluna, nem política, nem validação.
3. **O cron sabe o contexto?** Não — processa a fila inteira.
4. **O que precisaria:** ambiente na campanha, ambiente no lead, e validação **no servidor** no momento da seleção do público (recusar contato de outro ambiente), não só filtro de tela.
5. **Resolver agora?** Não é urgente — com uma só marca não há o que vazar.
6. **Perigoso deixar sem planejamento? SIM.** Este é o item onde "resolvemos depois" mais provavelmente vira incidente com cliente: campanha de uma empresa disparando para base de outra. Precisa de **decisão registrada** agora, mesmo sem implementação.

## BLOCO 9 — USUÁRIOS E PERMISSÕES

1. **Suporta?** Não.
2. **Onde impede:** `user_roles` (papel sem ambiente), `workspace_module_permissions` (módulo sem ambiente), `executive_profiles` (sem ambiente).
3. **Funções que precisariam conhecer ambiente:** `has_role`, `current_executive_id`, `can_access_investor`, `can_access_relationship`, `is_portal_member`, `agenda_cadence_tasks` — todas `security definer`, todas centrais.
4. **RLS afetada:** praticamente todas as políticas do projeto dependem dessas funções. Não é ajuste local, é cirurgia no coração do acesso.
5. **Risco de adiar:** **baixo**, e essa é a boa notícia. Como as políticas passam por funções centralizadas, acrescentar o eixo de ambiente *dentro* delas atinge todas as tabelas de uma vez. A centralização existente é o que torna esse adiamento seguro.
6. **Preparar agora:** apenas o princípio de que **nenhuma política nova deve nascer fora dessas funções**. Toda política que consultar `portal_leads` diretamente, em vez de `can_access_investor`, vira um lugar a mais para corrigir depois.
7. **Deixar para a implantação? Sim** — com a ressalva do item 6.

## BLOCO 10 — ROTAS E TELAS

1. **Telas hardcoded em `/f`:** **42 arquivos `f.*`**, mais 30 stubs de redirecionamento em `executivo.*`/`portal-leads`/`remarketing` apontando para lá. Os arquivos `f.*` contêm a página inteira (`f.executivo.dashboard.tsx` = 578 linhas de lógica).
2. **Componentes já reutilizáveis:** muitos e bons — `ExecutiveShell`, `OperationalGuard`, `crm-*`, `workspace/*`, `remarketing-*`, `kpi/*`. A camada de componentes **não** é o problema.
3. **O que impede rota parametrizada:** o prefixo `/f` está escrito literalmente nas navegações (`navigate({ to: "/f/executivo" })`, `redirect({ to: "/f/..." })`) e em cada string de `createFileRoute`. Uma rota `$ambiente` exigiria trocar essas literais por caminho derivado.
4. **Depende de "Financeira" de verdade:** muito pouco — `ACTIVE_WORKSPACE_ID = "velox"`, o nome em `WORKSPACES`, o fallback `"usr_thiago"`, `DEFAULT_BRAND_KEY`.
5. **Só branding:** nome, tagline, logo, textos de rodapé.
6. **Resolvível por configuração:** identidade visual inteira, nome da unidade, prefixo do link público.
7. **Realmente separado:** os **dados** — leads, credenciais, templates, campanhas. Nunca as telas.

**Diagnóstico honesto:** a arquitetura de componentes já está pronta para três ambientes. O que não está pronto é o **roteamento** (literais) e os **dados**. O caminho `/f` foi construído movendo arquivos; repetir isso para Solar é o erro que a pergunta central quer evitar.

## BLOCO 11 — IDENTIDADE VISUAL

1. **Já parametrizado:** `WorkspaceBranding` — `workspaceName`, `workspaceTagline`, `platformName`, `poweredBy`, `workspaceLogoUrl`, `defaultExecutiveId`. O arquivo foi escrito com essa intenção declarada: *"nenhum componente deve referenciar diretamente uma empresa"*.
2. **Hardcoded:** `ACTIVE_WORKSPACE_ID = "velox"` (constante de módulo, não resolvida em runtime), cores/tokens em `src/styles.css`, favicon único, menus fixos.
3. **Fácil de tornar configurável:** cores por tokens CSS trocáveis, favicon, menus por lista de configuração.
4. **Risco de deixar para depois:** **baixo.** É o item mais reversível de todos.
5. **Preparar agora?** Só um cuidado, custo zero: **não escrever nomes de empresa em componentes novos** — consumir sempre de `WORKSPACE`. Já é a regra declarada do arquivo; basta não violá-la durante a reengenharia.

## BLOCO 12 — BACKUP / RESTAURAÇÃO / HISTÓRICO

1. **Restaurar só a Solar amanhã, sem tocar a Financeira?** Não, na estrutura atual.
2. **Hoje é possível?** Não. `portal_backups.payload` é snapshot completo das tabelas críticas, com `payload_hash` e `protected`. Restaurar é restaurar tudo.
3. **Histórico antigo precisaria ser marcado?** Sim — tudo que existe é Financeira. É uma marcação retroativa única, trivial, feita uma vez.
4. **Pode ser feito depois? Sim**, desde que a coluna de ambiente tenha default; os registros antigos herdam `financeira` automaticamente.
5. **Decisão necessária agora:** que o formato do snapshot **não perca** a coluna de ambiente quando ela existir. Ou seja: enquanto a reengenharia mexer em backup, o payload deve continuar guardando **as linhas inteiras**, nunca uma seleção de colunas escolhida à mão. Um backup que projeta colunas explicitamente vira um backup que esquece a coluna nova — e aí a restauração por ambiente fica inviável para sempre naquele intervalo. **Este é o único ponto do bloco que precisa de atenção durante a reengenharia.**

## BLOCO 13 — ANO 2: ADICIONAR SOLAR SEM PARAR A FINANCEIRA

| Item | Adicionável sem interromper? | Motivo |
|---|---|---|
| Banco (colunas novas) | **SIM** | Coluna anulável com default não bloqueia tabela em uso |
| RLS | **DEPENDE** | Se as políticas continuarem passando por `can_access_investor`/`has_role`, muda-se a função e pronto. Se surgirem políticas diretas, cada uma é uma parada |
| GreenSales | **SIM** | Coluna + laço no cron; a conexão da Financeira segue igual |
| Cron | **DEPENDE** | Trocar "conexão mais recente" por laço é mudança de comportamento — exige janela e observação |
| Motor | **DEPENDE** | Se o ambiente entrar na **montagem** (como `production` hoje), sim. Se exigir mudar a máquina de estados, não |
| CRM | **SIM** | Componentes reutilizáveis; só o filtro muda |
| WhatsApp | **DEPENDE** | Com resolvedor central, sim. Com 7 `process.env` espalhados, é mexer no caminho de envio ao vivo |
| Templates | **SIM** | Coluna anulável; existentes viram compartilhados |
| Biblioteca | **SIM** | Idem |
| Campanhas | **SIM** | Coluna + validação; nenhuma campanha ativa é afetada |
| Remarketing | **SIM** | Idem |
| Usuários | **SIM** | Tabela de vínculo nova, nada removido |
| Permissões | **DEPENDE** | Mesmo raciocínio da RLS |
| Rotas | **DEPENDE** | Se as literais `/f` tiverem virado caminho derivado, sim. Se não, é reescrita das 42 telas |
| Branding | **SIM** | Já é configuração |
| Backup | **DEPENDE** | Se o snapshot preservar linhas inteiras, sim |
| Logs | **SIM** | Append-only, herda pelo lead |

**Leitura do quadro:** dos 17 itens, 10 são **SIM** independentemente do que se faça agora. Os 7 **DEPENDE** dependem de **quatro decisões** tomáveis hoje sem escrever quase nada: RLS via funções centrais, ambiente na montagem do motor, resolvedor único de Meta, rotas sem literais.

## BLOCO 14 — CLASSIFICAÇÃO FINAL

**🟢 FAZER AGORA** (a Financeira já precisa; a fundação vem de brinde)
- Propagar o contexto da conexão de `resolveCredentials` até `ensureWorkspaceCard`.
- Resolver o responsável do lead **no servidor, na entrada** — encerrar a atribuição retroativa pelo navegador.
- Eliminar o fallback "conexão ativa mais recente" quando não há ator: hoje é bug latente, amanhã é vazamento entre marcas.

**🟡 PREPARAR AGORA, IMPLEMENTAR DEPOIS** (decisões, não código)
- Vocabulário único para ambiente — `scope`, `unit` e `brand` já estão ocupados; escolher a quarta palavra e reservá-la.
- Prefixo definitivo da Solar: `/s` (já reservado em `portal-brands.ts`) ou `/sol` (pedido). Uma das duas, agora.
- Ambiente entra na **montagem** do motor, ao lado de `production`/`homologation`, nunca dentro dele.
- Resolvedor único de credenciais Meta (mudança mecânica, comportamento idêntico) — só se puder ser feita sem tocar em nenhuma condição de envio.
- Regra: nenhuma política RLS nova fora de `can_access_investor`/`has_role`.
- Regra: backup guarda linhas inteiras, nunca colunas escolhidas à mão.
- Regra: nenhuma tela nova nasce com o prefixo escrito à mão.

**🔵 DEIXAR PARA QUANDO SOLAR/SEGUROS FOREM CONFIRMADAS**
- Colunas de ambiente em todas as tabelas; RLS por ambiente; vínculo usuário↔ambientes; rotas parametrizadas; identidade visual por marca; restauração seletiva; validação de público por ambiente.

**🔴 NÃO FAZER**
- Criar `/sol` e `/seg`, ainda que vazias.
- Reciclar `scope` (quebra carteira e homologação de uma vez).
- Ampliar `EngineScope` para incluir marcas.
- Tabelas separadas por marca — repetir o padrão de `group_unit_leads` em escala de operação completa.
- Duplicar telas, biblioteca, templates ou criativos por antecipação.
- Mexer na Global WhatsApp Safety Lock a pretexto de preparação.

## BLOCO 15 — DECISÃO ARQUITETURAL

**1. Podemos reengenheirar a Financeira agora sem implementar multiambiente?** **Sim** — e é o caminho recomendado. A fundação não é uma funcionalidade a construir; é um conjunto de decisões a respeitar enquanto se conserta o que já está quebrado.

**2. Princípios a respeitar:**
- Todo dado de contexto que entra no sistema **viaja até o fim** — nunca é aberto e descartado no meio.
- Todo lead nasce com dono **no servidor, na entrada**.
- Acesso passa por funções centralizadas, nunca por política solta.
- O motor recebe o contexto na montagem; a máquina de estados permanece pura.
- Ambiente de negócio e ambiente de execução são **dois eixos**, sempre.
- Tela é reaproveitada; dado é isolado. Nunca o contrário.
- Vazio significa compartilhado.

**3. Os 5 maiores erros a evitar:**
1. Reciclar `scope` ou `EngineScope` para representar marca.
2. Consertar a posse do lead **sem** carregar o contexto da conexão — refaz o mesmo trabalho duas vezes.
3. Criar telas novas com `/f` escrito à mão.
4. Escrever políticas RLS que consultem `portal_leads` diretamente.
5. Resolver isolamento em filtro de aplicação em vez de no servidor/RLS.

**4. Menor fundação que vale colocar agora:** o contexto de sincronização atravessando os quatro pontos de perda, mais as sete regras do 🟡. Isso é, na prática, a correção da Investigação 2 feita com um pouco mais de cuidado.

**5. O que definitivamente NÃO tocar agora:** a Global WhatsApp Safety Lock, o eixo `production`/`homologation`, as funções `has_role`/`can_access_*`, e a operação da Financeira em si.

**6. Daqui a um ano, "vamos colocar Solar":** (a) colunas anuláveis com default `financeira`; (b) marcação retroativa do histórico; (c) conexão GreenSales da Solar cadastrada com ambiente; (d) cron em laço por conexão; (e) motor montado por par `(ambiente, execução)`; (f) Meta pelo resolvedor central; (g) conteúdos exclusivos onde fizer sentido, o resto compartilhado; (h) rotas parametrizadas; (i) ambiente nas funções de acesso; (j) validação de público nas campanhas. Nenhum desses passos exige parar a Financeira **se** as decisões do 🟡 tiverem sido respeitadas.

**7. Depois, "agora Seguros":** repetição pura dos passos (c), (g) e cadastro — sem mudança estrutural. A segunda marca custa caro; a terceira é rotina.

**8. Uma quarta marca sem reconstruir tudo?** **Sim**, desde que ambiente seja uma **linha de tabela**, e não um valor em enum, constante ou nome de rota. O `WORKSPACES` como registro (já é um `Record`) e o `PORTAL_BRANDS` como lista mostram que a intenção original do projeto era essa — falta apenas que os dados sigam o mesmo padrão.

---

## RESPOSTA À PERGUNTA CENTRAL

*Como reconstruir a Financeira agora sem criar uma arquitetura que obrigue a parar a operação quando Solar e Seguros entrarem?*

**Não construindo nada de multiambiente — e consertando o que já está quebrado do jeito certo.** A cadeia que hoje faz o lead perder a E0 (conexão → credenciais → intake → card) é exatamente a cadeia que amanhã carregaria o ambiente. Conserte-a carregando um objeto de contexto em vez de dois valores soltos, mantenha os dois eixos separados, centralize Meta e acesso, e pare de escrever o prefixo da rota à mão. São decisões de disciplina, quase sem código, e transformam a expansão futura de reengenharia em adição.

**Nada foi implementado, criado ou alterado.** Este documento é apenas o diagnóstico.
