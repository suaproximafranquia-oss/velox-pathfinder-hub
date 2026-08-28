# Etapa B — Fechamento arquitetural (respostas 1 a 20)

Nada foi implementado nesta rodada. Onde o código/schema não permite confirmar, está marcado como **precisa verificar/definir**.

---

**1. Hosts.** Confirmo as quatro regras como intenção de projeto, com uma ressalva factual importante: **hoje não existe domínio operacional separado**. O projeto não tem domínio personalizado configurado; as áreas operacionais são servidas pelo mesmo host da aplicação (o endereço publicado atual e o preview). Portanto não vou inventar domínio nem afirmar que a separação já existe.

Parametrização: uma variável de ambiente `VITE_INSTITUTIONAL_HOST` (vazia por padrão). Regra: se `host === VITE_INSTITUTIONAL_HOST` e a variável não estiver vazia, o host é institucional — `/` renderiza a página do Grupo Velox e o layout `/f` responde 404 no `beforeLoad` do servidor. Se a variável estiver vazia ou o host for outro, **tudo se comporta exatamente como hoje**. O host é lido no servidor com `getRequest()` de `@tanstack/react-start/server`, já usado no projeto (`src/server/environment.server.ts`, `src/integrations/supabase/auth-middleware.ts`).

Pendência declarada: apontar `portalvelox.com.br` para o projeto e definir o domínio operacional definitivo. Enquanto isso, o código já fica pronto e desligado por configuração.

**2. Preview.** Como `VITE_INSTITUTIONAL_HOST` fica vazia no preview, o preview continua servindo o Portal atual sem qualquer mudança de comportamento. Para testar o modo institucional sem domínio real, uso duas saídas: (a) enviar o header `Host: portalvelox.com.br` no teste headless, e (b) um parâmetro de inspeção `?__host=` aceito **somente** quando `import.meta.env.DEV` — nunca em produção. O default é sempre "comportamento atual".

**3. `/f` estático vs `/f/$slug`.** O TanStack Router faz ranking de rotas: segmentos estáticos têm precedência sobre segmentos dinâmicos no mesmo nível. `/f/executivo/*`, `/f/crm`, `/f/remarketing` e `/f/portal-leads` existem como arquivos estáticos (`f.executivo.*.tsx`, `f.crm.tsx`, `f.remarketing.tsx`, `f.portal-leads.tsx`) e vencem `f.$slug.tsx` sempre. `/f/$slug` continua atendendo qualquer outro slug. O novo layout `src/routes/f.tsx` é pai comum e **não altera esse ranking** — ele apenas envolve os filhos com `<Outlet />`.

**4. Slugs reservados.** Confirmo: comparação em minúsculas, aplicada **depois** da normalização (`slugify`), portanto `EXECUTIVO`, `Executivo` e `executivo` são o mesmo slug reservado. A validação passa a ser **bloqueante** (`validateExecutiveSlug`) e aplicada no ponto de persistência em `src/lib/executive-auth.ts` — o que cobre criação e edição por construção, já que ambas passam pela mesma gravação — mais a validação de UI em `src/routes/f.executivo.usuarios.tsx` para dar mensagem imediata. `getExecutiveBySlug()` mantém o bloqueio na leitura como defesa em profundidade. `safeExecutiveSlug()` deixa de corrigir silenciosamente na gravação; fica só como sugestão de alternativa.

**5. Mapa de redirecionamentos (já existente no código, verificado agora).** Todos os stubs legados já estão criados e usam `redirect({ replace: true })`:

| Legado | Destino |
|---|---|
| `/executivo` (`executivo.index.tsx`) | `/f/executivo` |
| `/executivo/home` | `/f/executivo/home` |
| `/executivo/<qualquer>` (30 telas, uma a uma) | `/f/executivo/<mesma tela>` |
| `/crm` | `/f/crm` |
| `/remarketing` | `/f/remarketing` |
| `/portal-leads` | `/f/portal-leads` |

Sobre `/executivo`: o destino é `/f/executivo`, **não** `/f/executivo/home`. Isso preserva o comportamento anterior — `/executivo` sempre foi a porta de entrada com o formulário de login (`f.executivo.index.tsx` contém `signInWithCloud`), e `/executivo/home` sempre foi o Workspace. Redirecionar `/executivo` para `/home` abriria uma tela diferente da que abria antes. Mantido 1:1.

