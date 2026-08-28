# Auditoria Técnica — Estado Real do Projeto antes da PARTE B

Nada foi alterado: banco, código, rotas e componentes permanecem intactos.
Todas as afirmações abaixo vieram de leitura de arquivos e consultas ao banco nesta rodada.

## Respostas

**1. Separar portalvelox.com.br de /f — ESTÁ PARCIAL (base pronta, lógica inexistente)**
`src/server/environment.server.ts` já lê o host via `getRequest()`, mas apenas para decidir homologação x produção. Não existe nenhuma leitura de host para decidir conteúdo institucional. A raiz `/` (`src/routes/index.tsx`) é o Portal do Investidor Financeiro para qualquer host. É possível separar sem quebrar preview/localhost desde que a ativação dependa de uma variável configurada (host institucional declarado), com fallback = comportamento atual.

**2. /f/$slug — ESTÁ PRONTO e não conflita**
`src/routes/f.$slug.tsx` só faz `beforeLoad` → `redirect` para `/` com `search { e, m, o, b }`. Não renderiza nada. Os segmentos estáticos (`/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads`) têm precedência no roteador sobre `$slug`. Risco real: se o institucional passar a viver em `/`, o redirect do link personalizado cairia na Home institucional — este é o ponto a decidir, não uma colisão de rotas.

**3. Slug reservado — ESTÁ PRONTO (corrigido)**
`validateExecutiveSlug` (em `src/lib/business-unit.ts`) normaliza, compara case-insensitive e REJEITA reservados. `safeExecutiveSlug` continua exportado apenas como alias deprecado de `suggestExecutiveSlug` e não é usado em lugar nenhum. A rejeição é aplicada na UI (`f.executivo.usuarios.tsx:147`) e no ponto de persistência (`src/lib/executive-auth.ts:345`).

**4. Caminhos literais /f/... — EXISTE, MAS PRECISA SER ALTERADO**
Hoje há 153 ocorrências literais de `"/f/..."` no código e `unitPath()` tem 0 usos reais (só a própria definição e comentários). Risco de migrar agora: `Link to=` do TanStack é tipado por literal; trocar por função quebra a inferência de tipos das rotas. Recomendação: NÃO migrar em massa na Parte B; usar `unitPath()` só em código novo e em navegação dinâmica.

**5. Agenda — EXISTE, MAS PRECISA SER ALTERADO**
`src/lib/agenda.functions.ts` lê três fontes: `workspace_agenda_events`, `portal_meetings` e a função `agenda_cadence_tasks`, que lê `crm_cadence_tasks` e devolve `step_day`. O rótulo é montado como `D{step_day}`. Ou seja: a Agenda ainda está no motor ANTIGO. Não existe fonte única de etapa.

**6. Dois motores — fluxo real**
- Antigo (ligações): `src/lib/crm/cadence.ts` + `src/server/crm/cadence.server.ts`, grava em `crm_cadence_tasks` (5 linhas) e `crm_lead_events`. Mensagens neste motor estão desligadas por configuração (`message.enabled = false`).
- Novo (mensagens/relacionamento): `src/lib/relationship/*` + `src/server/relationship/*`, com `relationship_queue` (24 linhas), `relationship_message_sends` (7), `relationship_message_library` (20), `relationship_contents` (17).
Conclusão: ligações vivem no motor antigo; mensagens vivem no novo. A Agenda só enxerga o antigo.

**7. E0…E7 como identificação única — ESTÁ PARCIAL**
Preservar: `relationship_message_library.step_key`, `relationship_message_sends.step`, `relationship_step_content_bindings.step_key` — já são texto de etapa. Alterar: `crm_cadence_tasks` usa `step_day` inteiro; a função `agenda_cadence_tasks` devolve `step_day`; `agenda.functions.ts` rotula `D{n}`. Recomendação: acrescentar `step_key` (texto) às tarefas e à função, mantendo `step_day` para não quebrar histórico, e passar a Agenda a exibir a etapa textual.

