# E0 na Ação do Dia — diagnóstico e menor correção possível

Escopo: exclusivamente Financeira `/f`. Nada de `/s`, `/s/portal`, `/seg`, Solar, Seguros.

## A. O que já está correto

- Para um lead novo, a primeira ação criada pelo servidor é uma **LIGAÇÃO**, não uma mensagem.
  `src/server/crm/e0-actions.server.ts:96-103` → `openManualE0Cadence` (`src/server/relationship/e0-manual.server.ts:87-96`) → motor V2 → grava uma linha em `relationship_queue`.
- A sequência oficial está declarada na régua V2: `src/lib/relationship/cadence-v2.ts:430-443`
  `ordem 1 = call "Ligação 1"`, `ordem 2 = call "Ligação 2" (waitMinutesAfterPrevious: 10)`, `ordem 3 = message "Mensagem"`.
- A segunda ligação é **persistida no banco**, não calculada na tela: o desfecho "não atendeu" chama `tickLead` (`src/server/relationship/call-outcome.server.ts:80-89`) e o motor grava a próxima linha (`src/lib/relationship/engine.ts:227-280`).
- "Atendeu" encerra apenas as ações restantes da tentativa E0 e marca aguardo de encaminhamento; não cria mensagem.
- Posição 1 é controlada **no servidor**: `src/server/crm/daily-actions-gate.server.ts:46-75` marca `PROCESSING` + `claimed_by`, e a ordenação dá prioridade máxima ao item reivindicado (`src/lib/crm/daily-actions.ts:181-209`). Ação vencida de outro lead entra atrás.
- Clique fora da posição atual é rejeitado no servidor (`assertCurrentAction` / `assertCurrentLead` / `assertCurrentQueueItem`, `daily-actions-gate.server.ts:91-144`) em todas as funções de execução.
- COPIAR consulta a versão ativa da Biblioteca no momento do clique: `getDailyActionMessageFn` (`src/lib/crm/daily-actions.functions.ts:109-123`) → `prepareStepMessage` → `renderFromLibrary`. Não há cópia armazenada na Ação do Dia.

## B. O que ainda está errado

1. O card legado **"Executar primeiro contato (E0)"** continua existindo e funcional.
2. Ao ser acionado, ele cria `crm_messages` e chama a Meta, **pulando as duas ligações**.
3. A blindagem que esconde esse card depende de uma reconciliação que, se falhar, reexpõe o caminho legado (falha silenciosa).
4. A segunda ligação aparece de forma passiva: ela existe no banco com horário previsto, mas surge na tela quando a Ação do Dia é reaberta após os 10 minutos — não há um disparo ativo no minuto exato.

## C. Onde está o caminho legado

- Tela: `src/components/crm/daily-actions-overlay.tsx:624-631` (botão) e `:297-315` (handler).
- Adaptador: `src/components/crm/daily-actions-real-adapter.ts:62-85`.
- Função de servidor: `src/lib/crm/first-contact-mode.functions.ts:16-35` → `executeE0Action` (`src/server/crm/e0-actions.server.ts:128-234`) → `registerFirstContact` (`src/server/crm/first-contact.server.ts:53-159`) → `dispatchFirstContact` (`src/server/relationship/e0.server.ts:72-260`).
- Onde a mensagem nasce e o envio acontece: `src/server/relationship/e0.server.ts:142-151` (insert em `crm_messages`) e `:211-222` (chamada à Meta).
- Filtro que hoje esconde o card: `src/server/crm/daily-actions.server.ts:217-221`, dependente de `ensureManualE0Cadences()` em `:101-103`, cujo erro é engolido por um `catch` que devolve conjunto vazio.

## D. Como a E0 está representada hoje

Linha em `relationship_queue` com `step = "E0"`, `action_order` (1, 2, 3) e `action_kind` (`call`, `call`, `message`). A tela apenas traduz `action_kind` para "ligação"/"mensagem" (`src/server/crm/daily-actions.server.ts:384,412`). Ou seja, a representação já é a correta.

## E. Como a fila/posição 1 é controlada hoje

Servidor. O item em atendimento fica `PROCESSING` com dono e recebe prioridade máxima na ordenação; qualquer outra ação vencida entra na posição seguinte. A proteção não depende do navegador.

## F. Menor alteração necessária

Três ajustes cirúrgicos, sem nova fila, sem nova tabela, sem migration, sem tocar em Biblioteca, motor de outras etapas, follow-up, agendamento, R3 ou E7/E8:

1. **Fechar o executor legado para E0 manual**: em `executeE0Action`, inverter a lógica de tolerância — recusar sempre que o card for de entrada operacional atual, em vez de recusar só quando "governado pela V2" for comprovado. Falha na verificação passa a bloquear, não liberar.
2. **Remover o card "Executar primeiro contato (E0)" da Ação do Dia**: parar de emitir itens de tipo `primeiro_contato` na montagem da fila e retirar o botão correspondente da tela. A pendência legada permanece no banco como histórico.
3. **Tornar a reconciliação não-silenciosa**: quando `ensureManualE0Cadences()` falhar, a Ação do Dia deve omitir o card em vez de reexpor o caminho legado.

Opcional (não exigido pela regra): fazer a segunda ligação ser reavaliada pelo agendador já existente, para que apareça sem depender de reabrir a tela.

## G. Arquivos que precisariam mudar

- `src/server/crm/e0-actions.server.ts`
- `src/server/crm/daily-actions.server.ts`
- `src/components/crm/daily-actions-overlay.tsx`
- `src/components/crm/daily-actions-real-adapter.ts` (remoção da chamada legada)
- possivelmente `src/lib/crm/first-contact-mode.functions.ts` (deixar de expor a execução)

## H. O que NÃO precisaria mudar

Régua V2 (`cadence-v2.ts`), motor e decisão, `relationship_queue`, trava de posição/ordem (`daily-actions-gate.server.ts`), registro de desfecho de ligações, Biblioteca e o caminho de COPIAR, follow-up do GreenSales, agendamento, R3, E7/E8, Central dos Nomes, Safety Lock, e qualquer coisa fora de `/f`.
