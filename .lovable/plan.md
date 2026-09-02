# INVESTIGAÇÃO 3 — ARQUITETURA MULTIAMBIENTE (FINANCEIRA / SOLAR / SEGUROS)

Rodada somente de leitura. Nada foi alterado: sem código, sem banco, sem migration, sem rotas, sem cron, sem Meta, sem GreenSales, sem mensagem, sem tocar a Global WhatsApp Safety Lock.

**Veredicto em uma frase:** o sistema tem o *vocabulário* de multiambiente (`WORKSPACES`, `workspace_id`, `scope`), mas nenhuma tabela operacional carrega ambiente — e as duas palavras já disponíveis (`workspace` e `scope`) **já estão ocupadas com outros significados**. Preparar a plataforma é **ALTO**, mas existe um caminho barato e honesto de preparação que pode ser feito agora sem tocar na Financeira.

---

## 1. EXISTE ALGUM CONCEITO DE AMBIENTE?

Varredura completa por `workspace / tenant / organization / company / business / unit / brand / scope` + sufixos `_id`:

| Termo | Existe? | O que é de verdade |
|---|---|---|
| `WORKSPACES` / `WORKSPACE` | **Sim, em código** | `src/config/workspace.ts` — registro de branding (`id`, `workspaceName`, `logo`, `defaultExecutiveId`) com **uma** entrada: `velox`. `ACTIVE_WORKSPACE_ID = "velox"` é constante de módulo. O comentário já diz "preparado para evolução multi-tenant". |
| `workspace_id` (banco) | **Sim, 1 tabela** | Só `knowledge_documents`. Nenhuma outra tabela tem. |
| `scope` (banco) | **Sim, 15 tabelas** | **Mas com dois significados diferentes, nenhum deles é vertical de negócio** (ver abaixo). |
| `unit` | Sim, 2 tabelas | `group_unit_leads` / `group_unit_lead_events` — unidade do *grupo/franqueado*, não vertical. |
| `tenant_id`, `organization_id`, `company_id`, `brand_id` | **NÃO EXISTEM** | Nenhuma ocorrência. |

**O trecho mais importante desta investigação — `scope` já está ocupado, duas vezes:**

```text
portal_leads.scope            = green_sales | portal | redistribuicao | tiktok | meta
                                (73 / 12 / 1 registros)   → CARTEIRA / ORIGEM do lead
relationship_*.scope          = production | homologation
                                (75 / 64 / 25 registros)  → AMBIENTE DE TESTE do motor
```

Ou seja: se alguém tentar "reaproveitar `scope` para Financeira/Solar/Seguros", quebra ao mesmo tempo o Workspace por carteira e o isolamento produção↔homologação — que é uma regra fundadora do projeto. **`scope` NÃO pode ser reciclado.**

**Conclusão do bloco 1: NÃO existe entidade de ambiente de negócio. Existe apenas uma constante de branding de um único workspace. CONFIRMADO NO CÓDIGO E NOS DADOS.**

## 2. MAPA GLOBAL x POR AMBIENTE

