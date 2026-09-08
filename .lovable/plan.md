# Validação final da cadência antes da construção

Somente leitura. Nada foi alterado: nem código, nem banco, nem mensagens, nem Biblioteca, nem Ação do Dia.

## A. A proposta do fluxo E é coerente?

Sim estruturalmente, mas há um efeito colateral matemático importante.

Sua régua (D0, +1, +2, +2, +2, +4, +3) dá 14 dias **apenas se as datas forem contadas sobre o calendário teórico**. Como você também quer que a próxima etapa conte a partir da **execução real**, cada deslocamento de fim de semana empurra tudo o que vem depois — e os deslocamentos se acumulam.

Simulação (data teórica → data operacional), dias contados a partir do dia da entrada:

**Entrada segunda**: E0 seg(D0) · E1 ter(D1) · E2 qui(D3) · E3 sáb(D5)→seg(D7) · E4 qua(D9) · E7 dom(D13)→ter(D15) · E8 sex(D18)
**Entrada terça**: E0 ter(D0) · E1 qua(D1) · E2 sex(D3) · E3 dom(D5)→ter(D7) · E4 qui(D9) · E7 seg(D13) · E8 qui(D16)
**Entrada quarta**: E0 qua(D0) · E1 qui(D1) · E2 sáb(D3)→seg(D5) · E3 qua(D7) · E4 sex(D9) · E7 ter(D13) · E8 sex(D16)
**Entrada quinta**: E0 qui(D0) · E1 sex(D1) · E2 dom(D3)→ter(D5) · E3 qui(D7) · E4 sáb(D9)→seg(D11) · E7 sex(D15) · E8 seg(D18)
**Entrada sexta**: E0 sex(D0) · E1 sáb(D1)→seg(D3) · E2 qua(D5) · E3 sex(D7) · E4 dom(D9)→ter(D11) · E7 sáb(D15)→seg(D17) · E8 qui(D20)
**Entrada sábado**: E0 sáb(D0, se houver operação) · E1 dom(D1)→ter(D3) · E2 qui(D5) · E3 sáb(D7)→seg(D9) · E4 qua(D11) · E7 dom(D15)→ter(D17) · E8 sex(D20)
**Entrada domingo**: E0 não executa no domingo — a entrada só é trabalhada na segunda, e a régua passa a valer a partir dali (igual à linha "entrada segunda").

**Conclusão**: o horizonte real vai de 16 a 20 dias, não 14–15. Se você quiser ancorar em ~15 dias, a saída é contar a próxima etapa sobre a **data teórica anterior** e usar a execução real só como piso (nunca antes de hoje). Essa é a decisão que falta — está no item J.

Ponto menor a decidir: se sábado é dia de operação, uma etapa teórica no sábado deveria mesmo ir para segunda? Hoje sua regra diz que sim, o que significa que sábado recebe execução de compromissos e ligações em aberto, mas nunca vencimentos novos de cadência. É coerente, só precisa ser assumido.

## B. O ramo E5/E6 é coerente?

Sim. Partindo de E4 no D7 (entrada segunda): E5 imediato na resposta (D7) · E6 +7 = D14 (domingo → terça, D16) · E7 +2 = D18 (quinta) · E8 +3 = D21 (domingo → terça, D23). O ramo fica em torno de três semanas — coerente com um ciclo que já teve material.

Os dois contextos de E7/E8 (SEM_CONTATO e MATERIAL_ENVIADO) são representáveis sem criar etapas: uma chave por etapa, e a seleção do texto por contexto estruturado do ciclo. Nunca por texto ou título.

## C. E1 com subações é viável?

Sim, e é a construção mais nova de todas. Conceito confirmado: E1 continua uma etapa única no histórico e na Biblioteca; dentro dela existem passos (ligação 1 → +3h → ligação 2 → mensagem). A Ação do Dia mostra cada passo pendente como um card rotulado E1; a conclusão de um passo libera o próximo. Nada de E1.1/E1.2.

O que não existe hoje: intervalo em horas (todos os prazos são em dias) e o conceito de passo dentro da etapa. Precisa ser criado.

## D. Fila L1–L4 — uso atual e risco de duplicidade

- Ela é construída no servidor e consumida em dois lugares: a **Ação do Dia** (que a agrega junto com as demais fontes) e as funções de fila de ligações usadas pelo CRM.
- Atende leads pelas colunas ZERO CONTATO e FRIOS — ou seja, **os mesmos leads** que o fluxo E acompanha.
- L1 é manual (lead ainda em NOVOS); L2 (+2 dias úteis), L3 (+1) e L4 (+3) são automáticos.
- **Risco real e confirmado**: com E1 ganhando ligações internas, o mesmo lead passaria a ter uma ligação vinda do motor de etapas e outra vinda de L2/L3/L4, no mesmo período, como dois cards distintos. Hoje só há deduplicação por horário idêntico de reunião — nada impede essa duplicidade.
- Nada foi removido nesta rodada. A decisão futura coerente com sua intenção é: o motor de etapas vira a autoridade das ligações de relacionamento e a fila L1–L4 é desativada como geradora de obrigação (preservando o histórico já gravado).

