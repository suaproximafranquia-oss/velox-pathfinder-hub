# Auditoria — Ação do Dia + viabilidade do Modo Demonstração

Somente diagnóstico. Nada foi alterado: sem migration, sem componente novo, sem toque no motor de E0, na cadência ou na Global WhatsApp Safety Lock.

## 1. Onde a Ação do Dia vive hoje

| Camada | Arquivo | Papel |
|---|---|---|
| Interface | `src/components/crm/daily-actions-overlay.tsx` | Painel sobreposto: lista lateral + painel de execução |
| Ponto de entrada | `src/components/crm/portal-leads-board.tsx` | Botão com contador; abre o overlay e recarrega o quadro ao fechar |
| Rota | `src/routes/f.portal-leads.tsx` | Guard operacional + permissão de módulo `portal_leads` |
| Contrato/regras puras | `src/lib/crm/daily-actions.ts` | Tipos, buckets, precedência, dedupe, ordenação, resumo |
| RPC | `src/lib/crm/daily-actions.functions.ts` | `listDailyActions`, `getDailyActionsSummary` (autenticadas, restritas à gestão) |
| Agregador | `src/server/crm/daily-actions.server.ts` | Lê as fontes oficiais e monta a lista |

Não existe segunda tela de Ação do Dia. A fila é **recalculada a cada leitura** — não há tabela própria de "fila do dia".

## 2. Como a fila é montada

`buildDailyActions({ executiveId })` faz seis leituras em paralelo:

| Fonte | Tabela/função | Vira |
|---|---|---|
| Primeiro contato manual | `workspace_e0_actions` (state `PENDENTE`) via `listPendingE0Actions` | `primeiro_contato` (E0) |
| Reuniões | `portal_meetings` | `reuniao` |
| Agenda | `workspace_agenda_events` | `compromisso` |
| Fechamento do ciclo | `listClosureDuties` (ocorrências da E20 → E27/FINALIZAÇÃO) | `mensagem` |
| Motor de relacionamento | `relationship_queue` (status `PENDING`) | `mensagem` |
| Ligações (legado) | `buildCadenceQueue("call")` sobre `crm_leads` + `crm_cadence_tasks` | `ligacao` |

Identidade (nome, telefone, carteira) vem sempre de `portal_leads`.

Janela: de −45 dias a +2 dias. Limites: 500 reuniões, 500 eventos de agenda, 1000 itens de fila, 500 ações E0, 5000 leads na cadência. **Não há paginação** — a lista chega inteira ao navegador.

Normalização (`normalizeDailyActions`): dedupe por `actionKey` → colapso por lead (um lead = um card visível; o resto vai para `secondary`) → ordenação.

Precedência entre fontes: `first_contact` (0) > `meeting` (1) > `agenda` (2) > `closure` (3) > `queue` (4) > `cadence` (5).

Ordem final (`actionRank`): prioridade máxima em foco/atrasada → prioridade máxima futura → atrasadas → hoje/agora → futuras; empate resolvido por horário e depois por `actionKey`. O "próximo item" é simplesmente o primeiro da lista ordenada — não existe cursor server-side.

Buckets: `agora`, `atrasada`, `hoje`, `futura`, calculados em `resolveBucket` com fuso `America/Sao_Paulo` e janela de foco de 15 min. O "agora" vem do servidor, nunca do relógio do navegador.

## 3. Tipos de ação existentes

Existem **cinco `kind`** (não um por etapa):

| Kind | Origem | Ao executar | Grava |
|---|---|---|---|
| `primeiro_contato` (E0) | `workspace_e0_actions` | `executeFirstContactAction` → `executeE0Action` → `registerFirstContact` | `workspace_e0_actions` (state/executed_at/executed_by/result) + `crm_lead_events` quando há `crm_lead_id` |
| `ligacao` | fila de cadência | Botões Sim/Não → `completeCadenceTaskFn` | `crm_cadence_tasks` |
| `reuniao` | `portal_meetings` | Nenhuma conclusão no painel | — |
| `compromisso` | `workspace_agenda_events` | Nenhuma conclusão no painel | — |
| `mensagem` | `relationship_queue` e fechamento (E27/FINALIZAÇÃO) | Nenhuma conclusão no painel | — |

E1/E2/E3 **não são tipos**: são etapas que aparecem como `mensagem` com `stepLabel` (rótulo vindo de `src/lib/relationship/step-labels.ts`). Só E0 e ligação são executáveis dentro do painel; as demais são encerradas nas suas origens.

