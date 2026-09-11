# Validação controlada com 4 leads reais e relógio 288x | Financeira /f

## Objetivo

Preparar a Central de Homologação já existente para validar a passagem acelerada do tempo com estes quatro cadastros reais confirmados:

| Lead | ID GreenSales | ID operacional | Telefone final |
|---|---:|---|---:|
| Ricardo Gonçalves | 59034 | `gs_59034` | 6548 |
| Eduardo Franco | 59037 | `gs_59037` | 2350 |
| Francisco | 59081 | `gs_59081` | 1074 |
| João Figueiredo | 59279 | `gs_59279` | 7062 |

Os quatro permanecem cadastros reais. O teste criará somente estado operacional de homologação para esses mesmos IDs; não criará cópias fictícias e não alterará as linhas operacionais de produção.

## Limites obrigatórios

- Usar somente a Central de Homologação existente em `/f`.
- Não criar tabela, migration, fila, laboratório, motor ou regra de negócio nova.
- Não marcar os quatro leads como `is_test` e não mudar seus dados no GreenSales ou Portal dos Leads.
- Não alterar cadência, etapas, prioridades, continuidade, posição 1, compromissos ou conteúdo da Biblioteca.
- Não executar agora o reset geral definitivo.
- Não tocar `/s`, `/s/portal`, `/seg` ou qualquer ambiente fora da Financeira.
- Manter WhatsApp e integrações externas desativados durante toda a rodada.

## Implementação

### 1. Confirmação e trava da seleção

- Registrar na configuração da rodada somente os quatro IDs operacionais acima, usando as estruturas persistentes de homologação já existentes.
- Antes de iniciar ou limpar, conferir no servidor nome, telefone final e origem GreenSales dos quatro registros.
- Bloquear a operação se faltar um cadastro, houver duplicidade ou qualquer identidade divergir.
- Usar lista fechada; nenhum quinto lead poderá entrar por sincronização, reconciliação ou leitura ampla.

### 2. Reset inicial exclusivamente da homologação

- Limpar somente filas, cadências, eventos e decisões com `scope = homologation` pertencentes à rodada controlada anterior.
- Preservar integralmente os registros `crm_leads` e `portal_leads` dos quatro leads, além de mensagens, timeline, compromissos e histórico de produção.
- Não reutilizar o reset global nem o limpador que apaga leads fictícios.
- Exibir uma prévia das contagens e exigir a confirmação administrativa já no fluxo da Central antes da limpeza restrita.

### 3. Estado controlado dos quatro leads

- Criar, no repositório já existente, uma rodada com `scope = homologation` e `run_id` exclusivo.
- Referenciar diretamente `gs_59034`, `gs_59037`, `gs_59081` e `gs_59279`.
- Inicializar a cadência de homologação a partir de uma fotografia somente leitura do estado atual de cada lead, sem modificar a cadência `production` nem os dados de origem.
- Persistir a configuração e o estado do relógio usando o registro de rodada já existente; nenhuma estrutura nova será criada.

### 4. Relógio acelerado temporário

- Reutilizar `EngineClock` e `createVirtualClock()` com fator **288**, equivalente a 5 minutos reais por 1 dia lógico.
- O relógio será resolvido exclusivamente pelo `run_id` ativo da homologação.
- Motor, cálculo de `due_at`, elegibilidade, atraso, calendário e montagem da fila de teste receberão o mesmo `nowIso` lógico.
- Horários de auditoria, autenticação, rede, proteção contra clique duplo e a produção continuarão usando o relógio real.
- Ao desativar, congelar primeiro a rodada e impedir novos ticks; a produção continuará em `realClock` sem qualquer chave global.

### 5. Ação do Dia na Central de Homologação

- Reutilizar o overlay e os controles atuais da Ação do Dia.
- Substituir somente os dados fictícios em memória dessa tela pela leitura da rodada ativa.
- A fila de teste consultará apenas `scope = homologation`, o `run_id` ativo e a lista fechada dos quatro IDs.
- A Ação do Dia normal continuará consultando somente `scope = production` e `run_id IS NULL`, impedindo mistura visual ou operacional.
- Conclusões, “Atendeu/Não atendeu”, copiar mensagem, continuidade e recomposição usarão os handlers existentes, executados contra o repositório da rodada.
- Toda saída externa permanecerá simulada/bloqueada; a interface mostrará claramente “Relógio acelerado 288x” e o horário lógico atual.

### 6. Execução temporal

- Reutilizar o mesmo tick do motor, parametrizado por escopo, rodada, lista de leads e relógio.
- O tick controlado avaliará exclusivamente os quatro IDs; não haverá varredura global nem reconciliação GreenSales.
- A página poderá solicitar o tick da rodada para acompanhar a evolução; nenhum cron de produção será alterado.
- Os intervalos de 10 minutos da E0 e 20 minutos de continuidade serão medidos pelo mesmo relógio lógico durante a rodada, sem mudar seus valores de negócio.
- Compromissos reais e alertas reais não terão seus timestamps regravados; quando exibidos na rodada, serão apenas referências de leitura.

### 7. Encerramento e limpeza posterior

- Disponibilizar “Encerrar e limpar teste” somente para administrador.
- A ação deverá: congelar o relógio, bloquear novos ticks, limpar apenas as linhas `homologation + run_id` e encerrar o registro da rodada.
- Confirmar por contagem que não restaram filas/cadências/eventos/decisões da rodada.
- Não apagar nem restaurar dados dos quatro leads, pois sua operação real nunca terá sido modificada.
- O reset geral definitivo continuará ausente e bloqueado até uma solicitação posterior explícita com “OK”.

## Validação direcionada

1. Confirmar novamente os quatro pares ID/nome/telefone antes de qualquer escrita.
2. Provar que a fila normal de produção mantém as mesmas contagens e IDs antes/depois da ativação.
3. Provar que a rodada enxerga somente os quatro leads.
4. Validar 5 minutos reais ≈ 1 dia lógico e exibir ambos os horários.
5. Validar E0, segunda ligação em 10 minutos lógicos, E1/E2, atraso, continuidade e recomposição sem alterar as regras.
6. Confirmar que nenhuma tentativa alcança WhatsApp, GreenSales, calendário externo ou Portal público.
7. Encerrar e limpar uma rodada de ensaio técnico, confirmando zero resíduo por `run_id`.
8. Manter o reset geral definitivo não executado.

## Arquivos principais

- `src/lib/relationship/clock.ts` — relógio virtual já existente.
- `src/server/relationship/engine.server.ts` — montagem parametrizada sem alterar o motor puro.
- `src/server/relationship/repository.server.ts` — isolamento existente por `scope` e `run_id`.
- `src/server/relationship/scheduler.server.ts` — reutilização do tick com lista fechada e relógio da rodada.
- `src/server/testing/test-lab.server.ts` — controle administrativo da rodada e limpeza restrita.
- `src/lib/testing/test-lab.functions.ts` — funções autenticadas e autorização administrativa.
- `src/routes/f.executivo.homologacao.acao-do-dia.tsx` — tela existente da validação.
- `src/components/executive/homologation-daily-actions-demo.tsx` — troca do adaptador em memória pelo adaptador da rodada.
- `src/server/crm/daily-actions.server.ts` e `daily-actions-gate.server.ts` — leitura/claim parametrizados, mantendo produção explicitamente isolada.
