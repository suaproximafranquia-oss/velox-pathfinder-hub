# Correções cirúrgicas — Financeira /f

## Limites

Implementar somente os dois escopos solicitados: Ação do Dia/temporalidade e precedência do nome no Portal do Investidor. Não alterar `/s`, `/s/portal`, `/seg`, GreenSales, Message Library, pré-gatilho/prefetch ou registros históricos existentes. Não criar tabela, migration, fila, motor ou mecanismo adicional de polling. Não executar sincronização nem testar sobre leads reais.

## 1. Atrasos, relógio e compromissos

- Remover a isenção de atraso da E0 em `buildDailyActions`, aplicando exatamente a classificação de dias úteis já usada pelas demais ações, sem modificar o calendário.
- Aproveitar o timer existente de 30 segundos para reclassificar a lista carregada e atualizar sua seleção/ordenação quando a classificação mudar. Usar as mesmas funções temporais, sem consultas periódicas adicionais e sem perder a proteção contra respostas antigas ou a continuidade da mesma lead.
- Preservar a janela atual de foco: T−5 até T+5; após essa janela, o compromisso passa a atrasado. Não trocar essa tolerância por outra regra.
- Manter o gate server-side e os controles `claimed_by`, `PROCESSING`, `assertCurrentAction`, `assertCurrentLead` e `assertCurrentQueueItem` intactos.
- Na Central, explicitar `America/Sao_Paulo` tanto nas descrições geradas no servidor quanto na data exibida no card. Não alterar os instantes persistidos.
- No aviso “Próximo compromisso”, manter `portal_meetings`, ordenar pelo instante completo de `scheduled_at` e excluir compromissos já encerrados/cancelados ou sem estado operacional válido antes de limitar os resultados.
- Reaproveitar o refresh de 120 segundos e as atualizações já existentes da tela para renovar o aviso; impedir que respostas antigas substituam resultados novos. Sem nova assinatura/polling paralelo.

## 2. E1/E2 — regra esclarecida

### E1

1. Ligação 01.
2. Se não houve contato, mensagem E1 disponível imediatamente, sem esperar a Ligação 02.
3. Ligação 02 adicional, liberada duas horas após a execução da Ligação 01 — não após a mensagem.
4. Se a Ligação 02 não acontecer até o fechamento da janela operacional daquele dia, expirar somente essa tentativa, com motivo identificável na fila existente; nunca transportá-la como atraso para outro dia.
5. Se essa tentativa expirou, E2 terá duas ligações; se foi realizada, E2 mantém uma.

### E2

- Normalmente uma ligação e a mensagem correspondente após ausência de contato.
- Quando compensar E1 incompleta: mensagem imediatamente após a primeira ligação sem contato e segunda ligação adicional em +2h.
- Se a segunda expirar, não transferir compensação nem dívida para E3. E3 mantém uma ligação.

### Preservação

- Manter a data normal das próximas etapas, incluindo a transição E1→E2 de dois dias; compensação não altera âncoras nem intervalos entre etapas.
- Preservar mensagens oficiais, resultados já gravados e identificadores das ações existentes. Não renumerar mensagens históricas para inserir uma ligação.
- Usar o planejamento V2 e a persistência da `relationship_queue`; registrar expiração idempotente e protegida contra concorrência, sem cancelar uma tentativa já executada.
- A mensagem permanece obrigação própria; a expiração da ligação não a marca como enviada ou concluída.
- Preservar integralmente a sequência E0: ligação 1 → 10 minutos → ligação 2 → mensagem quando aplicável.

## 3. Contato GreenSales e apresentação das ligações

- “Sim, houve contato” apenas seleciona o resultado, mantém o card aberto e permite observação; somente “Concluído” aciona o desfecho existente.
- “Não houve contato” abre a pergunta sobre reagendamento. Exibir a orientação sobre GreenSales apenas após resposta afirmativa, sem oferecer agenda paralela no Portal.
- Usar uma única área de observação nesse compromisso, preservando o destino atual dos dados e o histórico.
- Manter o cabeçalho “LIGAÇÃO — ETAPA E0/E1/E2…” e apresentar “Ligação 01” ou “Ligação 02” no subtítulo, sem repetir a etapa. A tentativa será identificada pelo plano, não presumida pelo número bruto da mensagem na fila.

