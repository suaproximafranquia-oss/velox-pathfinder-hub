# Ação do Dia (/f) — ajustes confirmados

A especificação está coerente com a arquitetura atual. Uma única consequência arquitetural real: as Notas do Executivo hoje vivem apenas no navegador, então precisam ganhar um lugar próprio no banco antes de a observação da Ação do Dia poder ser salva nelas.

## 1. Notas do Executivo saem do navegador

- Nova tabela no banco para notas do investidor: texto, autor (executivo), data/hora, vínculo com o lead (`portal_leads.id`), escopo do ambiente e uma chave de origem para evitar duplicidade.
- Acesso controlado: só usuários autenticados leem/escrevem; gravação sempre pelo servidor, com o autor vindo da sessão (nunca enviado pelo navegador).
- A aba "Notas do Executivo" da ficha passa a ler e gravar no banco.
- Consequência: notas escritas hoje no navegador não aparecem automaticamente no novo lugar. Proposta padrão: manter uma leitura de compatibilidade que ainda exibe as notas locais antigas, marcadas como legado, sem reescrever nada. Nada é apagado.

## 2. E0 / primeiro contato — duas correções

- Quando o motor executa o primeiro contato automaticamente, uma ação manual E0 pendente do mesmo investidor é encerrada/neutralizada no mesmo momento (sem apagar registro, apenas encerrando o estado).
- Filtro defensivo na montagem da Ação do Dia: E0 não é exibido quando o primeiro contato já está registrado.
- Nada mais em E0 muda: modo manual continua aparecendo, ownership, redistribuição e o mecanismo geral ficam intactos.

## 3. Ações de mensagem — botões

- Botões: "Copiar mensagem" (rotulado pela etapa, ex.: Copiar E1), "Ver ficha completa", campo opcional de observação, "Concluído".
- "Abrir conversa" sai apenas das ações de mensagem.
- O texto copiado é exatamente a mensagem oficial já renderizada para aquele investidor (mesma preparação que alimenta o snapshot).
- Copiar e abrir ficha não concluem nada. Só "Concluído" conclui.
- Ações de ligação ficam exatamente como estão.

## 4. Ver ficha completa

- Navega para o Workspace existente: `/f/executivo/dashboard?perfil=<leadId>&escopo=<scope>`, reaproveitando o mecanismo atual. Nenhuma tela nova.

## 5. Observação → Nota

- Só grava nota quando "Concluído" é acionado e há texto.
- Copiar, abrir ficha, pular ou concluir sem texto não geram nota.
- A gravação é idempotente pela chave de origem da ação: repetir a conclusão não duplica nota.
- A nota é gravada junto da conclusão, mas uma falha ao gravar a nota não desfaz a conclusão, o snapshot nem o avanço da cadência.

## Pontos técnicos

- Migration mínima: uma tabela de notas com GRANTs e RLS; nenhuma alteração em tabelas de cadência, fila, ciclos ou histórico.
- Escrita via server function autenticada; `localStorage` deixa de ser fonte de verdade.
- Chave de idempotência da nota derivada do identificador do item da fila, no mesmo padrão já usado pelo snapshot.
- Preservado sem alteração: histórico, cadência, ownership, redistribuição, Safety Lock do WhatsApp (nenhum envio real), `/s`, `/seg` e `/`.

## Decisão em aberto

Se as notas antigas do navegador devem ser exibidas como legado (proposta acima) ou simplesmente ignoradas.
