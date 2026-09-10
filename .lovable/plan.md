# Diagnóstico — laboratório temporário da Ação do Dia | /f

Nenhuma alteração foi feita no código ou nos dados.

## Conclusão executiva

A estratégia é **tecnicamente viável**, mas não deve ser feita limpando ou manipulando a operação real para deixar apenas cinco leads. A arquitetura segura é uma rodada isolada de homologação, com poucos leads fictícios ou cópias não identificáveis dos cenários escolhidos, `scope = homologation`, `run_id` próprio, envio sempre simulado e relógio virtual persistido por rodada.

A base já existe parcialmente:

- marcação explícita `is_test` + `test_batch_id`;
- limpeza seletiva por lote;
- separação do motor por `scope` e `run_id`;
- um `EngineClock` virtual parametrizável;
- bloqueio de saídas reais para leads de teste.

O que **ainda não existe de ponta a ponta** é a ligação desse relógio virtual à Ação do Dia, ao scheduler, à continuidade, à E0 manual e à apresentação da fila.

## Respostas objetivas

### A) É possível deixar somente IDs específicos?

**Sim, na visão isolada de homologação. Não, com segurança, apagando os demais registros reais de produção.**

Há duas abordagens distintas:

1. **Insegura e rejeitada:** excluir, cancelar ou alterar ações reais de todos os demais leads em `scope = production`.
2. **Segura e recomendada:** criar uma rodada isolada que só leia os cinco cenários escolhidos e não enxergue a fila real.

Se os IDs informados forem reais, o laboratório não deve operar diretamente sobre suas linhas reais. Deve criar representações fictícias vinculadas apenas ao cenário de teste, sem copiar dados pessoais desnecessários e sem escrever no Portal dos Leads.

### B) Estruturas afetadas

Na solução segura, somente registros marcados da rodada de homologação:

| Estrutura | Uso no teste | Limpeza ao final |
|---|---|---|
| `test_batches` | identidade e estado do lote | marcar como limpo/encerrado |
| `crm_leads` | espelho fictício com `is_test` e `test_batch_id` | somente linhas do lote |
| `portal_leads` | card fictício do lote | somente linhas do lote |
| `relationship_cadences` | estado da cadência | `scope=homologation` + `run_id` |
| `relationship_queue` | ações e `due_at` | `scope=homologation` + `run_id` |
| `relationship_events` | eventos do motor | `scope=homologation` + `run_id` |
| `relationship_decisions` | decisões auditáveis | `scope=homologation` + `run_id` |
| `crm_messages` | mensagens simuladas, se necessárias | somente IDs fictícios do lote |
| `crm_timeline` | histórico visual fictício | somente IDs fictícios do lote |
| `crm_lead_events` | eventos do espelho fictício | somente linhas do lote |

O limpador existente já segue esse princípio em `src/server/testing/test-lab.server.ts`, mas hoje o laboratório usa relógio real e grava o motor em `scope=production`; isso precisaria ser corrigido antes de um teste acelerado permanente.

### C) O Portal dos Leads pode ficar intacto?

**Sim, 100%.** É condição obrigatória.

Não devem ser alterados os leads reais, os cards reais, a sincronização GreenSales, as etapas reais ou os históricos reais. Também ficam fora do reset:

- `crm_pipelines`, `crm_pipeline_stages`, `crm_connections` e `crm_sync_runs`;
- configurações, usuários, papéis e perfis executivos;
- Biblioteca, templates e conteúdos;
- Portal público e dados reais de investidores;
- permissões, produtos, backups e relatórios permanentes.

A proteção atual já considera registros `gs_*`, origem GreenSales ou `external_source` preenchido como dados protegidos.

### D) É possível usar 5 minutos reais = 1 dia lógico?

**Sim.** O código já possui `createVirtualClock()` em `src/lib/relationship/clock.ts`.

O fator necessário é:

```text
1 dia lógico / 5 minutos reais = 1.440 / 5 = 288x
```

O relógio atual aceita fator parametrizado, mas o padrão existente é 12x. Em produção, `productionEngine()` injeta exclusivamente `realClock`; o virtual ainda não está conectado ao fluxo operacional.

### E) Dependências atuais de tempo real

| Área | Fonte atual do tempo | Situação para laboratório |
|---|---|---|
| Motor puro | `EngineClock` injetado | pronto para relógio virtual |
| V2 e calendário | recebem datas/instantes como entrada | podem acompanhar o relógio virtual |
| Scheduler | `new Date()` do servidor | precisa receber o relógio da rodada |
| Montagem da Ação do Dia | `new Date()` por padrão | aceita `nowIso`, mas não recebe o virtual hoje |
| Continuidade de 20 min | `Date.now()` no servidor | precisa de decisão específica e relógio controlado |
| E0 manual | `new Date()` direto | precisa usar o relógio da rodada |
| Reclassificação visual | `new Date()`/`Date.now()` no navegador | precisa receber o “agora lógico” do servidor |
| Compromissos/follow-up | timestamps reais do banco | só podem ser virtuais em compromissos fictícios isolados |
| Alertas do Portal | timestamp real | devem ficar fora do laboratório ou ser simulados |
| `created_at`/`updated_at` | horário real do banco | devem permanecer reais como auditoria técnica |

Importante: `created_at` e `updated_at` não precisam ser virtualizados. O horário lógico deve governar `due_at`, elegibilidade e classificação; o horário real deve continuar registrando quando o sistema realmente gravou cada linha.