| Entidade | Hoje é | Amarrada à Financeira? |
|---|---|---|
| `portal_leads` | POR EXECUTIVO (`responsible_executive_id`) + POR CARTEIRA (`scope`) | Sim, implicitamente — todo lead existente é Financeira, sem marcação |
| `crm_leads` | POR LEAD, sem contexto | Sim, implicitamente |
| `crm_messages`, `crm_lead_events`, `crm_timeline` | POR LEAD | Herdam do lead |
| `crm_connections` (GreenSales) | **POR USUÁRIO** (`user_id`, `provider`) | Uma conexão ativa (Thiago) = a Financeira, por acidente |
| `crm_automation_settings` | **GLOBAL, linha única** | Sim — sem coluna de dono. Intervalo, boas-vindas e data de ativação valem para tudo |
| `executive_profiles` | POR USUÁRIO | Sem campo de ambiente |
| `user_roles` / `workspace_module_permissions` | POR USUÁRIO (papel e módulo) | Sem dimensão de ambiente |
| Motor (`relationship_cadences/queue/decisions/events/sends/engine_log`) | POR LEAD + POR AMBIENTE DE TESTE (`production`/`homologation`) | Sim |
| `relationship_message_library` (Biblioteca) | GLOBAL por finalidade + `scope` de teste | Sim — 64 conteúdos, todos `production` |
| `meta_templates` / `crm_meta_templates` | **GLOBAL** (`name`, `language`, `category`, `purpose`) | Sim — nenhuma coluna de número, WABA ou ambiente |
| `campaigns` | **GLOBAL** (`created_by` apenas) | Sim |
| `remarketing_campaigns` / `_contacts` / `_conversations` / `_messages` | **GLOBAL** (`created_by` apenas) | Sim |
| `creative_templates` / `creative_official_model` | **GLOBAL** (chave `model`) | Sim |
| KPI, Agenda (`workspace_agenda_events`), Ações do Dia | POR EXECUTIVO / derivados de lead | Sim |
| Backups (`portal_backups`) | **GLOBAL** — snapshot das 15 tabelas inteiras | Sim |
| Logs / auditoria | GLOBAL | Sim |

**Nenhuma tabela operacional tem coluna de ambiente de negócio. NÃO ENCONTRADO.**

## 3. GREENSALES POR AMBIENTE

- O modelo permite **várias conexões** — a chave prática é `user_id` + `provider`. Nada impede três linhas.
- **Mas a conexão pertence a um USUÁRIO, não a um ambiente.** Não há como dizer "esta conexão é da Solar". CONFIRMADO NO CÓDIGO (`crm_connections`: `id, user_id, provider, account_label, account_email, credentials_ciphertext, status, ...`).
- `account_label` é texto livre (hoje "Thiago Rodrigues") — poderia carregar o nome, mas seria convenção frágil por nome, exatamente o que a Regra Master proíbe.
- **O risco já documentado se agrava:** no cron, `resolveCredentials(undefined)` pega `order by updated_at desc limit 1`. Com três conexões ativas, o cron sincronizaria **uma só, a mais recentemente atualizada**, de forma não determinística — e importaria leads da Solar como se fossem da Financeira. Este é hoje o risco número 1 do modelo multiambiente.

**Menor mudança necessária para o cron saber qual ambiente sincroniza:** uma coluna de ambiente em `crm_connections` e um laço que percorra as conexões ativas uma a uma, carregando o ambiente junto das credenciais até o momento da criação do card. Ou seja: o mesmo ponto de perda já identificado na Investigação 2 (`resolveCredentials` devolve só e-mail e senha) teria de passar a devolver também "de quem/de qual ambiente é esta conta". É a mesma correção, com um campo a mais. **Correção única resolve os dois problemas.**

## 4. META / WHATSAPP

| Item | Onde está hoje | Classificação |
|---|---|---|
| Access Token | `process.env["WHATSAPP_TOKEN"]` | **GLOBAL (variável de ambiente)** |
| Phone Number ID | `process.env["WHATSAPP_PHONE_NUMBER_ID"]` | **GLOBAL (variável de ambiente)** |
| App Secret (webhook) | `process.env["WHATSAPP_APP_SECRET"]` | **GLOBAL** |
| WABA ID | não referenciado no código | **NÃO ENCONTRADO** |
| Business Account | não referenciado | **NÃO ENCONTRADO** |
| Templates | `meta_templates` / `crm_meta_templates` | **GLOBAL (banco, sem vínculo a número)** |
| Provider / URL Graph | literal `graph.facebook.com/v20.0` em `whatsapp.server.ts` | **GLOBAL, hardcoded** |
| Webhook | rota pública única | **GLOBAL** |
| Status do número | derivado do par token+phoneId | **GLOBAL** |

O token e o phone id aparecem **lidos diretamente de `process.env` em 6 pontos distintos** de `src/server/whatsapp.server.ts` (linhas 72, 73, 133, 183, 244, 475), mais `remarketing/engine.server.ts`. Não existe uma função única "resolva as credenciais Meta deste envio".