**8. Templates Meta x Biblioteca — ESTÁ PRONTO como separação**
`crm_meta_templates` (hoje 0 linhas) é o cadastro de templates aprovados pela Meta; `relationship_message_library` é a fonte operacional versionada. A estrutura já suporta o modelo pedido: a Biblioteca tem `requires_template` e `meta_template_name`, então E0 pode ser a linha que aponta para o template Meta, e E1…RF1 permanecem mensagens livres do motor. Falta apenas criar os slots E2, E5, E6, E7, R0 (ver item 9).

**9. Versionamento e snapshot — ESTÁ PRONTO**
A tabela tem `version`, `active` e `supersedes_id`; editar cria a versão seguinte e desativa a anterior. O envio grava snapshot em `relationship_message_sends` (`rendered_body`, `template_body`, `library_id`, `library_version`, `library_code`, `investor_name_used`). Uma edição futura não toca linhas já enviadas. Hoje todas as 20 linhas estão em V1; E20, E27 e FINALIZACAO existem como slot vazio e inativo (o motor bloqueia o envio em vez de inventar texto).

**10. Conteúdo por etapa — ESTÁ PARCIAL**
`relationship_step_content_bindings` já garante o vínculo declarado etapa → conteúdo, mas com no máximo UM vínculo ativo por etapa (índice único). Sem vínculo, o motor sorteia dentro do grupo de conteúdo. Para "E1 → vários conteúdos possíveis" é preciso relaxar a unicidade para permitir N conteúdos ativos por etapa com uma regra de seleção declarada (ordem/rodízio) — decisão a fechar.

**11. Nomes — ESTÁ PRONTO**
`src/lib/relationship/names.ts` já possui `normalizeName`, `firstName`, `isPlausibleName`, `looksLikeName`, tratamento composto e `NEUTRAL_TREATMENT`. O uso real está em `src/server/crm/automation.server.ts:101`: usa o primeiro nome só quando o nome é plausível; caso contrário aplica o tratamento neutro. O sistema não tenta adivinhar nomes.

**12. E6 manual — ESTÁ PARCIAL (infra pronta, ação não existe)**
Já existe: geração de token URL-safe, validade de 7 dias corridos por emissão, vínculo ao lead, `generated_at`/`expires_at`, encerramento da ocorrência anterior e bloqueio de link vencido (`src/server/relationship/e20.server.ts`, `relationship_e20_occurrences`, `relationship_e20_accesses`). Falta: o botão "Gerar apresentação digital" no card e o texto oficial da mensagem (slot E20 está vazio e inativo).

**13. Reaproveitar E20 para E6 — COMPATÍVEL**
A tabela hoje tem 0 ocorrências, portanto não existe link antigo em circulação para quebrar. A rota `/portal/convite/$token` valida por token e não por etapa. Reaproveitar é seguro desde que só se acrescente rótulo/etapa, sem renomear coluna nem trocar o formato do token.

**14. E7 condicional à ligação — ESTÁ PARCIAL**
`crm_cadence_tasks.outcome` já registra SIM/NAO e "sem registro" é distinguível (`status` diferente de DONE, `outcome` nulo) — `completeCadenceTask` grava o desfecho e o evento correspondente. Atenção: hoje `outcome` assume `"SIM"` como padrão quando não informado; para a regra da E7 isso precisa deixar de ter padrão. Não é necessário um segundo motor.

**15. Ações do Dia — ESTÁ PARCIAL**
A Agenda já trata ações sem horário: `startsAt/endsAt` nulos, faixa própria do dia, ordenadas depois dos compromissos com hora. Nenhum horário é fabricado. Falta apenas incluir as ações de MENSAGEM (hoje só chegam ligações, via `agenda_cadence_tasks`). A regra de cadência deve permanecer no motor; a Agenda continua só lendo.

