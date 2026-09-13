# Lapidação final da Biblioteca e Ação do Dia — Financeira `/f`

## Escopo preservado

- Alterar somente Biblioteca/mensagens e o desfecho de agendamentos exibidos na Ação do Dia da Financeira.
- Manter intactos `/s`, `/s/portal`, `/seg`, Portal Solar, GreenSales, CRM, tags/colunas, reentrada, histórico, calendário, prioridades e a régua E0–E8 fora da configuração editorial da E6.
- Não criar tabela, fila, etapa, motor ou cadência.

## Implementação

### 1. E6 com contexto único

- Retirar E6 do mapa de etapas contextuais e obrigatórias, mantendo E7/E8 sem alteração.
- Fazer a E6 sempre consultar/publicar sua única combinação sem `step_context`, com as variantes `COM_NOME` e `SEM_NOME`.
- Consolidar os registros existentes de E6 sem apagar histórico: preservar as versões contextuais como histórico inativo e publicar no slot único o conteúdo vigente da E6, sem alterar E7/E8.
- Ajustar os testes direcionados de combinações e seleção de contexto.

### 2. Nome reavaliado ao preparar cada mensagem

- Remover o nome transportado pela fila/tela como fonte da preparação da mensagem.
- Em cada abertura/preparo de etapa, reler o nome atual do lead no servidor e passar pelo caminho existente `resolveCentralFirstName` → `resolveTreatment` → variante `COM_NOME`/`SEM_NOME`.
- Manter snapshots de mensagens já concluídas imutáveis; a releitura vale somente para a próxima mensagem preparada.
- Cobrir a troca de `SEM_NOME` para `COM_NOME` e o retorno para `SEM_NOME` em etapas posteriores.

### 3. Agendamento como pendência de desfecho

- Substituir as perguntas atuais por: compareceu ou não compareceu; em ambos os casos, perguntar se haverá novo agendamento.
- Se não houver novo agendamento, concluir o próprio compromisso e removê-lo da fila.
- Se houver, registrar o desfecho, orientar o novo cadastro no GreenSales e concluir a ação atual; o próximo horário continuará vindo somente da sincronização oficial.
- Remover da Ação do Dia a geração/leitura da revisão automática de 24h e as transições automáticas para `VENCIDO_SEM_CONTATO_SEM_REAGENDAMENTO` ou `RETOMAR_EM_FRIOS`, sem apagar registros históricos existentes.
- Manter o compromisso original `PENDENTE` quando o executivo fechar a tela sem responder; ele reaparece no próximo dia operacional como a mesma pendência.

## Validação

- Executar testes direcionados de E6, nome por etapa, desfecho/reabertura do agendamento e prioridade `claim → emergência → alerta → E0 → atrasados → hoje → futuros`.
- Confirmar que `resolveOperationalWindow` e a regra normal de domingo não mudaram.
- Verificar a compilação automática e os diagnósticos finais.
