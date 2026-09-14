# E0 definitiva: segunda-feira e contato realizado

## Objetivo
Alterar somente a E0 da Financeira para que a segunda-feira operacional tenha uma ligação, enquanto terça a sexta mantém duas ligações. A mensagem seguinte será escolhida pelo resultado real da ligação.

## Implementação
- Tornar o plano interno da E0 sensível ao dia operacional em `America/Sao_Paulo`:
  - segunda-feira: ligação única seguida de mensagem;
  - terça a sexta: ligação 01, espera de 10 minutos, ligação 02 e mensagem.
- Preservar cards separados para ligação e mensagem, sem alterar transições da E0 para E1 nem qualquer outra etapa.
- Registrar o contexto editorial resultante da E0 no estado operacional já existente:
  - `NAO` → `SEM_CONTATO`;
  - `SIM` → `CONTATO_REALIZADO`.
- Na primeira ligação atendida de terça a sexta, manter o card aberto e mostrar a decisão solicitada:
  - **Copiar mensagem** lê e copia a versão vigente `CONTATO_REALIZADO`, sem concluir ou registrar envio;
  - **Concluído** registra o desfecho, cancela a segunda ligação e libera a mensagem correta, sem copiar.
- Na segunda-feira, concluir normalmente a ligação e liberar imediatamente a mensagem correta, sem confirmação especial.
- Adicionar `CONTATO_REALIZADO` como segundo contexto oficial da E0 na Biblioteca, mantendo a mensagem E0 atual como `SEM_CONTATO` e criando a nova versão publicada com o texto fornecido e personalização existente de nome.
- Fazer a preparação da mensagem E0 consultar o resultado estruturado da ligação atual; nenhum texto será inferido de observações.

## Recálculo de hoje
- Reconciliar somente filas E0 produtivas, abertas e referentes à segunda-feira operacional atual.
- Cancelar apenas segundas ligações ainda pendentes/processando pela regra antiga.
- Preservar todas as ligações já executadas e mensagens já concluídas.
- Para primeira ligação já concluída, liberar uma única mensagem no contexto correspondente, sem duplicar.
- Para primeira ligação ainda aberta, manter somente essa ligação; a mensagem será criada após seu desfecho.
- Não tocar E1/E2, histórico concluído, carryover ou outros ambientes.

## Validação
- Testes focados da E0 para segunda-feira, terça a sexta, atendimento, não atendimento, cópia e conclusão.
- Testes dos dois contextos editoriais e personalização de nome.
- Testes do recálculo idempotente de hoje, incluindo preservação de histórico e ausência de duplicatas.
- Typecheck, build e inspeção da Ação do Dia no preview.

## Limites
Nenhuma alteração em E1–E8, R/RE, agendamentos, GreenSales, Portal Leads, autenticação, domínios, segurança, demais mensagens ou outros módulos.