**Financeira e Solar podem ter configurações Meta distintas hoje?** **NÃO.** Há exatamente um par de credenciais por implantação e ele é lido do ambiente do servidor, não de uma tabela. Não há como escolher.

**Podem compartilhar sem duplicar credenciais?** Hoje é o único cenário que funciona — porque tudo compartilha à força (Cenário C). Para suportar A e B seria preciso: uma tabela de configurações Meta, um resolvedor único que receba o ambiente, e a substituição dos 7+ acessos diretos a `process.env` por esse resolvedor. **A boa notícia:** centralizar a leitura em um resolvedor único é uma refatoração interna segura, que não muda comportamento enquanto houver só um conjunto de credenciais.

## 5. TEMPLATES META

Hoje: **armazenados na aplicação, globalmente.** `crm_meta_templates` tem `meta_name`, `meta_id`, `language`, `category`, `purpose`, `status` — e **nenhuma** referência a número, WABA, usuário ou ambiente.

Consequências:
- `E0_FINANCEIRA` / `E0_SOLAR` / `E0_SEGUROS` conviveriam na mesma lista, distinguíveis só pelo nome — proibido pela regra "nada por nome".
- O campo `purpose` é o que hoje amarra template ↔ etapa. Um segundo eixo (ambiente) exigiria que a chave passasse a ser `ambiente + purpose`, e que `relationship_template_bindings` e `relationship_step_content_bindings` respeitassem esse par.
- **Compartilhamento** seria natural se o ambiente fosse anulável: template com ambiente vazio = compartilhado; com ambiente preenchido = exclusivo. Esse padrão funciona igualmente para biblioteca e criativos.
- Atenção real: um template Meta aprovado pertence a uma WABA. Se a Solar tiver WABA própria, o mesmo template **não** é reaproveitável na prática, ainda que o banco permita. Compartilhar template só é válido quando o número também é compartilhado.

## 6. MOTOR DE RELACIONAMENTO — PONTO CRÍTICO

A cadeia que o senhor descreveu (`lead → ambiente → E0 → mensagem do ambiente → Meta do ambiente`) **não existe em nenhum elo**.

Onde a informação se perderia, em ordem:

```text
1. crm_connections            → não sabe o ambiente               (perda de origem)
2. resolveCredentials         → devolve só e-mail e senha         (perda confirmada, Investigação 2)
3. intakeLead / ensureWorkspaceCard → card nasce sem ambiente     (não há coluna)
4. decisão do motor           → scope = 'production' apenas       (eixo teste, não negócio)
5. resolução de conteúdo      → biblioteca global por finalidade  (não há por quê escolher)
6. resolução de template      → purpose global                    (não há por quê escolher)
7. whatsapp.server            → process.env fixo                  (não há o que escolher)
```

O motor **trabalha globalmente**. Ele só distingue `production` x `homologation` — e essa é uma separação de *ambiente de teste*, que precisa continuar existindo **em paralelo** ao eixo de negócio. Ou seja, o modelo futuro tem **duas dimensões**: `ambiente de negócio (financeira/solar/seguros)` × `ambiente de execução (produção/homologação)`. Tratá-las como uma só é o erro mais caro possível aqui.

## 7. CRM / WORKSPACE

- **Filtro natural para ambiente:** NÃO existe. O que existe é filtro por **carteira** (`belongsToScope` em `f.executivo.dashboard.tsx`) e por **executivo** (`assignedToUserId`), nenhum dos dois é ambiente.
- **Dados misturados:** sim — um único conjunto de `portal_leads` alimenta tudo.
- **Chave de ambiente necessária:** sim, em `portal_leads` acima de tudo; o resto herda por join.
- **Queries sem filtro de contexto:** abundantes. `portal_leads` é consultada diretamente em pelo menos 10 módulos servidor (`workspace-card`, `first-contact-queue`, `daily-actions`, `step-message`, `workspace-reset`, `portal-identity.functions`, `portal-engagement.functions`, `test-lab`, `whatsapp.server`, `workspace-operational.functions`). Cada uma teria de ganhar o filtro — e nenhuma erraria de forma visível se esquecida, o que torna o filtro por aplicação perigoso.

