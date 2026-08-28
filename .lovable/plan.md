# Etapa B — Respostas técnicas e arquitetura proposta (sem implementação)

## Respostas

**1. Layout-pai `/f`.** Confirmado. Crio `src/routes/f.tsx` apenas como layout neutro (`component: () => <Outlet />`, `head` com `robots: noindex`), **sem guard**. `/f/$slug` continua filho direto desse layout e permanece público. O guard entra um nível abaixo, em layouts operacionais próprios: `f.executivo.tsx` (novo, hoje inexistente), `f.crm.tsx` e `f.remarketing.tsx` (já existem) e no arquivo folha `f.portal-leads.tsx`. Como `/f/$slug` nunca é filho desses layouts, é arquiteturalmente impossível o guard alcançá-lo. Criar `f.executivo.tsx` exige nada além do layout: as 30 rotas `f.executivo.*` já têm o ID correto e passam a ser filhas automaticamente.

**2. Guard único.** Estratégia: um componente `OperationalGuard` usado pelos quatro layouts acima, mais `ssr: false` nesses layouts (a sessão vive no `localStorage`, então SSR não pode decidir). Fluxo: enquanto a sessão não é resolvida, o guard renderiza um placeholder neutro e **não monta `<Outlet />`** — é isso que elimina o flash, já que hoje o flash vem de a tela montar e só depois redirecionar. Sem sessão: redireciona para `/entrar`. Reutiliza `getSession()` de `src/lib/executive-auth.ts` e a expiração de `src/lib/crm/session.ts`; nenhuma segunda autenticação é criada, nenhum provider novo. Permissões por módulo continuam onde estão (`useModuleAccess` / `ModuleAccessDenied`): o guard resolve **sessão**, não **permissão**. As checagens `useEffect`+`getSession()` das telas folha são removidas apenas onde forem redundantes; as que também decidem papel (ex.: `f.executivo.usuarios.tsx` com `canManageUsers`) permanecem. `CrmShell` mantém o login inline — o guard passa a tratá-lo como caso já autenticado.

**3. Remarketing.** Confirmado. `/f/remarketing` passa a ser tratado como operacional em `resolveShell()` e em `RootRoutes` (`src/routes/__root.tsx`), no mesmo ramo de CRM/Portal dos Leads: sem `EditorialShell`, sem `JourneyChrome`, sem `WhatsAppFloating`, sem `JourneyTracker`. Mantém apenas seu header próprio, `<Toaster />` e a `AgendaDock`.

**4. business-unit.ts e type-safety.** Não vou espalhar `as never`. Estratégia em duas camadas: (a) as rotas continuam declaradas com literais (`createFileRoute("/f/...")`) — isso é exigência do router e não muda; (b) a navegação centraliza-se num mapa tipado `UNIT_ROUTES` em `src/lib/business-unit.ts` com literais constantes (`as const`), consumido pelo menu. O único arquivo que realmente precisa da centralização é `src/components/executive/executive-shell.tsx` (24 ocorrências, é o menu). Os `navigate({ to: "/f/executivo" })` das telas folha desaparecem naturalmente ao introduzir o guard (item 2), o que reduz sozinho a maior parte das ~35 strings. `unitPath()` permanece para uso não-tipado (links externos, `window.open`, comparações de pathname). Nenhuma varredura cosmética nos demais arquivos.

**5. Slugs reservados.** Confirmado. `safeExecutiveSlug()` deixa de ser a proteção: a validação passa a **rejeitar**. Introduzo `validateExecutiveSlug()` retornando erro explícito quando o slug é reservado, aplicado na criação em `src/routes/f.executivo.usuarios.tsx` e na função de gravação em `src/lib/executive-auth.ts`, de modo que qualquer campo de slug editável futuro herde a regra pelo mesmo ponto. `getExecutiveBySlug()` continua bloqueando na leitura (defesa em profundidade). `safeExecutiveSlug()` é mantido apenas para sugestão de valor alternativo na UI, nunca como gravação silenciosa.

**6. Agenda — identidade.** Confirmado. `listAgenda`/`createAgendaEvent`/`deleteAgendaEvent` (`src/lib/agenda.functions.ts`) deixam de aceitar `executiveId` do cliente: o valor passa a ser resolvido no servidor via `current_executive_id()` (RPC), dentro do handler autenticado. Executivo comum não muda de comportamento — ele já enviava o próprio id. Um parâmetro opcional `viewExecutiveId` só é aceito quando `has_role(auth.uid(),'admin')` retorna verdadeiro; caso contrário é ignorado (não gera erro, evitando regressão). `deleteAgendaEvent` passa a validar dono antes do delete, em vez de depender só do RLS.