**6. Search e params.** Confirmo, e é o que os stubs já fazem: `beforeLoad: ({ search }) => redirect({ to: "/f/crm", search })`. Então `/crm?lead=123&tab=historico` chega em `/f/crm?lead=123&tab=historico` com os dois parâmetros. Não há rota legada com parâmetro de rota (`$param`) entre as redirecionadas — todas são caminhos estáticos —, mas nos stubs em que isso vier a existir o `params` é repassado do mesmo modo. Vou incluir esse par de casos na matriz de testes.

**7. `/entrar` — correção necessária ao plano.** Verifiquei o código e a premissa da pergunta não corresponde ao projeto: **`/entrar` não é a tela de login operacional**. `src/routes/entrar.tsx` é uma rota legada do Gateway do Portal público — ela redireciona para `/` abrindo o overlay do Gateway do investidor. O login operacional é o formulário em `/f/executivo` (`signInWithCloud`) e o login inline do `CrmShell`.

Portanto: **não** enviarei o usuário sem sessão para `/entrar` (isso o jogaria no Portal do investidor). O `OperationalGuard` redireciona para `/f/executivo`, que é o login real e já existente — exatamente o que as telas fazem hoje via `useEffect`. Nenhum sistema de autenticação novo, nenhuma segunda tela de login. Sobre retorno ao destino original: o login atual **não** tem esse mecanismo; vou gravar o destino pretendido em `?next=` e, se e somente se o retorno for trivial no fluxo existente, aplicá-lo após o login — sem reescrever o fluxo de autenticação. Se não couber sem alterar o login, o comportamento fica igual ao de hoje (cai no Workspace) e eu informo.

**8. OperationalGuard.** Confirmo explicitamente: ele trata **somente** existência de sessão, resolução de identidade da sessão e bloqueio antes da montagem (não monta `<Outlet />` enquanto não resolve — é isso que elimina o flash). Não é RBAC. Permissões de módulo e de papel continuam onde estão: `useModuleAccess`, `ModuleAccessDenied`, `canManageUsers`, `availableRoles`. Nenhuma dessas verificações é movida, duplicada ou reinterpretada.

**9. `ssr: false`.** Compatível e já em uso no projeto: `src/routes/portal.convite.$token.tsx` declara `ssr: false` e a árvore gerada trafega `ssr` nativamente (`src/routeTree.gen.ts`). Versão: `@tanstack/react-start ^1.168.26`. Onde será aplicado: `src/routes/f.executivo.tsx` (novo), `src/routes/f.crm.tsx`, `src/routes/f.remarketing.tsx`, `src/routes/f.portal-leads.tsx`. **Não** em `src/routes/f.tsx` — o layout raiz de `/f` precisa continuar com SSR porque `/f/$slug` é uma página pública de captação e depende de SSR para metadados. Nenhuma alteração estrutural de contorno será feita; se algo se mostrar incompatível durante a execução, eu paro e explico antes.

**10. Reuniões — schema verificado.** Confirmado no schema real de `portal_meetings`: existem `scheduled_at timestamptz`, `duration_min integer` (com default), `executive_id`, `status`, `topic`, `investor_name`, `investor_id`. O término será `scheduled_at + duration_min minutos`, calculado na leitura. Reuniões com `status` de cancelamento serão excluídas do cálculo de conflito — **precisa verificar** os valores exatos usados na coluna `status` antes de fixar a lista; farei essa leitura no início da implementação em vez de assumir. A tabela `portal_meetings` não será alterada.

**11. Timezone.** Confirmo os quatro pontos: (a) banco continua em UTC (`timestamptz`), nada muda; (b) apresentação com `Intl.DateTimeFormat` e `timeZone: "America/Sao_Paulo"`, nunca com string `-03:00` concatenada; (c) na criação, o horário local informado é convertido para instante absoluto antes de gravar; (d) a comparação de conflito ocorre sobre instantes absolutos (epoch/`timestamptz`), tanto na aplicação quanto na constraint do banco. O offset fixo `-03:00` hoje presente no código da Agenda é removido.