## 8. CAMPANHAS / REMARKETING

- `campaigns`: `name, objective, template_id, audience, status, created_by…` — **sem origem/ambiente**.
- `remarketing_campaigns`: idem, **sem ambiente**; contatos e conversas penduram na campanha.
- Criativos: **sem ambiente**.
- Público/lista: `audience` é texto/critério livre, **sem ambiente**.
- Cron do remarketing: **não sabe contexto nenhum** — processa a fila inteira.
- **Uma campanha da Solar poderia atingir leads da Financeira? SIM, estruturalmente.** Nada no banco impediria.

**O isolamento atual de remarketing é apenas permissional/visual (admin-only), não estrutural.** CONFIRMADO NO CÓDIGO. Como hoje só existe a Financeira, isso é inofensivo; no dia em que existirem três ambientes, é o caminho mais provável para um incidente real com cliente.

## 9. BIBLIOTECA DE MENSAGENS

**GLOBAL.** `relationship_message_library` organiza por finalidade (E1/E3/R1/R2/V3/V4) e por `scope` de teste. 64 conteúdos, todos `production`. Um segundo eixo de ambiente, anulável (vazio = compartilhado), atenderia exatamente o que foi pedido — e precisaria ser respeitado por `relationship_step_content_bindings` e pelo resolvedor de conteúdo do motor, não só pela tela.

## 10. CRIATIVOS

**GLOBAIS.** `creative_templates` tem chave `model` + `config`; `creative_official_model` guarda o modelo oficial. Nenhum vínculo com usuário ou ambiente. Isolar aqui é dos itens mais baratos: poucos registros, superfície pequena, sem histórico crítico.

## 11. USUÁRIOS E PERMISSÕES

O modelo atual:
- `user_roles` — papel (`admin`/`manager`/`user`), **sem ambiente**;
- `workspace_module_permissions` — `user_id` + `module_key` + `enabled`, **sem ambiente**;
- `executive_profiles` — cadastro, **sem ambiente**;
- políticas RLS baseadas em `current_executive_id()`, `has_role()`, `can_access_investor()`, `can_access_relationship()` — nenhuma consulta ambiente.

**"Thiago: Financeira + Solar" é irrepresentável hoje.** Faltaria uma associação usuário↔ambientes (relação N-para-N) e a inclusão desse eixo nas funções de acesso do banco. Notar que `can_access_investor` e `has_role` são `security definer` e sustentam as políticas de dezenas de tabelas: mexer nelas é cirurgia central, não ajuste local.

## 12. DADOS E ISOLAMENTO SERVER-SIDE

| Garantia desejada | Existe hoje? |
|---|---|
| Lead da Solar não aparece na Financeira | **NÃO** — não há coluna nem política |
| Mensagem da Financeira não sai pela Meta da Solar | **NÃO** — credencial única de ambiente do servidor |
| Campanha da Solar não atinge lead da Financeira | **NÃO** — nenhuma barreira |
| Criativo de Seguros não aparece na Financeira | **NÃO** — tabela global |
| Executivo sem Solar não enxerga Solar | **NÃO** — RLS não conhece ambiente |

O que **existe** de isolamento server-side hoje, e funciona: por **executivo** (`can_access_investor` / `current_executive_id`), por **papel** (`has_role`) e por **ambiente de execução** (`production` x `homologation`, com trava de envio). São três eixos sólidos — e nenhum deles é o eixo de negócio pedido.

Recomendação de princípio, para quando for construir: o isolamento precisa nascer em **RLS**, não em filtro de aplicação. Com 60+ tabelas e dezenas de consultas diretas, confiar em `where ambiente = ...` espalhado pelo código garante que um caminho esquecido vaze — e vazamento aqui significa lead de um negócio aparecendo em outro.

## 13. ROTAS E PONTOS HARDCODED