**7. Agenda — conflito.** Confirmado: a regra é sobreposição real (`novoInício < fimExistente && novoFim > inícioExistente`), e a **consulta** precisa mudar junto, pois hoje filtra por `starts_at` dentro do dia e perde eventos que começaram antes. A busca passará a ser `starts_at < novoFim AND ends_at > novoInício` (para reuniões, `scheduled_at + duration_min`), sem recorte por dia — o que também resolve travessia de meia-noite. Sobre corrida: sim, proteção também no banco, com `EXCLUDE USING gist (executive_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (priority = 'maxima')` — requer `btree_gist`. A checagem da aplicação continua existindo para produzir a mensagem amigável; a constraint é a garantia. Reuniões (`portal_meetings`) ficam fora da constraint (tabela distinta) e continuam cobertas apenas pela checagem aplicacional — limitação assumida e declarada.

**8. Agenda — fuso e ação do dia.** Confirmado: a Agenda deixa de fabricar `09:00-03:00`. O `AgendaItem` ganha um discriminador (`kind: "compromisso" | "acao_do_dia"`); tarefas de cadência viram `acao_do_dia`, com apenas `dueDate` (data), renderizadas numa faixa "Ações do dia" separada da linha do tempo por hora. Nenhum horário é inventado, nada entra no cálculo de conflito e o offset fixo desaparece do código. Datas/horas reais continuam em UTC no banco e são formatadas com `America/Sao_Paulo` via `Intl`, não com string `-03:00`.

**9. Agenda — cadência.** Confirmado: a Agenda não cria, não altera, não conclui tarefa, não define E1/E2/E3, não inventa ação. Isolamento no código: em `agenda.functions.ts` a cadência é lida em um único bloco `SELECT`-only; nenhum import de `src/server/crm/cadence.server.ts` nem de `src/server/relationship/*`; a rotulagem (`D{n} · Ligação/Mensagem`) fica em componente de apresentação, não na função de servidor. Qualquer ação sobre a tarefa continua sendo feita no CRM.

**10. Agenda — performance.** Corrijo agora, **sem tocar no motor**. Hoje `listAgenda` carrega toda a carteira (`portal_leads` do executivo) só para montar um `IN (...)`. Solução sem alterar a lógica do motor: uma **view** `crm_cadence_tasks_por_responsavel` (ou função `SECURITY DEFINER` de leitura) que faz o join `crm_cadence_tasks × portal_leads` no banco e expõe `executive_id`, `due_date`, `status`, `channel`, `step_day`, nome do lead. A Agenda passa a fazer uma consulta filtrada por responsável e período. Isso também resolve o problema de RLS detectado na auditoria: hoje `crm_cadence_tasks` só é legível por admin/manager, então **executivo comum não vê cadência nenhuma na Agenda** — a função `SECURITY DEFINER` restringe por `current_executive_id()` e devolve só o que é dele. Índice novo em `crm_cadence_tasks (status, due_date)`. Nenhuma coluna do motor é alterada.

**11. Host institucional.** Detecção no servidor, uma única vez, no `beforeLoad` do `__root` (ou em `src/server.ts`), usando `getRequest()` de `@tanstack/react-start/server` — já usado no projeto (`src/server/environment.server.ts`, `auth-middleware.ts`). O host lido é colocado no contexto do router e usado apenas por `src/routes/index.tsx` para decidir **qual componente renderizar**: host institucional → página do Grupo; qualquer outro host → exatamente a Home atual, sem alteração de comportamento, de search params ou de Gateway. Nada mais na aplicação consulta host. Alternativa mais simples, se preferirem: variável de ambiente `VITE_INSTITUTIONAL_HOST` para permitir testes no preview.

**12. Isolamento do host institucional.** Três camadas, nenhuma delas "esconder botão": (a) a página institucional não referencia rota interna alguma; (b) o layout `f.tsx` recusa o host institucional já no `beforeLoad` do servidor, devolvendo 404 — ou seja, digitar `portalvelox.com.br/f/crm` não chega a renderizar; (c) os dados continuam protegidos por RLS e `requireSupabaseAuth`, que é a barreira que vale mesmo se o host for burlado. Também adiciono `robots: noindex` no layout `/f`. Ressalva honesta: se hoje o operacional e o institucional forem servidos pelo **mesmo** host, a camada (b) não tem o que separar — então preciso da confirmação de qual host hospedará o operacional. Enquanto isso, implemento (a) e (c) e deixo (b) parametrizado.

