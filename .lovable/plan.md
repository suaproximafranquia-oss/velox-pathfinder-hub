# Planejamento Técnico — Análise do Estado Atual e Decisões Pendentes

Nenhuma alteração foi feita. Abaixo, o diagnóstico do que existe hoje e apenas as decisões que ainda estão ambíguas.

## A. Problemas técnicos encontrados

### A1. A "tempestade" de Status do Lead atualizado é 100% local, não é banco
Rastreamento do rótulo exato mostrado na tela: `src/lib/investor-profile.ts:48` e `src/lib/executive-data.ts:215` mapeiam o evento `lead.status.changed` para o texto "Status do Lead atualizado". Esse evento não vem de tabela alguma — vem de `src/lib/events/bus.ts`, um barramento em `localStorage` (`velox:events:v1`, teto de 500 eventos, **sem qualquer deduplicação** em `emitEvent`).

Quem emite: `markLeadViewed` em `src/lib/lead-state.ts:107`. Ele é chamado incondicionalmente no clique do card e no `useEffect` de montagem do perfil do investidor. A função só verifica `closedAt`; **não compara o estado anterior**. Toda montagem/remontagem grava `viewed_at` no servidor, o servidor confirma, e o evento é emitido de novo — mesmo quando o lead já estava `em_andamento` há dias. Daí dois registros no mesmo segundo (23:41:40 duas vezes): duas montagens do mesmo componente na mesma interação.

Confirmação no banco: `crm_lead_events` tem 773 linhas `lead_sincronizado` e **zero** de mudança de status. O histórico persistido está limpo; o poluído é o feed do cliente.

### A2. "Contato registrado" duplicado por construção
`src/lib/investor-profile.ts:64-71` monta a timeline a partir de `allLeads.map(...)` — ou seja, **um registro "Contato registrado" por linha de lead** com aquele id. Se o mesmo investidor tiver mais de uma entrada no cache local, a ficha exibe o mesmo contato repetido. A descrição usa `material · origin`, que é exatamente o texto observado ("Link personalizado · Velox Financeira").

### A3. `investor.reactivated` é heurística de dispositivo, não estado de negócio
`src/lib/workspace-alerts.ts:132` (`evaluateInvestorMovement`) compara a atividade do investidor com `readLastSeen()` — um mapa em `localStorage`. Quando dispara, emite `investor.reactivated` (linha 124) e nada mais: **não** inicia jornada de reengajamento, **não** grava estado no banco. Em outro computador, o mesmo lead pode ser "reativado" de novo, ou nunca ser. É essa mesma camada que, ao reavaliar, provoca nova rodada de leitura/visualização e, em cascata, mais `lead.status.changed`.

### A4. Arquitetura não separa "mudança de estado" de "evento ocorrido"
No servidor a separação existe (`journey.server.ts` com whitelist relacional × auditoria técnica). No cliente não: o bus trata cada *gravação de estado* como *evento ocorrido*. Conceitualmente, o histórico atual registra "estado atual" repetidamente, que é exatamente o que não se quer.

### A5. Idempotência: forte no servidor, ausente no cliente
- GreenSales: identidade determinística `gs_{external_id}`, `upsert(onConflict:'id')`, deduplicação por telefone normalizado, `runSyncMuted` + debounce de 1,5s. Evento repetido **não** cria segunda linha nem segundo lead.
- `crm_messages` / `crm_timeline`: `upsert` com `ignoreDuplicates` por `id`.
- Bus de eventos do cliente: `newId()` com timestamp+random a cada chamada — **nenhuma** chave de deduplicação. Este é o único ponto sem idempotência.

## B. Divergências entre esperado e implementado

| # | Esperado | Atual | Onde |
|---|---|---|---|
| 1 | Registrar só mudança efetiva de status | Registra toda visualização/remontagem | `src/lib/lead-state.ts` (`markLeadViewed`) |
| 2 | Histórico = eventos ocorridos | Feed local mistura estado atual e evento | `src/lib/events/bus.ts`, `investor-profile.ts` |
| 3 | Reativação = estado de negócio persistido | Heurística em localStorage, por dispositivo | `src/lib/workspace-alerts.ts` |
| 4 | "Contato registrado" uma vez por entrada real | Um por linha do cache | `investor-profile.ts:64` |
| 5 | Navegação por helper de unidade | `unitPath()` com **zero** call sites; 153 literais `/f/` (24 só em `executive-shell.tsx`) | `src/lib/business-unit.ts` |
| 6 | Agenda enxergando o motor oficial | `agenda_cadence_tasks` lê só `crm_cadence_tasks` (motor antigo de ligações); mensagens em `relationship_queue` são invisíveis | `src/lib/agenda.functions.ts` |
| 7 | Horário em America/Sao_Paulo | Dock usa `new Date()`/`toLocaleString` do navegador | `src/components/agenda/agenda-dock.tsx` |