### F) Aplicação segura por regra

| Regra | Pode usar 288x? | Condição |
|---|---:|---|
| `due_at` | Sim | calculado pelo relógio da rodada |
| atraso/dia útil | Sim | `nowIso` lógico em toda classificação |
| criação de E0 | Sim | E0 fictícia no escopo da rodada |
| E1/E2 e demais etapas | Sim | motor e scheduler usando o mesmo relógio |
| segunda ligação E0 de 10 min | Sim, com decisão | definir se os 10 min são **lógicos** ou **reais** |
| continuidade de 20 min | Sim, com decisão | definir se a janela é lógica ou operacional real |
| recomposição/ordenação | Sim | fila exclusiva da rodada e “agora lógico” comum |
| compromissos | Parcialmente | somente compromissos fictícios; nunca agenda real |

A escolha mais coerente para testar toda a régua é tratar 10 e 20 minutos como **tempo lógico**. Em 288x, 10 minutos lógicos passam em cerca de 2,1 segundos reais e 20 minutos em cerca de 4,2 segundos. Isso pode ficar rápido demais para operação manual; por isso o laboratório precisa oferecer pausa e avanço controlado, não apenas aceleração contínua.

### G) O que não deve acompanhar o relógio acelerado

- envio real de WhatsApp;
- Google Calendar ou agenda humana real;
- sincronização GreenSales real;
- horários de auditoria (`created_at`, `updated_at`);
- sessões de autenticação e segurança;
- bloqueios contra clique duplo e respostas antigas da interface;
- timeout de rede e processamento;
- dados, alertas e compromissos reais do Portal.

Esses elementos devem continuar no relógio real. Apenas a lógica comercial simulada usa o relógio virtual.

### H) Ativação/desativação sem contaminar produção

Forma mais segura:

```text
Rodada de homologação
  ├─ scope = homologation
  ├─ run_id exclusivo
  ├─ leads TEST-* / is_test=true / test_batch_id
  ├─ clock persistido: início real, início lógico, fator 288, pausa/fim
  ├─ scheduler exclusivo do run_id
  ├─ dispatcher sempre simulado
  └─ Ação do Dia com adaptador exclusivo da rodada
```

A ativação deve ser por rodada explícita, nunca por variável global que mude o comportamento de `/f` inteiro. O host de preview sozinho também não basta, porque preview e publicado compartilham a mesma base; a fronteira precisa estar nos registros (`scope`, `run_id`, `is_test`, `test_batch_id`).

### I) Risco de timestamps artificiais permanecerem misturados

**Existe risco se o teste usar `scope=production`, IDs reais ou tabelas sem filtro de lote.** Nesse caso, `due_at`, eventos e cadências futuras poderiam continuar afetando a operação após desligar o relógio.

Com `scope=homologation` + `run_id`, o risco fica controlado: os timestamps lógicos permanecem apenas como histórico da rodada e não são lidos pela produção. Ao encerrar, congela-se o relógio, desativa-se o scheduler da rodada e limpa-se somente o lote.

### J) Estratégia recomendada

1. Não tocar nem ocultar a fila real.
2. Criar uma rodada exclusiva de homologação com cinco leads fictícios representando os cenários desejados.
3. Persistir o relógio da rodada com fator 288x, suporte a pausar e avançar.
4. Executar o mesmo motor e a mesma regra V2, mas com repositório `homologation/run_id` e dispatcher simulado.
5. Montar uma Ação do Dia própria da rodada, lendo somente esse `run_id` e usando o mesmo “agora lógico”.
6. Manter agenda, GreenSales, WhatsApp e Portal reais completamente desconectados.
7. Ao terminar: congelar a rodada, gerar relatório, apagar somente registros do lote e confirmar por contagem que nenhum registro `production` foi tocado.
8. Retomar a operação oficial sem nenhuma mudança, porque o caminho normal continuou usando `realClock` e `scope=production` durante todo o teste.

## Ponto técnico mais importante

O laboratório já tem peças úteis, mas o relógio virtual atual cobre apenas o motor puro. Aplicá-lo diretamente à produção não seria seguro nem suficiente: Ação do Dia, scheduler, continuidade, E0 manual, reuniões e interface ainda usam tempo real em pontos diferentes.

Portanto, a resposta final é: **viável com isolamento por rodada; inviável com segurança se a proposta for limpar a produção e acelerar o relógio global do `/f`.**

## Arquivos responsáveis

- `src/lib/relationship/clock.ts` — relógio real/virtual.
- `src/server/relationship/engine.server.ts` — produção fixa em `realClock`.
- `src/server/relationship/repository.server.ts` — isolamento por `scope` e `run_id`.
- `src/server/testing/test-lab.server.ts` — lotes fictícios, proteção e limpeza seletiva existentes.
- `src/server/relationship/workspace-reset.server.ts` — estruturas e leads reais protegidos.
- `src/server/relationship/scheduler.server.ts` — tick atual em tempo real e `scope=production`.
- `src/server/crm/daily-actions.server.ts` — montagem da fila e `nowIso` real por padrão.
- `src/server/crm/daily-actions-gate.server.ts` — claim e continuidade de 20 minutos em tempo real.
- `src/server/relationship/e0-manual.server.ts` — abertura da E0 com horário real.
- `src/components/crm/daily-actions-overlay.tsx` — reclassificação visual e controles técnicos em tempo real.
- `src/lib/crm/daily-actions-overdue.ts` — cálculo puro de atraso a partir do `nowIso` recebido.
