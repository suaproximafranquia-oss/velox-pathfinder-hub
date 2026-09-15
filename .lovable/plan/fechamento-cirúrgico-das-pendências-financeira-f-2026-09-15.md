# Fechamento cirúrgico das pendências — Financeira `/f`

## Implementação

- Ajustar somente a ordenação da Ação do Dia para colocar `RE0` na mesma classe operacional de abertura de `E0`, mantendo `PROCESSING`, continuidade, alertas e reuniões com a precedência atual.
- Antes da criação de identidade Portal em `/f`, procurar uma correspondência GreenSales confiável no espelho existente: identificador externo quando disponível, telefone brasileiro normalizado e, depois, e-mail; nunca usar somente nome.
- Quando houver correspondência única, reutilizar o identificador `gs_<external_id>`, criar apenas o card GreenSales determinístico ausente com os dados e responsável oficiais, registrar o reconhecimento na auditoria existente e impedir que esse acesso abra E0 ou RE. Conflitos seguem pelo fluxo Portal atual sem fusão automática.
- Reutilizar a normalização brasileira já existente para reconhecer números nacionais válidos sem DDI, preservando o valor bruto da origem; aplicar no card da Ação do Dia a máscara visual oficial `+55 (DD) número` sem duplicar `55`.
- Remover somente a conversão tardia da estrutura de uma E0 realmente originada na sexta antes das 18h. Entradas de sexta às/depois das 18h, sábado e domingo continuam com data operacional de segunda e estrutura de uma ligação seguida de mensagem.

## Testes e validação

- Cobrir prioridade `RE0` versus E0, atrasadas, claimed, continuidade e demais precedências.
- Cobrir correspondência GreenSales por telefone/e-mail, ausência de correspondência, nome isolado, repetição idempotente, card determinístico, auditoria e ausência de E0/RE.
- Cobrir normalização e exibição das três formas do mesmo telefone, sem dupla aplicação de DDI, preservando valor bruto e identidade.
- Cobrir sexta antes/depois das 18h, sábado, domingo, ordem cronológica e isolamento de E1/E2/RE0+.
- Executar testes focados, verificação de tipos, build e conferir `/f` e o console na prévia. Não publicar.

## Limites técnicos

- Reutilizar as funções, tabelas, fila, auditoria e normalizadores atuais; não criar motor, cadastro, fila ou fonte paralela.
- Não alterar `/s`, `/s/portal`, `/seg`, Agenda futura/sidebar, alias `/f/thiago`, DNS/WWW, Reset Operacional, vídeos/Instagram ou funcionalidades adiadas.