Ação lateral comum: botão WhatsApp (`wa.me`, abre nova aba; em ligação registra tentativa via `registerWhatsappCallAttemptFn`) e "Ver ficha completa" (`/f/executivo/investidores/:id` em nova aba).

## 4. Janela / modal

Um único componente, overlay em tela cheia, com duas colunas:
- esquerda: etapa, nome, telefone clicável, título, histórico de tentativas, pendências secundárias, botões e nota explicativa;
- direita: "Ordem do dia" agrupada em Agora / Atrasadas / Para hoje.

Botões: Executar E0 · Sim/Não (ligação) · WhatsApp · Ver ficha · Atualizar · Fechar (X, clique no fundo ou Esc).

**Não existe botão "próximo"**. Depois de executar, `dropAction()` remove o item da lista local e seleciona automaticamente o vizinho — o avanço é implícito. Fechar o overlay dispara `load()` no quadro.

Estado local: `actions`, `selectedKey`, `loading`, `busy`, `feedback`. Nenhum estado global, nenhum contexto — toda a interface depende apenas de `actions` + três `useServerFn`.

## 5. Permissões

Cadeia atual: `OperationalGuard` (sessão + status ativo, checado a cada 60s) → `useModuleAccess(..., "portal_leads")` → dentro do board, `isCrmAdministrator || isCrmSupervisor` → no servidor, `assertManager` exige papel `admin` ou `manager`. O executivo só vê o que é dele: `current_executive_id()` filtra reuniões, agenda e ações E0.

## 6. Viabilidade do Modo Demonstração

Tecnicamente favorável, e por um motivo estrutural: o overlay **não conhece nenhuma tabela**. Ele consome `DailyAction[]` e chama três funções obtidas por `useServerFn`. Toda a dependência real está nessas três chamadas.

Bloqueio único a resolver: hoje o componente chama `useServerFn(...)` no topo, incondicionalmente. Enquanto essas chamadas estiverem fixas dentro dele, não há como garantir isolamento por inspeção.

### Proposta técnica mínima

1. Tornar o overlay agnóstico de origem: receber por props um objeto de "adaptador" com `load()`, `executeFirstContact()`, `completeCall()`. O modo real passa o adaptador atual (nenhuma mudança de comportamento); o modo demonstração passa um adaptador em memória. Zero mudança visual.
2. Criar um fixture puro (`src/lib/crm/daily-actions.demo.ts`) com 30–40 itens determinísticos cobrindo os cinco tipos e os três buckets, usando os mesmos tipos de `daily-actions.ts` e passando pelo mesmo `normalizeDailyActions`.
3. Fila infinita sem registros: manter o array em memória; ao "executar", mover o item para o fim da lista e recalcular a seleção. O mesmo item reaparece após os demais. Nada persiste — recarregar a página reinicia o fixture.
4. Rota própria de demonstração, com o mesmo guard e a mesma permissão do modo real (sem nova regra de acesso), renderizando o mesmo overlay com o adaptador fictício e um selo visível "Demonstração".

### Isolamento

Regra: o adaptador de demonstração **não importa nenhum `*.functions.ts`**. Sem import, não existe caminho para o backend — nem acidental, nem por retry. Nenhuma server function, nenhuma tabela, nenhum evento, nenhum envio. A Safety Lock permanece irrelevante para esse caminho porque ele nunca chega ao executor.

### Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Vazamento para dados reais | Adaptador demo sem import de server functions |
| Chamada acidental ao backend | Injeção por props: a única fonte de chamada é o adaptador recebido |
| Duplicação de código | Um único componente; muda só a fonte de dados |
| Divergência visual | Mesmo componente, mesmos tipos, mesmo pipeline de normalização |
| Impacto em E0/cadência | Nenhum arquivo de motor é tocado |
| Desempenho | 30–40 itens em memória; sem rede |

### Arquivos afetados na construção futura

- `src/components/crm/daily-actions-overlay.tsx` — receber o adaptador por props (refator de fonte de dados, sem mudança visual)
- `src/components/crm/portal-leads-board.tsx` — passar o adaptador real
- `src/lib/crm/daily-actions.demo.ts` — novo (fixture + adaptador em memória)
- uma rota nova de demonstração

Sem migration, sem alteração de tabela, sem toque em E0, cadência, timeline ou Safety Lock. É viável como **uma única construção controlada**.