**16. Notas do Executivo — ESTÁ PARCIAL**
Existem `crm_lead_events` (tipo, mensagem, `data` JSON, data/hora) e `relationship_message_sends` (texto renderizado completo, etapa, executivo, conteúdo). Juntas cobrem quase tudo: ligação com resultado vem de `crm_lead_events`, texto completo vem do snapshot. Falta: uma nota livre escrita pelo executivo e uma leitura unificada por lead para alimentar os cards. Recomendação: não criar tabela paralela de histórico — criar no máximo uma tabela de nota manual e consolidar a exibição no agregador de jornada já existente.

**17. Snapshot do texto — CONFIRMADO e já é assim**
`relationship_message_sends.rendered_body` guarda o texto efetivamente enviado; `library_version` guarda a versão usada. Se E3 virar V2 amanhã, o envio de ontem continua exibindo o texto de ontem.

**18. Raiz / e domínio institucional — NÃO EXISTE diferenciação**
`/` é `src/routes/index.tsx`, a Home do Portal do Investidor Financeiro, igual em qualquer host. Para transformar em Grupo Velox sem quebrar nada, os pontos tocados são: `src/routes/index.tsx` (decidir o que renderizar), uma resolução de host no servidor (a partir de `src/server/environment.server.ts`), `src/routes/f.$slug.tsx` (destino do redirect do link personalizado) e `src/lib/business-unit.ts` (unidades já declaradas).

**19. Captação por modalidade — arquitetura recomendada**
Rotas próprias por modalidade (`/solar`, `/seguros` institucionais) com o handler declarando a modalidade — nunca um campo escolhido pelo visitante. Financeira continua no fluxo atual intacto. Para impedir contaminação: o gravador de Solar/Seguros não deve importar nenhum módulo que escreva em `portal_leads`; a garantia forte é a tabela separada com política própria.

**20. group_leads — NÃO EXISTE**
Nenhuma referência no código e nenhuma tabela no banco. Precisará ser criada com modalidade, dados de contato, origem, status e atendimento — sem chave estrangeira para leads financeiros e sem qualquer gatilho do ecossistema financeiro.

**21. Tabela única x separadas — recomendação: tabela única `group_leads` com coluna de modalidade**
O conjunto de campos é idêntico entre Solar e Seguros e o isolamento crítico é em relação à Financeira, não entre elas. Uma tabela só reduz duplicação de políticas e telas; a modalidade filtra a fila.

**22. Filas simples — implementar como módulo próprio**
Não reutilizar `portal-leads-board` (ele carrega cadência, jornada, engajamento e sincronização GreenSales). Uma tela de lista simples, com filtro por modalidade e ação única "marcar como atendido".

**23. Histórico do atendido — suportado**
Marcar como atendido é atualização de status com `atendido_por`/`atendido_em`; nada é excluído. O banco suporta sem nenhuma restrição adicional.

**24. Conflito de horário — ESTÁ PARCIAL**
Confirmado no banco: `workspace_agenda_events_no_overlap EXCLUDE USING gist (executive_id =, tstzrange(starts_at, ends_at, '[)') &&) WHERE (priority = 'maxima')`, mais `ends_at > starts_at`. Porém o conflito com `portal_meetings` continua verificado apenas em código (`agenda.functions.ts`), sujeito a corrida.

**25. Timezone — EXISTE, MAS PRECISA SER ALTERADO**
O agrupamento por dia no servidor usa `America/Sao_Paulo`, mas `agenda-dock.tsx` cria o compromisso com `new Date("YYYY-MM-DDTHH:mm:00")` e exibe com `toLocaleString("pt-BR")` sem `timeZone` — ambos no fuso do navegador. Executivo em outro fuso grava e vê horário errado.

## 26–27. Situação por item

