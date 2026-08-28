# Auditoria Pós-Implementação — Parte A (/f + Agenda Operacional Global)

Diagnóstico do código realmente implantado. Nenhuma alteração foi feita.

## 1. Estrutura /f

**1. Rotas existentes sob `/f`** (arquivos reais em `src/routes`):
- Layouts: `f.tsx`, `f.executivo.tsx`, `f.crm.tsx`, `f.remarketing.tsx`
- Workspace (33 telas): `f.executivo.index`, `home`, `dashboard`, `administracao`, `alertas`, `backups`, `biblioteca`, `brain`, `campanhas`, `captacao`, `celebracao`, `central-backup`, `configuracoes`, `criativa`, `greensales`, `greensales-sync`, `homologacao`, `identidade`, `institucional`, `investidores`, `kpi`, `laboratorio`, `perfil`, `recursos`, `relatorios`, `reunioes`, `revista`, `templates`, `teste-cadencia`, `usuarios`
- Módulos: `f.crm.index`, `f.remarketing.index`, `f.portal-leads`
- Link público: `f.$slug`

**2 e 3. Telas antigas `/executivo/...`:** todas as 30 são stubs de 13 linhas com `beforeLoad` lançando `redirect({ to: "/f/executivo/...", replace: true, search })` e `component: () => null`. Nenhuma lógica funcional remanescente, nenhuma duplicação.

**4. `/crm`, `/remarketing`, `/portal-leads`:** idênticos — stubs de redirect apenas. A implementação funcional vive somente em `f.crm.index.tsx`, `f.remarketing.index.tsx` e `f.portal-leads.tsx`.

## 2. Business Unit

**5. `unitPath()` não é usado por ninguém.** `rg` confirma que a única ocorrência do helper está no próprio `src/lib/business-unit.ts`. Há **166 ocorrências de strings `/f/...` escritas diretamente** no código (rotas, `src/config/modules.ts`, `executive-shell.tsx`, `portal-leads-board.tsx`, `recognition-host.tsx`, `google-status-indicator.tsx`, `operational-guard.tsx`, `executive-auth.ts`, `portal-brands.ts`, `__root.tsx` com 8). Do total de `business-unit.ts`, só `isReservedSlug`/`validateExecutiveSlug`/`isOperationalPath` estão em uso real.
Divergência relevante: sim — a "camada central de navegação" existe como API mas não como prática.

**6.** A estrutura de dados (`BUSINESS_UNITS`, `getUnit`, `currentUnit`, `unitPath`) já suporta `/s` e `/seg`, e `s.$slug.tsx`/`seg.$slug.tsx` existem. Porém, como nenhuma tela consome `unitPath()`, abrir Solar/Seguros hoje exigiria tocar em ~166 strings. A lógica de unidade não precisa ser reconstruída; a navegação precisa ser migrada.

## 3. Conflito /f + link personalizado

**7.** O TanStack Router dá precedência a segmentos estáticos sobre o dinâmico: `/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads` vencem sempre `/f/$slug`. `f.$slug.tsx` só é atingido por qualquer outro segmento e redireciona para `/` com `search { e, m, o, b }`.

**8 e 9.** `RESERVED_UNIT_SLUGS = ["executivo","crm","remarketing","portal-leads"]`. Validação em duas camadas:
- UI: `f.executivo.usuarios.tsx` chama `validateExecutiveSlug` e bloqueia com aviso + sugestão.
- Persistência: `saveUsers()` em `src/lib/executive-auth.ts` lança `InvalidExecutiveSlugError` antes de gravar.
Ressalva importante: a persistência é `window.localStorage`, não o banco. A proteção é real no único ponto de gravação existente, mas é uma proteção **de cliente** — não há constraint/validação equivalente no servidor porque os executivos não são persistidos em tabela.

## 4. Proteção / autenticação

**10.** `OperationalGuard` (`src/components/auth/operational-guard.tsx`) é aplicado nos layouts `f.executivo`, `f.crm`, `f.remarketing` e na folha `f.portal-leads`, todos com `ssr: false`. Sem sessão nada é renderizado (`if (!checked || !session) return null`) e há `navigate({to:"/f/executivo", replace:true})`. `/f/executivo` (tela de acesso) é o único caminho público do ramo, via `publicPaths`.