**12. Semântica do EXCLUDE.** Usando `tstzrange(starts_at, ends_at)` com o padrão `'[)'` (início incluído, fim excluído):
- evento que termina exatamente quando outro começa → **permitido**;
- evento que começa exatamente quando outro termina → **permitido**;
- travessia de meia-noite → tratada corretamente, porque a comparação é por instante e a consulta deixa de recortar por dia;
- `ends_at <= starts_at` → rejeitado por `CHECK (ends_at > starts_at)`, adicionado junto (`tstzrange` vazio escaparia do EXCLUDE, então o CHECK é obrigatório).
A constraint cobre `priority = 'maxima'` do mesmo `executive_id`.

**13. Conflito com reuniões — ordem.** Confirmo: a checagem contra `portal_meetings` acontece **antes** do INSERT, dentro do mesmo handler de servidor. Se houver conflito, a função retorna erro e **nenhuma escrita ocorre** — não há INSERT parcial nem registro criado e depois removido. A mensagem identifica o compromisso: "Conflito com a reunião com {investor_name} das {HH:mm} às {HH:mm}". Para conflito com outro evento da agenda, a mensagem cita o título e o horário do evento existente.

**14. Limitação de corrida.** Confirmo conscientemente: a constraint `EXCLUDE` protege apenas eventos de `workspace_agenda_events` entre si. Uma reunião criada em `portal_meetings` no mesmo instante por outro processo pode escapar da checagem aplicacional. Essa limitação é **aceita** e **não** haverá alteração estrutural em `portal_meetings` (nem coluna, nem trigger, nem constraint cruzada) para contorná-la. Janela real de exposição: milissegundos, num fluxo de baixa concorrência.

**15. Cadência na Agenda.** Confirmo os cinco pontos: não são copiadas para `workspace_agenda_events`; não recebem horário artificial (aparecem numa faixa "Ações do dia", só com data); não são editáveis pela Agenda; não são concluíveis pela Agenda; permanecem responsabilidade exclusiva do CRM/motor. Na Agenda são representação **somente leitura**. Reforço no código: nenhum import de `src/server/crm/cadence.server.ts` ou `src/server/relationship/*` dentro de `src/lib/agenda.functions.ts`.

**16. View vs SECURITY DEFINER — escolha justificada.** A opção mais segura aqui é **função `SECURITY DEFINER` sem parâmetro de executivo**. Motivos, considerando o RLS atual:
- Uma view herda o RLS do consultante. Como o RLS de `crm_cadence_tasks` hoje é restrito a admin/manager, uma view **não resolveria** o problema (executivo comum continuaria sem ver a própria cadência); e uma view `security_invoker=false` seria equivalente à função, mas sem controle de argumentos.
- A função resolve o dono **internamente** via `current_executive_id()`. Não existe parâmetro de executivo a manipular, logo é impossível consultar tarefas de outro executivo trocando argumento.
- Admin: a função aplica `has_role(auth.uid(),'admin')` para o caso de visão ampliada, mantendo exatamente as permissões já existentes.
- A função aceita apenas janela de datas e retorna colunas fechadas (lead, data, canal, dia da cadência, status) — não é `SELECT *`, então não vira porta lateral para a tabela.
- `search_path = public`, `STABLE`, sem SQL dinâmico; `EXECUTE` para `authenticated` e `service_role`, revogado de `anon`/`PUBLIC`. Alinhada à Memória de Segurança do projeto.
Nenhuma política existente de `crm_cadence_tasks` é afrouxada.

**17. Isolamento de `group_leads`.** Confirmo o isolamento total. Solar/Seguros **não** entram em `portal_leads`, CRM financeiro, cadência, remarketing, GreenSales, `relationship_*` nem nos backups do Portal dos Leads (a rotina de backup enumera tabelas explicitamente e `group_leads` não será adicionada). Garantia estrutural: tabela sem FK e sem trigger apontando para estruturas financeiras; leitura e escrita exclusivamente por um arquivo novo (`src/lib/group-leads.functions.ts`). Confirmo também que **nenhuma função existente desses módulos será modificada** para suportar `group_leads`.