| Item | Situação | Arquivo/tabela | Necessário | Risco |
|---|---|---|---|---|
| Host institucional | NÃO EXISTE | index.tsx, environment.server.ts | resolver host no servidor | quebrar `/` em preview se ativar por padrão |
| /f/$slug | PRONTO | f.$slug.tsx | rever destino do redirect | link personalizado cair no institucional |
| Slug reservado | PRONTO | business-unit.ts | — | — |
| unitPath | PRECISA ALTERAR | 153 literais | usar só em código novo | perda de tipagem de rotas |
| Agenda x etapa | PRECISA ALTERAR | agenda_cadence_tasks | `step_key` textual | rótulos e histórico D-n |
| Dois motores | PARCIAL | cadence.server / relationship | unificar leitura, não execução | duplicar disparo |
| Slots E2/E5/E6/E7/R0 | NÃO EXISTE | relationship_message_library | criar slots vazios | motor bloquear envio |
| Vários conteúdos por etapa | PARCIAL | step_content_bindings | permitir N ativos | índice único atual |
| E6 manual | PARCIAL | e20.server.ts | botão + texto oficial | — |
| E7 condicional | PARCIAL | crm_cadence_tasks.outcome | remover padrão "SIM" | assumir atendimento falso |
| Notas do Executivo | PARCIAL | crm_lead_events, message_sends | nota manual + leitura única | histórico paralelo |
| group_leads | NÃO EXISTE | — | criar isolada | contaminar portal_leads |
| Conflito com reuniões | PARCIAL | portal_meetings | trava no banco | corrida |
| Timezone | PRECISA ALTERAR | agenda-dock.tsx | fixar America/Sao_Paulo | reinterpretar horários já salvos |

## 28. Divergências encontradas que não foram perguntadas

- `crm_meta_templates` está VAZIA (0 linhas): E0 como template Meta automático hoje não tem template cadastrado.
- `relationship_e20_occurrences` está vazia — nenhum convite jamais emitido; o fluxo E20 nunca rodou fim a fim em produção.
- `workspace_agenda_events` está vazia: a Agenda global ainda não foi usada por ninguém.
- `outcome` com padrão `"SIM"` em `completeCadenceTask` é a divergência mais perigosa para a Parte B.
- Só existem 5 tarefas em `crm_cadence_tasks` contra 24 itens em `relationship_queue`: a Agenda enxerga a menor parte da operação real.
- O rótulo da Agenda (`D{step_day}`) é vocabulário do motor antigo e já contradiz o vocabulário E-n adotado no restante do sistema.

## DECISÕES QUE PRECISAM SER FECHADAS ANTES DA IMPLEMENTAÇÃO

1. **Host institucional**: qual host exato ativa o Grupo Velox e o que acontece em preview/localhost (sugestão: institucional só com host declarado; todo o resto mantém o comportamento de hoje).
2. **Destino do link personalizado** `/f/{executivo}` quando `/` virar institucional: continua indo para `/`, passa a ir para uma rota financeira própria, ou o Portal do Investidor ganha caminho próprio.
3. **Identificação única de etapa**: acrescentar `step_key` textual às tarefas de cadência mantendo `step_day` (recomendado) ou migrar o histórico.
4. **Quem manda na Agenda**: a Agenda passa a ler também o motor novo (mensagens) ou continua só ligações.
5. **Conteúdo por etapa**: permitir vários conteúdos ativos por etapa e qual a regra de seleção (rodízio, ordem fixa, aleatório).
6. **Textos oficiais** de E20/E6, E27, FINALIZAÇÃO e dos novos slots E2/E5/E7/R0 — sem eles o motor continua bloqueando o envio (não inventaremos texto).
7. **E7**: remover o padrão "SIM" do desfecho de ligação, tratando ausência de registro como indefinido.
8. **Notas do Executivo**: criar tabela de nota manual (recomendado) ou apenas consolidar a leitura do que já existe.
9. **group_leads**: tabela única com modalidade (recomendado) e quem pode ver e atender cada fila.
10. **Timezone**: fixar `America/Sao_Paulo` na criação e na exibição da Agenda, e como tratar eventuais registros já criados (hoje a tabela está vazia, então a correção é sem risco).
11. **Conflito evento x reunião**: manter só a verificação em código ou levar a trava para o banco.