**Estrutura atual:** 42 arquivos `f.*` (páginas reais, com o corpo inteiro — `f.executivo.dashboard.tsx` tem 578 linhas) e 30 arquivos `executivo.*` que são **stubs de redirecionamento** de 13 linhas para `/f/...`. Isso é importante: o prefixo `/f` já foi introduzido uma vez, e a forma escolhida foi **mover o conteúdo**, não parametrizar.

Se `/sol` e `/seg` forem criados do mesmo jeito, o resultado são **126 arquivos de página** com a mesma lógica triplicada — exatamente o que o senhor disse que não quer.

Principais pontos hardcoded encontrados:

| Ponto | Onde |
|---|---|
| `ACTIVE_WORKSPACE_ID = "velox"` (constante de módulo) | `src/config/workspace.ts` |
| `WORKSPACES` com uma única entrada, incluindo nome "Velox Soluções Financeiras" | `src/config/workspace.ts` |
| `WORKSPACE.defaultExecutiveId` → `getDefaultExecutive()` → primeiro admin ativo | `src/lib/executive-auth.ts:592` |
| Fallback literal `"usr_thiago"` | `src/lib/executive-data.ts:99` |
| Prefixo `/f/...` escrito literalmente em navegações (`navigate({ to: "/f/executivo" })`) | espalhado pelas 42 rotas |
| `graph.facebook.com/v20.0` + `process.env` Meta | `src/server/whatsapp.server.ts` (6 pontos) |
| `DEFAULT_BRAND_KEY` / `portal-brands` | `src/lib/portal-brands.ts` |

## 14. CONFIGURAÇÕES VISUAIS

Este é **o ponto mais preparado de todos** — e a boa notícia da investigação. `src/config/workspace.ts` já foi escrito com essa intenção: o comentário no topo diz literalmente que nenhum componente deve referenciar uma empresa diretamente e que "futuras implantações substituem apenas este arquivo". Já há `workspaceName`, `tagline`, `platformName`, `poweredBy`, `workspaceLogoUrl`.

Falta: cores/tema (hoje tokens fixos no CSS), favicon, menus por ambiente, e — principalmente — trocar a constante `ACTIVE_WORKSPACE_ID` por uma resolução em tempo de execução a partir da rota. **Identidade visual por ambiente é configuração, não duplicação. ESFORÇO BAIXO.**

## 15. BACKUPS / LOGS / HISTÓRICO

`portal_backups` guarda snapshot completo das 15 tabelas críticas em `payload`, com `payload_hash`, `protected` e retenção. É **global por construção** — um backup contém os três negócios misturados.

Implicações para multiambiente:
- Restaurar a Solar restauraria também Financeira e Seguros — **inaceitável**. A restauração seletiva (`portal_restores`) teria de passar a filtrar por ambiente.
- Histórico anterior à separação é 100% Financeira: precisaria de uma marcação retroativa única, feita uma vez.
- Logs e auditoria não têm ambiente; ficariam legíveis, mas não segregáveis.

## 16. CUSTO ARQUITETURAL

| | Item | Esforço |
|---|---|---|
| A | Criar `/sol` e `/seg` apenas visualmente | **MÉDIO** — baixo se as rotas virarem `$ambiente` parametrizado; alto se forem cópias das 42 telas |
| B | Isolamento real de dados | **ALTO** — coluna nova em ~20 tabelas + RLS + revisão de todas as consultas |
| C | Isolar GreenSales | **BAIXO/MÉDIO** — 1 coluna + laço no cron; corrige de quebra o bug de posse já identificado |
| D | Isolar Meta/WhatsApp | **MÉDIO** — sair de `process.env` para tabela + resolvedor único; refatoração contida em 2 arquivos |
| E | Isolar mensagens/templates | **MÉDIO** — coluna anulável + resolvedor por par (ambiente, finalidade) |
| F | Isolar campanhas/remarketing | **MÉDIO** — colunas + filtro no cron; hoje não há isolamento algum |
| G | Isolar permissões | **ALTO** — mexe em `has_role`/`can_access_*`, o coração do acesso |
| H | **Transformar a plataforma em multiambiente** | **ALTO** |

