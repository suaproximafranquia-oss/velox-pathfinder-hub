# Diagnóstico — Central de Mensagens + janela temporária de domingo

Nada foi alterado. Abaixo o que os registros mostram, um a um.

## A) O que realmente aconteceu

A causa não foi apagamento de etapa. Foi **descolamento entre o título e a chave técnica**.

Em 29/08 e 31/08 várias mensagens foram **renomeadas no título** (campo de rótulo), mas a chave técnica gravada continuou a antiga. Depois, a Biblioteca passou a considerar operacional apenas a etapa que existe na configuração do motor. Resultado: mensagens cujo título diz "E4", "R3", "RE0", "RE1", "ER1" estão gravadas sob chaves que a configuração não conhece (E2, E5, E6, E7, TESTE) e por isso caíram na caixa "Histórico fora da configuração".

Cruzamento real (título que você vê → chave gravada → situação):

| Título exibido | Chave real | Versões | Ativa | Posição | Situação |
|---|---|---|---|---|---|
| E4 — Oferta de apresentação digital | E2 | 2 | sim (v2) | 50 | fora da configuração |
| R3 — Oferta de apresentação digital | E5 | 3 | sim (v3) | 110 | fora da configuração |
| RE0 — Reentrada | E6 | 3 | sim (v3) | 130 | fora da configuração |
| RE1 — Reentrada / conteúdo | E7 | 2 | sim (v2) | 140 | fora da configuração |
| ER1 — Etapa de RMK 1 | TESTE | 2 | sim (v2, corpo "TESET") | 200 | fora da configuração |

Ou seja: **E2, E5, E6, E7 e TESTE são as únicas cinco chaves fora da configuração**. Todas as demais continuam operacionais, ainda que com título editorial diferente da chave:

- E0, E1, E3, E12, E4, E30, E20, E27, FINALIZACAO, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1, V3, V4, E0_V1, RESPOSTA_AUTOMATICA — todas existem na configuração e na Biblioteca.
- Títulos hoje trocados em relação à chave: E3 aparece como "E2", E12 como "E3", E4 como "R2", RE0 como "E5", RE1 como "E8", RE2 como "R4", RE3 como "ER0", V4 como "ER2", FINALIZACAO como "RE2", R1 como "RE3", R2 como "RF0", R3 como "RF1".
- **E5, E6, E7, E8 não existem como etapa do motor** — são numeração editorial do documento Word. E6/E7 correspondem tecnicamente a E20/E27.
- **R0 e R4 não existem**: o reengajamento é R1, R2, R3.
- **ER0, ER1, ER2 não existem na configuração**: hoje "ER0" e "ER2" são apenas títulos colados sobre RE3 e V4, e "ER1" é a chave de teste TESTE. Não há nenhum fluxo de RMK por executivo declarado no motor.

## B) O que está preservado

Tudo. Nenhuma versão foi apagada: as cinco chaves fora da configuração mantêm 12 versões no total, com autor, data e notas. As versões v1 de E2/E5/E6/E7 vieram do Word oficial e estão marcadas como desativadas com a nota "o conteúdo oficial passou para a etapa técnica correspondente" — indício de que houve uma migração de conteúdo em 29/08 e que essas linhas ficaram como resíduo.

## C) Por que caíram no histórico

A Biblioteca passou a derivar a lista de etapas operacionais da configuração do motor. Chave que não está lá vira histórico. E2/E5/E6/E7 nunca foram etapas do motor (são rótulos do Word) e TESTE foi criada manualmente. O título não é prova de nada: a caixa decide pela chave.

## D) O que a próxima construção precisa fazer

1. **Decidir o destino de cada uma das cinco chaves**, item a item, com você:
   - se o texto ativo dela é o texto correto de uma etapa que já existe (por exemplo, o texto sob E2 pertencer a E4), a construção **republica esse texto como nova versão da etapa oficial**, mantendo a linha antiga intacta como histórico. Nada é apagado, nada é reescrito.
   - se for realmente uma etapa nova do motor (caso do fluxo de RMK por executivo, ER0/ER1/ER2), ela precisa **nascer na configuração do motor** primeiro; a Biblioteca então a exibe sozinha e o conteúdo existente é republicado ali.
   - TESTE, cujo corpo é "TESET", provavelmente só deve permanecer como histórico.
2. **Alinhar título e chave** nas etapas que continuam operacionais, para acabar com a leitura enganosa (E3 aparecendo como "E2" etc.). É mudança de rótulo, sem nova versão de texto e sem tocar em fila, ciclo ou histórico.
3. **Separar formalmente RE (reentrada) de ER (RMK por executivo)** na camada de rótulos, para o sistema parar de confundir os dois.

Nada disso exige apagar registro nem criar mensagem nova: é republicação de texto já existente e ajuste de rótulo.

## E) Janela temporária de domingo (até 07/09/2026 23:59)

Sim, é seguro, e responde a todas as suas perguntas:

1. Possível. A janela operacional da Ação do Dia é decidida em um único ponto do sistema, por uma função que recebe o instante atual e devolve "aberta/fechada".
2. e 4. A exceção seria uma **data-limite fixa gravada nesse mesmo ponto**: enquanto o instante for anterior a 07/09/2026 23:59 em São Paulo e for domingo, a janela abre; a partir de 08/09 00:00 a condição simplesmente deixa de ser verdadeira e a regra normal volta sozinha, sem nenhuma ação humana.
3. e 5. A regra permanente (seg–sex 06:00–22:00, sábado 06:00–17:00, domingo fechado) não muda nenhum valor. A exceção é um acréscimo com prazo, não uma reescrita.
6. Não exige exceção por lead, executivo ou etapa, e não altera a configuração do motor.
7. Sem risco para E0, cadência, filas ou histórico: essa janela governa apenas a **execução manual** da Ação do Dia. A janela de envio do motor vive em outro lugar e não seria tocada. Depois de expirada, não sobra nenhum registro de regra especial — apenas os atendimentos que você executar hoje, que são atividade real e permanecem no histórico como qualquer outra.

Observação honesta: hoje esse bloqueio de janela é aplicado na tela da Ação do Dia. Se você quiser que a exceção também valha em uma verificação de servidor, a construção precisa passar pelo mesmo ponto único — o que já é o desenho proposto.

## Próximo passo

Aprovando, eu volto com as perguntas de destino das cinco chaves (uma a uma) e, na mesma construção, aplico o alinhamento de rótulos e a janela temporária.