**11.** A sessão é lida de `localStorage` (`getSession()`), portanto o guard é de UI, não de dados. O que realmente protege dados é RLS + `current_executive_id()` no backend. Não encontrei rota operacional sem guard. Risco residual: quem forjar a chave de sessão no `localStorage` renderiza a casca do Workspace, mas as consultas continuam limitadas pelo RLS.

**12.** `/` permanece institucional/gateway. `__root.tsx` continua devolvendo à Home qualquer módulo público acessado direto, e explicitamente **não** intercepta `/f/executivo`, `/f/crm`, `/f/portal-leads`, `/f/remarketing`. Nenhum atalho público novo para ambiente interno.

## 5. Agenda Operacional Global

**13.** `__root.tsx` renderiza `<AgendaDock />` quando `isOperationalPath(pathname)` é verdadeiro — ou seja, primeiro segmento = prefixo de unidade e segundo ∈ `{executivo, crm, remarketing, portal-leads}`. Confere exatamente com o esperado. Além disso o dock retorna `null` sem sessão de executivo.

**14.** Sim: painel lateral `fixed inset-0 z-[70]` com overlay, sem `navigate`, sem mudança de rota, sem perda de contexto.

**15. Fontes (todas em `src/lib/agenda.functions.ts` → `listAgenda`):**
- a) eventos próprios: tabela `workspace_agenda_events`, filtrada por `executive_id = current_executive_id()`;
- b) reuniões: tabela `portal_meetings` (`scheduled_at`, `duration_min`), `readOnly: true`, ignorando status `Cancelada`;
- c) ações de cadência: RPC `agenda_cadence_tasks(_from, _to)` (SECURITY DEFINER) sobre `crm_cadence_tasks` + `portal_leads`.

**16.** Não há duplicação: são tabelas distintas e a Agenda nunca copia reunião para `workspace_agenda_events`; reuniões recebem id prefixado (`meeting:<id>`) e `readOnly`. A Agenda não cria evento espelho.

## 6. Conflito de horário

**17.** Dupla proteção, com escopos diferentes:
- Banco: `EXCLUDE USING gist (executive_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (priority='maxima')` — cobre **apenas evento próprio × evento próprio**.
- Server function: verifica interseção contra `portal_meetings` antes do insert — cobre **evento × reunião**, mas **somente no código**, sem garantia de banco.

**18.** Sim, existe uma janela de corrida, restrita ao caso (b): duas requisições simultâneas — uma criando o compromisso e outra criando/reagendando a reunião em `portal_meetings` — podem gerar sobreposição evento×reunião, porque a checagem é lida-e-depois-escreve sem lock nem constraint. Já o caso (a) (máxima × máxima) é imune: a exclusão é imposta pelo banco e o código trata `23P01`.

## 7. Banco / RLS — `workspace_agenda_events`

- Campos: `id uuid pk default gen_random_uuid()`, `executive_id text NOT NULL`, `title text NOT NULL`, `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`, `priority text NOT NULL default 'maxima'`, `source text NOT NULL default 'agenda'`, `note text`, `created_by uuid`, `created_at`, `updated_at`.
- Índices: pkey; `(executive_id, starts_at)`; índice GiST do EXCLUDE.
- Constraints: pkey; CHECK `priority ∈ (maxima,media,minima)`; CHECK `ends_at > starts_at`; EXCLUDE de sobreposição para `maxima`.
- Trigger: `workspace_agenda_events_updated` (updated_at).
- RLS: habilitada. 4 policies (SELECT/INSERT/UPDATE/DELETE), todas `has_role(auth.uid(),'admin') OR executive_id = current_executive_id()`.
- Grants: `authenticated` e `service_role` com privilégios; `anon` também aparece com privilégios de tabela (irrelevante na prática porque as policies exigem identidade, mas é mais permissivo do que o necessário).

**20.** Não. Um executivo só enxerga/altera/apaga o que tem `executive_id = current_executive_id()`; admin (`has_role`) tem acesso amplo — que é o comportamento esperado. Observação: `executive_id` é `text` livre, sem FK para `executive_profiles`.

## 8. Ações de cadência

**21.** A Agenda apenas exibe. Nenhum ponto de `agenda.functions.ts` ou do dock escreve em `crm_cadence_tasks`.

**22.** `agenda_cadence_tasks` resolve o executivo internamente (`current_executive_id()`, com `_executive_id` aceito só para admin) e faz um `SELECT` puro de tarefas com `status='pendente'`, `due_date` na faixa, do responsável. É `STABLE SECURITY DEFINER` — não pode gravar. Zero risco de a Agenda criar ou alterar cadência.