## 17. PRINCIPAL PERGUNTA — MENOR MUDANÇA ARQUITETURAL

**Resposta direta: é reengenharia grande, não pequena evolução.** O motivo não é o número de telas — é que o eixo "ambiente" não existe em nenhuma tabela, nenhuma política de acesso e nenhum resolvedor, e teria de atravessar a cadeia inteira, de `crm_connections` até `whatsapp.server.ts`.

**Porém, "grande" não significa "agora ou nunca".** A menor arquitetura possível, se e quando for feita, é esta — e nesta ordem:

```text
1. Tabela de ambientes            (financeira / solar / seguros; slug = /f, /sol, /seg)
2. Vínculo usuário ↔ ambientes    (N-para-N, alimenta o acesso)
3. Coluna ambiente em crm_connections   → o cron passa a saber o que sincroniza
4. Coluna ambiente em portal_leads      → tudo o mais herda por join
5. Ambiente no acesso (RLS)             → isolamento real, não visual
6. Resolvedor único de Meta por ambiente → fim dos process.env espalhados
7. Ambiente ANULÁVEL em biblioteca / templates / criativos  → vazio = compartilhado
8. Ambiente em campanhas/remarketing + filtro no cron
9. Rota /$ambiente com identidade vinda da tabela → zero duplicação de tela
10. Marcação retroativa: todo histórico existente = financeira
```

Os passos 1–4 são a espinha. Do 5 em diante é consequência.

**A única coisa que vale fazer agora, sem risco:** os passos 3 e 4 **já são necessários independentemente da Solar e de Seguros**, porque a Investigação 2 provou que `crm_connections` perde o dono e o card nasce sem responsável. Corrigir aquela cadeia com um campo a mais desde o início evita refazer o mesmo trabalho duas vezes.

## RESUMO FINAL

**1. O que já existe:** branding parametrizável (`WORKSPACES`), isolamento por executivo, isolamento por papel, isolamento produção↔homologação, carteiras por origem, conexões GreenSales por usuário, rotas já prefixadas com `/f`.

**2. O que é global:** Meta/WhatsApp (variáveis de ambiente), templates, biblioteca, campanhas, remarketing, criativos, `crm_automation_settings`, backups, logs, permissões.

**3. O que já pode ser isolado com pouco esforço:** identidade visual, criativos, GreenSales (1 coluna), configuração Meta (refatoração contida).

**4. O que precisaria ser isolado e é caro:** `portal_leads` e toda a cadeia do CRM, o motor de relacionamento, as políticas de acesso, campanhas/remarketing, backups.

**5. Principais riscos:** (i) o cron escolhendo "a conexão mais recente" e importando leads do negócio errado; (ii) campanha de um negócio atingindo leads de outro — hoje não há barreira alguma; (iii) reciclar `scope`, quebrando carteira e homologação de uma vez; (iv) isolamento por filtro de aplicação em vez de RLS, com um caminho esquecido vazando; (v) triplicar 42 telas por cópia.

**6. Esforço:** **ALTO** para o conjunto. BAIXO/MÉDIO para GreenSales, Meta, visual e criativos isoladamente.

**7. Menor arquitetura recomendada:** os 10 passos do bloco 17, cuja espinha são os quatro primeiros.

**8. Vale a pena preparar agora?** **Preparar sim; construir não.** Recomendo: (a) não criar `/sol` nem `/seg` agora, nem sequer visualmente — telas vazias criam expectativa e dívida; (b) quando a correção de posse da Investigação 2 for feita, fazê-la já carregando o contexto da conexão de ponta a ponta, porque é o mesmo caminho; (c) tratar "ambiente de negócio" e "produção/homologação" como dois eixos separados desde o primeiro dia; (d) manter a Financeira intocada até existir uma decisão comercial firme sobre Solar e Seguros — o custo de esperar é baixo, o custo de um isolamento incompleto em produção é alto.

---

**Nada foi implementado, criado ou alterado.** Este documento é apenas o diagnóstico para a decisão de arquitetura.