## 4. Nome do Portal — cadastro principal soberano

- No caminho de sincronização do Portal, não incluir `name` nas atualizações de um cadastro já existente, independentemente de bloqueio manual.
- Não apenas reler e regravar o nome: omitir sua escrita evita que uma sincronização concorrente restaure um valor anterior à edição do executivo.
- Preservar matching/deduplicação, IDs, vínculos, proprietário e demais campos, sem estender a restrição a e-mail, telefone ou cidade.
- Manter o nome informado como valor inicial somente na criação de um cadastro realmente novo. Tratar repetição/conflito de criação sem permitir sobrescrita posterior do nome existente.
- Ajustar somente as entradas do Portal que mesclam a identidade digitada no cadastro local, para não propagar esse nome ao Workspace. Não bloquear a edição legítima feita pelo executivo.
- Manter o retorno do servidor como referência após reload, sem reparar automaticamente nomes anteriormente alterados no banco.

## Detalhes técnicos

Pontos já verificados:

- `src/server/crm/daily-actions.server.ts`: isenção explícita de E0 no cálculo de `overdue`.
- `src/components/crm/daily-actions-overlay.tsx`: timer de 30s atualiza somente a janela operacional.
- `src/lib/crm/daily-actions.ts`: classificação de foco atual e ordenação compartilhada.
- `src/server/workspace/alerts.server.ts` e `src/routes/f.executivo.alertas.tsx`: formatação sem timezone explícito.
- `src/lib/agenda.functions.ts` e `src/components/crm/next-commitment-alert.tsx`: consulta do aviso e refresh existente.
- `src/lib/relationship/cadence-v2.ts`, `cadence-v2-decide.ts`, `src/lib/relationship/engine.ts` e `src/server/relationship/cadence-v2-state.server.ts`: plano, decisão, agendamento e leitura do histórico. Alterações limitadas às tentativas E1/E2 e sua expiração na persistência existente.
- `src/components/crm/daily-action-card.tsx`: seleção de contato, confirmação, observações e subtítulos.
- `src/lib/portal-leads.functions.ts`: `applyIdentityGuard` atualmente permite escrever o nome recebido quando não há bloqueio manual.
- `src/lib/leads.ts`: `registerLead` mescla a identidade recebida no registro reconhecido; ajustar apenas o caminho de entrada do Portal, mantendo as edições operacionais.

## Validação direcionada

Executar somente testes dos comportamentos alterados, com dados fictícios e persistência simulada:

- E0 recente/antiga, dia útil, fim de semana, feriado e classificação igual às demais ações.
- Mudança futura→agora→atrasada pelo relógio existente; preservação do foco, claims, continuidade e respostas fora de ordem.
- Central: instante `16:05Z` apresentado como `13:05` em São Paulo, independentemente do timezone do ambiente.
- Próximo compromisso: ordem por dia e hora, exclusão de encerrados/cancelados, refresh e rejeição de resposta antiga.
- E1: mensagem imediata, segunda ligação em +2h, execução normal ou expiração sem atraso.
- E2: uma ou duas ligações conforme E1, mesma data normal, expiração sem compensar E3.
- Expiração repetida/concorrrente sem duplicação ou alteração de tentativa executada; E0 continua em +10 minutos.
- GreenSales: selecionar contato não conclui; confirmação explícita conclui com uma observação; orientação de reagendamento somente após “sim”.
- Portal: mesmo e-mail/telefone com nome diferente reutiliza cadastro e preserva nome/ID; sincronização repetida e reload não restauram o nome digitado; novo investidor continua sendo criado; outros campos mantêm comportamento.

Informar os arquivos alterados, testes executados e quaisquer limites de validação, sem afirmar validação em produção.
