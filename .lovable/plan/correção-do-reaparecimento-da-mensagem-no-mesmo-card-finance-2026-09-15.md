# Correção do reaparecimento da mensagem no mesmo card — Financeira /f

## Objetivo

Eliminar exclusivamente a ressurreição de uma mensagem já concluída no fluxo atual de **ligação → resultado → mensagem → copiar → concluído**, mantendo tudo no mesmo card e na mesma execução da `relationship_queue`.

Não haverá nova etapa, card, fila, tabela, motor, polling, texto, prazo ou alteração de cadência.

## Evidência já confirmada

- A conclusão composta atual registra primeiro o resultado da ligação, materializa a mensagem da mesma etapa e conclui o item real da fila como `EXECUTED`.
- A proteção de clique/retry já usa transição condicional de `PENDING/PROCESSING` para `EXECUTED`; o snapshot da mensagem também possui identificação estável pelo item da fila.
- A reconstrução da Ação do Dia executa reconciliações e o tick do motor, e as obrigações são materializadas pela chave oficial da fila.
- No estado atual do caso Thyana (`gs_59532`), existe uma ligação E0 `EXECUTED`, uma única mensagem E0 `EXECUTED`, o snapshot correspondente, a cadência ativa já avançada para E1 e nenhuma segunda E0 pendente. Portanto, o sintoma histórico é real, mas a causa exata não pode ser atribuída com segurança apenas à fotografia atual.
- A cobertura existente verifica partes do card e da ordenação, mas não executa integralmente a conclusão composta, os retries e as reconstruções sucessivas no servidor.

## Plano de implementação

1. **Reproduzir a cadeia server-side com dados fictícios isolados**
   - Montar o estado mínimo de E0 para `NAO` e `SIM` usando somente leads `TEST-XXXX`.
   - Executar a função real de conclusão composta e, em seguida, as mesmas leituras/ticks/reconciliações usadas pela Ação do Dia.
   - Registrar nos testes qual caminho tenta reutilizar, recriar ou reexibir a obrigação depois de `EXECUTED`.

2. **Corrigir a causa no ponto oficial de persistência/materialização**
   - Fazer a conclusão da mensagem confirmar de forma durável a mesma execução composta identificada pelo item oficial da fila.
   - Antes de qualquer materialização/reabertura equivalente, reconhecer `EXECUTED` para o mesmo lead, etapa, execução e ordem de ação como estado terminal.
   - Se o defeito estiver na seleção após o tick, vincular a conclusão ao item materializado pela própria execução, sem busca ambígua por outro item da mesma etapa.
   - Se o defeito estiver na reconciliação, impedir somente a recriação equivalente já concluída e neutralizar apenas pendências antigas incompatíveis; preservar histórico, versões novas, ações válidas e cadências futuras.

3. **Reforçar idempotência sem mecanismo paralelo**
   - Reutilizar `actionKey`, identidade do queue item, `claimed`, `PROCESSING`, `EXECUTED`, versão e chave oficial de materialização.
   - Tratar clique duplo, retry, resposta atrasada, reload e ticks repetidos como no-op após a primeira conclusão válida.
   - Não usar mudança de estágio, F5 ou tick posterior como condição para encerrar a ação.

4. **Preservar o mesmo card e a resolução editorial atual**
   - Manter a mensagem imediatamente após o resultado da ligação, sem retornar à fila entre ligação e mensagem.
   - Preservar `SIM/ATENDEU → CONTATO_REALIZADO → ENVIO_MATERIAL_POS_CONTATO`.
   - Preservar `NAO/NÃO ATENDEU → SEM_CONTATO → mensagem específica da etapa`.
   - Não alterar textos, versões publicadas ou o layout da Biblioteca.

5. **Testes focados obrigatórios**
   - E0 `NAO`: concluir ligação+mensagem e confirmar uma única execução encerrada.
   - Uma e várias reconciliações após a conclusão: zero E0/mensagem recriada.
   - Reload/nova leitura: nenhuma obrigação concluída retorna.
   - E0 `SIM`: nenhuma `SEM_CONTATO` posterior.
   - Retry, clique/processamento duplicado e resposta atrasada: uma única execução e um único snapshot.
   - Estado `EXECUTED`: nunca volta à fila; `PROCESSING`/`claimed` continuam protegidos.
   - Vários leads: neutralização isolada, sem remover ações legítimas dos demais.
   - Caso Thyana reproduzido com identidade fictícia equivalente e, sem alterar dados reais, conferência somente leitura de que `gs_59532` continua sem nova E0 após as reconciliações.
   - Regressão das etapas E0, E1, E2/V2, E3/V3, E4, E7, R1, R2, RE0, RE1 e RE3.

6. **Validação final, sem publicar**
   - Executar os testes focados e os testes existentes da Ação do Dia.
   - Executar typecheck e build.
   - Verificar no Preview `/f` e `/f/executivo`: ligação, mensagem no mesmo card, conclusão, releitura e reconciliação.
   - Confirmar por consulta somente leitura que o caso Thyana permanece com E0 executada e sem nova pendência equivalente.

## Limites preservados

Nenhuma alteração em `/s`, `/s/portal`, `/seg`, Portal Solar, Agenda, GreenSales fora deste fluxo, Biblioteca, textos oficiais, links, imagens, DNS/WWW, calendário, prioridades, cadências E/R/RE, arquitetura da `relationship_queue` ou funcionalidades futuras. Nada será publicado.

## Relatório final

O fechamento informará: causa real comprovada; arquivos alterados; regra de estado; persistência da ação composta; reconhecimento pela reconciliação; idempotência; prevenção do segundo card; quantidade e resultado dos testes; typecheck; build; Preview; preservação das áreas protegidas; e confirmação explícita do caso Thyana após novas reconciliações.