**13. Rota `/` atual.** Confirmado: **não** substituo a aplicação da rota `/`. `/`, Gateway, `/origem/tiktok`, `/origem/meta`, `/f/$slug`, `/e/$slug` e os overlays permanecem byte-a-byte no comportamento. A única mudança em `src/routes/index.tsx` é um desvio no topo do componente: host institucional → renderiza `<GrupoVeloxPage />`; caso contrário → o componente atual, intacto. O `head()` também passa a variar por host, para o SEO institucional não sobrepor o do Portal.

**14. Página institucional mínima.** Monto do zero, com os tokens visuais existentes (`EditorialShell`/`styles.css`), sem importar componentes da página pública atual. Sem menu hambúrguer, sem "Sobre o Grupo", sem "Modelos de negócios". "Seja um Franqueado" no topo, se existir, apenas rola até a seção das três modalidades — não abre cadastro. Preservo a frase-conceito ("Impactando o futuro de pessoas e empresas com inovação, credibilidade e respeito") e os indicadores +2.000 unidades, +500k clientes, +R$20Bi faturamento.

**15. Seções.** Confirmado: somente Hero, indicadores, "Nossos Serviços", as três modalidades e o CTA por modalidade. Nada de "Expanda sua marca" ou blocos de diferenciais. Reaproveito estilos e primitivas de UI, nunca a página inteira.

**16. Captação Financeira.** Confirmado: a origem vem da **rota** do CTA e é resolvida no servidor (mesmo padrão já usado por `src/routes/origem.$channel.tsx`), com allowlist `financeira | solar | seguros`. Nada de campo oculto nem querystring confiável. Financeira continua no fluxo atual: `resolve_portal_identity` → `portal_leads` → Portal dos Leads. Nenhum segundo CRM.

**17. Solar e Seguros isolados.** Confirmado: tabela nova `group_leads`, `unit` restrito a `solar|seguros` por CHECK, status `novo|atendido`. Isolamento garantido por construção: tabela sem FK e sem trigger apontando para qualquer estrutura financeira; nenhum arquivo de `src/server/crm/*`, `src/server/relationship/*`, `src/server/remarketing/*` ou `src/server/greensales.server.ts` é importado ou alterado; o leitor da fila é uma função de servidor nova que lê exclusivamente `group_leads`. Nenhum registro Solar/Seguros existe em `portal_leads`, portanto não há como aparecer no Portal dos Leads, na cadência, no engajamento ou nos backups atuais.

**18. Fila no Workspace.** Confirmado: duas telas minimalistas ("Leads Solar" e "Leads Seguros"), cards com nome, telefone, e-mail, unidade/origem, data de entrada e status. Sem jornada, reunião, nota, IA, relatório, acompanhamento ou cadência. Abrir o card não dispara nada.

**19. Status.** Confirmado: único movimento `novo → atendido`, sem exclusão, sem "não atendido", sem etapas intermediárias. Ao marcar, grava `handled_at` e `handled_by` (id do executivo autenticado, resolvido no servidor). Nada é apagado.

**20. Banco (lista prévia).**
- Tabela nova `public.group_leads`: `id uuid pk default gen_random_uuid()`, `unit text not null check (unit in ('solar','seguros'))`, `name text not null`, `phone text not null`, `email text not null`, `origin text not null`, `status text not null default 'novo' check (status in ('novo','atendido'))`, `handled_at timestamptz`, `handled_by text`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- Índices: `(unit, status, created_at desc)`; índice de dedupe por telefone normalizado.
- GRANTs: `SELECT, INSERT, UPDATE ON public.group_leads TO authenticated`; `GRANT ALL ... TO service_role`; **sem** `anon` (a captação pública entra por server function autenticada como serviço, não pelo cliente).
- RLS: leitura/atualização para papéis internos (`has_role admin/manager` ou `current_executive_id() is not null`); sem política de DELETE (lead não é apagado).
- Trigger: apenas `update_updated_at_column` (função já existente, não alterada).
- Extensão `btree_gist` + constraint `EXCLUDE` em `workspace_agenda_events` (item 7).
- View/função `SECURITY DEFINER` de leitura de cadência por responsável + índice `crm_cadence_tasks (status, due_date)` (item 10). **Somente leitura e índice — nenhuma coluna, trigger ou política existente é alterada.**
- Confirmo explicitamente: **não** altero estrutura nem triggers de `portal_leads`, nem tabelas do CRM financeiro, nem tabelas de cadência (além do índice), nem GreenSales, nem `relationship_*`, nem a aquisição existente.