### Itens verificados e **sem** regressão
- **Rotas /f**: 37 arquivos sob `/f`; 34 rotas antigas são stubs puros (`beforeLoad` + `redirect` preservando `search`, `component: () => null`). Nenhuma tela ou lógica duplicada.
- **/f/$slug × rotas internas**: sem conflito de resolução (segmento estático tem precedência). O risco é só de cadastro, já barrado por `validateExecutiveSlug` contra `RESERVED_UNIT_SLUGS`.
- **Autenticação**: camada única (`OperationalGuard` nos layouts `/f/*`, `ssr: false`). Nenhuma tela refazendo `getSession()`.
- **Identidade do lead**: chave primária é o ID original da GreenSales (`gs_{id}` + `external_source`/`external_id`), imutável. Investidor que retorna reutiliza o mesmo registro. Telefone normalizado é rede de segurança secundária, não identidade.
- **Origem/ownership**: `origin` e `scope: 'green_sales'` são gravados na importação e não são reescritos por interação posterior; `responsible_executive_id` só muda por transferência auditada. Links personalizados, TikTok e Meta mantêm carteira própria.
- **Agenda**: montada uma vez em `__root.tsx`, painel sobreposto sem trocar rota; `portal_meetings` é **somente leitura** (não copia eventos); conflito real garantido no banco por `btree_gist` + `EXCLUDE` entre eventos de prioridade máxima. A Agenda não inventa regra própria de cadência.

## C. Perguntas indispensáveis

**C1. Reativação: estado persistido ou alerta visual?**
Problema: hoje é localStorage por dispositivo (A3), então dois executivos veem realidades diferentes. Afeta Workspace, Jornada e o futuro fluxo R0–R3. Decisão dependente: se for estado de negócio, precisa de coluna/tabela, de quem escreve (sincronização? primeira atividade do investidor?) e de o que encerra a reativação.

**C2. O que caracteriza reativação — qualquer atividade ou só atividade do investidor?**
Problema: `evaluateInvestorMovement` hoje considera qualquer movimento de `lastActivity`. Já está definido que abrir card não é atividade; falta definir se mensagem enviada pelo executivo conta. Afeta o gatilho do reengajamento.

**C3. O histórico local já gravado deve ser preservado, filtrado na exibição, ou expurgado?**
Problema: existem centenas de `lead.status.changed` legítimos-por-código mas ruidosos-por-negócio no `localStorage` de cada máquina. Decisão: filtrar na leitura (reversível, mantém o dado) × limpar a chave (irreversível, mais limpo). Afeta a ficha do investidor.

**C4. Ação do Dia: fonte única imediata ou convivência dos dois motores?**
Problema: `crm_cadence_tasks` (ligações, exibido na Agenda) e `relationship_queue` (mensagens, invisível) coexistem sem chave comum. Unificar sem chave `lead+etapa+instância` duplica a mesma etapa na lista. Decisão: qual motor é o oficial e o que fazer com as tarefas legadas.

**C5. Reuniões de `portal_meetings` devem bloquear conflito de prioridade máxima?**
Problema: hoje a constraint só cobre evento × evento; uma reunião confirmada não impede um compromisso máxima no mesmo horário. Afeta a regra de conflito no banco.

**C6. Notas do Executivo: tabela própria ou extensão do que existe?**
Problema: hoje há `portal_leads.notes` (texto único) e `crm_cadence_tasks.note` (desfecho). Não existe duração de ligação nem tipo (ligação × mensagem). Decisão define migration e a UI de card/modal.

## D. Já definido — não perguntar
Identidade pelo ID GreenSales; origem preservada; carteiras TikTok/Meta separadas; abrir card não é atividade; homologação nunca chama a Meta; E0 automático/template e demais etapas assistidas; E20 com validade de 7 dias; OPORTUNIDADE encerra a cadência; fechamento 22:00 e janelas de envio; versionamento imutável da Biblioteca e snapshot no envio; blindagem contra exclusão de leads; `/f` como unidade Financeira e slugs reservados.

## E. Correções já cobertas por regra definida (executar sem nova pergunta)
1. Guarda de mudança real em `markLeadViewed` — só emitir quando o estado muda de fato.
2. Deduplicação no bus por chave `tipo+lead+janela`.
3. "Contato registrado" único por entrada real na ficha.
4. Fuso do dock da Agenda fixado em America/Sao_Paulo.
5. Remoção do desfecho padrão `?? "SIM"` em `completeCadenceTask`.
6. Adoção efetiva de `unitPath()` no lugar dos literais `/f/`.
7. `step_key` textual (E0–E7 / R0–R3) desacoplado de `step_day`.

## Ordem recomendada da próxima etapa
1. Correções invisíveis de integridade (E1–E5 acima) — nenhuma decisão pendente, risco baixo.
2. Fundação: `step_key` textual + chave única de ação (depende de C4).
3. Unificação da Agenda com o motor oficial (depende de C4 e C5).
4. Reativação/reengajamento persistido (depende de C1 e C2).
5. Notas do Executivo (depende de C6).
6. Saída da simulação do E0, somente após o cadastro dos templates Meta.