## E. R1–R4 é coerente?

Sim, e é construção. Hoje existe R1 → R2 → R3, todos com um intervalo global de 2 dias úteis; R4 não existe e não há condição de pular R3.

Sua régua: R1 · +2 R2 · (sem material) +2 R3 · +4 R4 · (com material) R2 +4 R4. Simulação a partir de um R1 na segunda: sem material → R2 qua, R3 sex, R4 ter (D9); com material → R2 qua, R4 dom(D7)→ter(D9). Os dois caminhos chegam no mesmo dia — coerente e elegante, sem buraco.

## F. RE0–RE3 é coerente?

Sim, com ajustes de números. Hoje: RE0 imediato, RE1 +2, RE2 +3, RE3 +5, tudo em dias úteis, sem bifurcação.

Sua régua (RE0 · +1 RE1 · +2 RE2 · +5 RE3, ou RE1 · +3 RE3 quando não precisa repetir a apresentação) é tecnicamente possível e usa o mesmo mecanismo de bifurcação do fluxo E. A partir de um RE0 na segunda: com apresentação necessária → RE1 ter, RE2 qui, RE3 ter (D9); sem necessidade → RE1 ter, RE3 sex (D5). Coerente.

## G. Como identificar "material já recebido" de forma estruturada

Não existe hoje esse sinal. O caminho correto, sem texto e sem etiqueta: registrar no **histórico do ciclo** um evento próprio quando a apresentação digital é enviada — o que já acontece de forma natural quando a etapa E5 é concluída, porque toda conclusão grava um registro imutável da etapa executada. A pergunta "este ciclo já recebeu apresentação?" vira "E5 consta como executada neste ciclo?". Isso serve igualmente ao contexto de E7/E8, ao salto de R3 e ao salto de RE2.

Falta apenas cobrir o caso em que o material foi enviado fora do fluxo (envio manual): aí é preciso um registro explícito equivalente, feito pelo executivo.

## H. Reentrada sem depender de etiqueta

O motor **já faz isso hoje**, e exatamente no espírito que você descreve: a reentrada exige as três condições combinadas — existe relacionamento anterior, existe uma nova entrada comercial detectada pela sincronização, e a contagem de entradas do lead aumentou. A simples volta do lead para a coluna NOVOS na origem **não** caracteriza reentrada. Etiqueta não é autoridade em nenhum ponto. Nada a construir aqui.

## I. Dias corridos + deslocamento para E, R e RE

Funciona, e é a opção mais simples de manter: o deslocamento vive num único ponto do calendário, e todos os fluxos passam por ele. RF fica fora e congelado — vira a única exceção documentada, mantendo os prazos em dias úteis. Não haverá duas regras de calendário para E, R e RE.

Confirmações que você pediu:
- Sábado teórico → segunda; domingo teórico → terça; domingo com terça feriado → próximo dia com operação (o encadeamento resolve sozinho).
- Atraso nunca empilha: cada etapa seguinte parte da execução real, e o motor não compensa.
- Novo lead segue entrada → E0 → etapas seguintes, sem regra especial por dia da semana além do calendário.
- Agendamento é data/hora real e **nunca** é deslocado pela regra da cadência.
- Ação do Dia continua só lendo obrigações.
- E0 mantém sua própria configuração de execução e continua manual onde já é manual.

## J. Conflitos e lacunas que ainda precisam da sua decisão

1. **Âncora do horizonte** (o único conflito de fundo): contar a próxima etapa a partir da execução real faz o ciclo variar de 16 a 20 dias, não 14–15. Escolher entre (a) manter execução real e aceitar o horizonte maior, ou (b) contar sobre a data teórica anterior usando a execução real apenas como piso.
2. **Sábado**: dia de operação para execução, mas nunca para vencimento novo de cadência — confirmar.
3. **Fila L1–L4**: confirmar que ela será desativada como geradora de obrigação quando E1 ganhar as ligações internas, para não duplicar ação.
4. **Material enviado fora do fluxo**: como o executivo registra isso, já que o sinal estruturado será a execução de E5.
5. **Janela unificada**: 09:00–17:30 e sábado 08:00–16:00 substituem as janelas atuais de mensagens; confirmar que a janela própria de E0 permanece como está.
6. **Etapas novas no motor**: E2, E5, E6, E7 e E8 passam a existir de fato (hoje são só chaves editoriais), e R4 também. Os ciclos em andamento permanecem na régua antiga.

Resolvidos esses seis pontos, não vejo impedimento técnico: **ARQUITETURA PRONTA PARA CONSTRUÇÃO.**