**23.** Sim, há descompasso conceitual: a Agenda rotula os itens como `D{step_day} · Ligação/Mensagem`, derivado da coluna `step_day` de `crm_cadence_tasks`, enquanto a arquitetura nova fala em etapas E0/E1/E2/E3/E5/E6/E7. Dependência concreta para a Parte B: a função `agenda_cadence_tasks` (assinatura de retorno) e a montagem de título em `listAgenda` teriam que passar a ler a identificação da etapa do novo motor; hoje não existe coluna de etapa nessa consulta.

## 9. Timezone

**24.** Comportamento atual:
- Criação: o formulário monta `new Date("YYYY-MM-DDTHH:mm:00").toISOString()` — sem sufixo de fuso, o JS interpreta como horário **local do navegador**. No Brasil (UTC−3) 14:00 vira `17:00Z`, correto.
- Exibição: `toLocaleString("pt-BR", ...)` sem `timeZone`, ou seja, também no fuso do navegador — volta a 14:00.
- Banco: `timestamptz`, armazenamento absoluto, sem ambiguidade.
- Faixa consultada: `dayRange()` usa o dia local do navegador → ISO. Consistente.
- Agrupamento por dia: `dayOf()` no servidor força `America/Sao_Paulo`, o que é correto e independente do cliente.

Risco identificado: o sistema é **relativo ao fuso do navegador**, não fixado em `America/Sao_Paulo`. Um executivo com o computador em outro fuso (ou viajando) verá e gravará horários deslocados, e haverá inconsistência entre o horário exibido (fuso do navegador) e o agrupamento por dia (São Paulo) — um compromisso pode aparecer sob o dia errado. Não há bug para usuários em horário de Brasília.

## Conclusão

**A) Implementado corretamente**
- Migração completa das 33 telas para `/f/executivo/...`; 34 stubs legados apenas redirecionam com `replace` + `search`.
- Precedência estática vs `/f/$slug`.
- `OperationalGuard` único, `ssr: false`, sem "pisca"; `/` continua institucional.
- Agenda como painel sobre a tela, nos 4 ambientes esperados, sem duplicar reuniões e sem criar regra de cadência.
- `agenda_cadence_tasks` é leitura pura e segura por responsável.
- RLS, policies, índices, CHECKs e trigger de `workspace_agenda_events` corretos e isolados por executivo.

**B) Implementado, mas com divergência**
- `unitPath()` existe e não é usado: 166 caminhos `/f/...` literais espalhados.
- Bloqueio de slugs reservados é real no único ponto de gravação, mas esse ponto é `localStorage`, não o banco.
- Rótulo `D{step_day}` da Agenda ainda pertence ao vocabulário antigo de cadência.
- `anon` possui grants de tabela em `workspace_agenda_events` sem necessidade.

**C) Possível problema técnico**
- Corrida evento máximo × reunião: proteção só no código, sem constraint nem lock.
- Timezone preso ao fuso do navegador na criação/exibição, enquanto o agrupamento por dia usa São Paulo — divergência possível de dia exibido fora do horário de Brasília.
- Sessão operacional em `localStorage`: o guard é de UI; a proteção efetiva é o RLS.
- `executive_id text` sem FK para `executive_profiles` permite valor órfão se alguma rotina gravar fora do fluxo atual.

**D) Precisa ser decidido antes da próxima implementação**
1. Migrar toda a navegação para `unitPath()` agora ou só quando Solar/Seguros forem ativados?
2. Fixar a Agenda em `America/Sao_Paulo` (fuso do negócio) ou manter fuso do navegador?
3. Conflito evento × reunião deve virar garantia de banco (tabela unificada de ocupação ou lock por executivo) ou permanece validação de aplicação?
4. Vocabulário das ações na Agenda: manter `D{n}` até a Parte B ou já expor E0/E1/E2… (exige alterar `agenda_cadence_tasks`)?
5. Executivos permanecem em `localStorage` ou passam a tabela no banco (o que tornaria o bloqueio de slug uma regra de servidor)?

**E) Sem problema identificado**
- Ausência de lógica funcional duplicada nas rotas legadas.
- Ausência de atalho público para ambientes internos.
- Ausência de escrita da Agenda sobre o motor de cadência.
- Isolamento por executivo nas policies.