**18. Identidade da unidade.** A unidade é determinada pela **rota**, não pelo cliente: rotas de captação distintas por unidade, e o handler de servidor deriva a unidade do próprio caminho, com allowlist `financeira | solar | seguros`. Querystring `?unit=` é ignorada. O CHECK do banco (`unit in ('solar','seguros')`) impede gravação de valor fora do conjunto, e o handler de Solar/Seguros grava **apenas** em `group_leads` — não tem sequer caminho de código para `portal_leads`, e vice-versa. Logo, não há requisição capaz de transformar Solar em Financeira ou o contrário.

**19. Botão "Atendido".** Confirmo item a item: `novo → atendido`; `handled_at = now()`; `handled_by` preenchido no **servidor** a partir do executivo autenticado (`current_executive_id()`), nunca vindo do cliente; o lead não é excluído; não existe "Não atendido"; não existe exclusão (sem política de DELETE); não existe jornada, cadência nem acompanhamento automático. E sim: **o lead atendido continua visível na fila**, apenas com o status alterado; a fila ordena "novo" primeiro.

**20. Página institucional.** Confirmo o escopo exato: Hero, a frase "Impactando o futuro de pessoas e empresas com inovação, credibilidade e respeito", os indicadores +2.000 unidades / +500k clientes / +R$20Bi faturamento, a seção "Nossos Serviços" com Velox Soluções Financeiras, Velox Solar e Velox Seguros, e o CTA "Saiba mais" de cada modalidade. Não terá menu hambúrguer, "Sobre o Grupo", "Modelos de negócios", "Expanda sua marca", diferenciais extras, acesso ao Workspace, acesso ao Portal dos Leads, login ou qualquer atalho interno. "Seja um Franqueado", se mantido no topo, apenas rola até as modalidades — não abre cadastro. Página construída do zero com os tokens visuais existentes, sem importar a página pública atual.

---

## Ajustes que estas respostas exigem no plano da Etapa B

1. **`/entrar` sai do plano.** O destino do guard sem sessão é `/f/executivo` (login real existente), não `/entrar` — que é rota do Gateway do investidor. Correção relevante: o plano anterior teria enviado executivos para o Portal público.
2. **Domínio operacional inexistente hoje.** A separação por host fica parametrizada e **desligada** por padrão; a ativação depende de configuração de domínio, declarada como pendência.
3. **`f.tsx` não recebe `ssr: false`** (por causa de `/f/$slug` público); o `ssr: false` vai só nos quatro layouts operacionais.
4. **CHECK `ends_at > starts_at`** vira obrigatório junto do `EXCLUDE`.
5. **Escolha fechada**: função `SECURITY DEFINER` sem parâmetro de executivo, em vez de view.
6. **A verificar no início da execução**: valores reais da coluna `status` de `portal_meetings` (para excluir canceladas do conflito) e se existem eventos já sobrepostos em `workspace_agenda_events` que impeçam criar a constraint.

## Plano Final de Implementação (ordem)

1. `src/routes/f.tsx` (layout neutro, sem guard) + `src/routes/f.executivo.tsx` (novo) + `OperationalGuard` nos quatro layouts operacionais com `ssr: false`; remoção dos `useEffect` de sessão redundantes; correção do shell do Remarketing em `src/routes/__root.tsx`.
2. `validateExecutiveSlug` bloqueante (case-insensitive, pós-normalização) em `src/lib/executive-auth.ts` + UI em `f.executivo.usuarios.tsx`; centralização da navegação do menu em `src/lib/business-unit.ts`.
3. Agenda: identidade resolvida no servidor, sobreposição real com semântica `[)`, migration `btree_gist` + `CHECK` + `EXCLUDE`, "Ações do dia" sem horário fabricado, função `SECURITY DEFINER` de cadência por responsável + índice `crm_cadence_tasks (status, due_date)`, timezone via `Intl`.
4. Detecção de host institucional por `getRequest()` + `VITE_INSTITUTIONAL_HOST`; página do Grupo Velox em `/`; 404 de `/f` no host institucional; `robots: noindex` no `/f`.
5. Captação por rota: Financeira permanece no fluxo atual; migration `group_leads` (CHECKs, índices, GRANTs sem `anon`, RLS interna, trigger de `updated_at`, sem DELETE); filas Solar e Seguros com botão "Atendido".
6. Matriz de testes A–F em navegador headless, incluindo `count(*)` de `portal_leads` antes/depois e os casos de redirect com search params.