**21. Testes.** Executarei exatamente a matriz A–F pedida, com navegador headless contra o servidor local: rotas públicas (`/`, `/origem/tiktok`, `/origem/meta`, `/f/$slug`, `/e/$slug`), host institucional simulado por header `Host`, áreas internas com e sem sessão, tentativa de acesso interno pelo host institucional, captação nas três origens (conferindo que Solar/Seguros não geram linha em `portal_leads`) e Agenda nos quatro ambientes (identidade, conflito, reuniões, cadência). Também conferirei `count(*)` de `portal_leads` antes e depois.

**22.** Não inicio implementação. Abaixo o consolidado.

---

## Arquivos que serão alterados
`src/routes/__root.tsx` (shell do Remarketing, host no contexto), `src/routes/index.tsx` (desvio por host, sem tocar no fluxo atual), `src/routes/f.crm.tsx`, `src/routes/f.remarketing.tsx`, `src/routes/f.portal-leads.tsx` (guard), telas `f.executivo.*` (remoção do `useEffect` de sessão redundante), `src/components/executive/executive-shell.tsx` (navegação centralizada), `src/lib/business-unit.ts`, `src/lib/executive-auth.ts` + `src/routes/f.executivo.usuarios.tsx` (slug rejeitado), `src/lib/agenda.functions.ts` e `src/components/agenda/agenda-dock.tsx`.

## Arquivos novos
`src/routes/f.tsx`, `src/routes/f.executivo.tsx`, componente `OperationalGuard`, página do Grupo Velox + suas seções, rota(s) de captação por unidade, `src/lib/group-leads.functions.ts`, telas de fila Solar/Seguros sob `/f/executivo`.

## Arquivos intocados
`src/lib/portal-leads.functions.ts`, `src/components/crm/portal-leads-board.tsx`, `src/server/crm/*`, `src/server/relationship/*`, `src/server/remarketing/*`, `src/server/greensales.server.ts`, `src/routes/origem.$channel.tsx`, `src/routes/f.$slug.tsx`, `src/routes/e.$slug.tsx`, `src/routes/manual/*`, `src/integrations/supabase/*`.

## Migrations
1. `group_leads` (tabela, CHECKs, índices, GRANTs, RLS, trigger de `updated_at`).
2. `btree_gist` + constraint `EXCLUDE` de sobreposição em `workspace_agenda_events`.
3. Função/view de leitura de cadência por responsável + índice `crm_cadence_tasks (status, due_date)`.

## Riscos identificados
- `ssr: false` nos layouts operacionais muda o momento de montagem: telas que dependiam de SSR podem exibir um instante de placeholder (aceitável, e é o que elimina o flash).
- Criar `f.executivo.tsx` reorganiza a árvore de rotas; exige revalidar as 30 telas.
- A constraint `EXCLUDE` pode falhar na criação se já existirem eventos sobrepostos — verifico e reporto antes de aplicar.
- Desvio por host em `/`: se o host institucional não estiver corretamente configurado, o Portal atual poderia ser servido no domínio errado; por isso o default é sempre o comportamento atual.
- Remoção dos guards por tela: risco de deixar alguma tela sem proteção — mitigado removendo apenas onde o layout comprovadamente cobre.

## Ordem de execução
1. `f.tsx` + `f.executivo.tsx` + `OperationalGuard` (guard único) e correção do shell do Remarketing.
2. Slug reservado rejeitado + centralização da navegação do menu.
3. Endurecimento da Agenda: identidade no servidor, sobreposição real + constraint, ação do dia sem horário fabricado, leitura de cadência por responsável.
4. Página institucional do Grupo Velox por host, sem tocar em `/`.
5. Captação por rota: Financeira no fluxo atual; `group_leads` + filas Solar/Seguros + botão "Atendido".
6. Matriz de testes A–F e relatório final.
