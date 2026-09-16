# Ajuste cirúrgico do Modo Janela e auditoria da cadência

## Diagnóstico confirmado

### A–E. Fluxo da Ação do Dia
- **A. Modo Janela:** `DailyActionCard`, em `src/components/crm/daily-action-card.tsx`, controla `messageOpen`, carrega a mensagem oficial e renderiza a janela.
- **B. Copiar mensagem:** `handleOpenMessage()` carrega o texto e chama `loadMessageForModal()`; a cópia efetiva é feita por `copyMessageBody()` usando `copyToClipboard()`.
- **C. Concluir etapa:** somente `handleRegisterMessage()` ou `completeCallAndMessage()` chama o adaptador de conclusão quando o usuário pressiona **Concluído**.
- **D. Avançar o motor:** no servidor, `registerDailyActionMessage()` conclui a linha oficial por `confirmManualExecution()`; depois `scheduleFollowUp()` calcula e materializa a próxima obrigação. Nenhum desses caminhos é chamado pela função de copiar.
- **E. Montar a fila:** `buildDailyActions()` reúne compromissos, reuniões, fila persistida, fechamentos e avisos; `currentDailyAction()` aplica a seleção oficial e a interface relê essa fotografia periodicamente.

### F–H. Regra real de E1, E2 e E3
- **Entrada da cadência:** o ciclo nasce por evento oficial (`LEAD_CREATED`/`FIRST_CONTACT_SENT`) e fica em `relationship_cadences`; para E0 manual, `workspace_e0_actions.entry_at` ancora a data operacional e `openManualE0Cadence()` abre o mesmo motor.
- **Data da E1:** na régua V2, E0 → E1 tem intervalo de 1 dia de calendário. A data parte da origem operacional da E0, mas a execução real anterior funciona como piso; fins de semana e feriados são deslocados pela regra vigente e duas etapas do mesmo lead não ocupam o mesmo dia.
- **E2 e E3:** E1 → E2 e E2 → E3 usam 2 dias de calendário cada. O cálculo preserva a data teórica, mas atraso na conclusão anterior desloca a próxima obrigação para não ficar antes da execução real.
- **Agendamento/reunião:** estágios comerciais de agendamento/vídeo e demais estágios congelados não geram novas obrigações normais; `SCHEDULE_CREATED` também bloqueia o ciclo e neutraliza pendências. Reuniões e compromissos continuam como fontes próprias da Ação do Dia até receberem desfecho.
- **Conclusão manual:** apenas o botão **Concluído** transforma a ação da fila em `EXECUTED`, registra histórico/snapshot quando aplicável e pede ao motor a próxima obrigação.
- **Mudança de regra:** ciclos versionados mantêm `flow_version_id` e continuam na versão congelada no nascimento. Ciclos legados sem versão usam o plano de compatibilidade; filas já materializadas preservam sua identidade e não são rebaixadas quando já estão `PROCESSING` ou `EXECUTED`.
- **Fila persistida:** `relationship_queue` é persistida e idempotente. Ela não é reconstruída do zero diariamente; é materializada/reavaliada em eventos, conclusões e ticks do motor, além das reconciliações existentes.
- **Workspace sem Ação do Dia:** pode ocorrer quando o lead ainda aguarda a primeira ação humana, está em estágio congelado/incompatível, tem compromisso que suspende a cadência, está encerrado/arquivado, pertence a ciclo histórico anterior ao marco operacional, possui obrigação futura, foi pulado no dia, não pertence ao executivo aplicável ou está sem obrigação materializada/liberada.

### Cenários solicitados
- **Recebidos entre sexta e segunda:** não formam obrigatoriamente um único lote para E1 na terça. Entrada de sexta antes das 18h com E0 concluída na sexta tende a gerar E1 na segunda; sexta após 18h e fim de semana têm E0 operacional na segunda e, concluída na segunda, geram E1 na terça. A execução efetiva e as exceções de calendário continuam prevalecendo.
- **Recebidos na terça:** com E0 concluída na terça, a sequência atual é E1 na quarta e E2 na sexta.
- **Recebidos na quarta:** com E0 concluída na quarta, E1 fica na quinta; depois E2 segue dois dias teóricos, com deslocamento de fim de semana/feriado conforme a regra vigente.

## Alteração única no Modo Janela

1. Ajustar somente `DailyActionCard` para que o clique inicial carregue a mensagem, abra a janela e tente copiá-la, sem chamar conclusão, registro ou avanço.
2. Remover o feedback de sucesso da cópia, inclusive “Mensagem copiada da Biblioteca” e o texto de sucesso dentro da janela.
3. Em qualquer falha de cópia, manter a janela aberta e mostrar somente **“Mensagem não foi copiada.”**
4. Manter o botão interno sempre identificado como **“Copiar mensagem”**; cada clique fará uma nova tentativa independente e limpará o aviso quando funcionar.
5. Preservar integralmente o botão **Concluído** como a única ação que registra execução e permite o avanço da cadência.

## Testes e validação

- Ajustar testes focados da janela para: sucesso silencioso; falha com texto exato; janela aberta após falha; segunda tentativa independente; cópia sem chamadas de conclusão; **Concluído** ainda separado e funcional.
- Rodar apenas os testes focados do card/janela, verificação de tipos e confirmar o build automático.
- Validar no Preview autenticado se houver sessão disponível.
- Não alterar banco, filas, datas, E1/E2/E3, regras de calendário, motor, polling ou publicação.
