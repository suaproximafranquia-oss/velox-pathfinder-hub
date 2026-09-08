# Calendário e prazos da cadência — diagnóstico definitivo antes da construção

Somente leitura. Nada foi alterado: nem código, nem banco, nem mensagens, nem Biblioteca, nem Ação do Dia, nem agendamento.

## 1. Regra atual do motor

- Cada etapa tem um número de dias e uma finalidade de conteúdo; tudo em um único arquivo de configuração (`src/lib/relationship/config.ts`).
- O cálculo é feito por uma função única do calendário (`src/lib/relationship/calendar.ts`): soma o intervalo à referência e empurra o resultado para o próximo momento com janela aberta.
- A unidade hoje é **dia útil**, não dia corrido, em todos os fluxos.
- O vencimento fica gravado na fila do motor. A Ação do Dia só lê.
- Janelas atuais: mensagens 09:00–21:00 de segunda a sexta, sábado 09:00–12:00, domingo e feriado sem janela; E0 tem janela própria 07:00–22:30. Os horários que você propõe (09:00–17:30 e sábado 08:00–16:00) **não** são os configurados hoje.

## 2. Intervalos E atuais (números reais, sem invenção)

O fluxo executável hoje é `E0 → E1 → E3 → E4 → E12`. As etapas **E2, E5, E6, E7 e E8 não existem no motor** — são chaves editoriais/históricas.

| Pedido | Situação real |
|---|---|
| E0 → E1 | +1 dia útil |
| E1 → E2 | NÃO DEFINIDO (E2 não existe no motor) |
| E2 → E3 | NÃO DEFINIDO |
| E3 → E4 | +3 dias úteis (E3 é +2 a partir de E1) |
| E4 → E7 | NÃO DEFINIDO (E7 não existe) |
| E7 → E8 | NÃO DEFINIDO |
| E4 → E5 | NÃO DEFINIDO (E5 não existe) |
| E5 → E6 | NÃO DEFINIDO |
| E6 → E7 | NÃO DEFINIDO |

O que existe além disso: E12 (+5 dias úteis, encerramento) e E30 (recontato tardio, desativada por chave).

## 3. Fluxo E — horizonte atual

Caminho executável, contando a partir da referência de cada etapa anterior: E0 (0) → E1 (+1) → E3 (+2) → E4 (+3) → E12 (+5) = **11 dias úteis**, que em semana sem feriado dão aproximadamente **15 dias corridos**. Primeiro contato: E0, no dia da entrada. Última tentativa: E12.

- Impacto de sábado/domingo hoje: como a contagem é em dias úteis, fim de semana simplesmente não conta — o horizonte em dias corridos estica.
- Impacto de feriado: idem, feriado não conta como dia útil e estica mais.
- Comparação com sua intenção: o horizonte atual já fica próximo dos 15 dias corridos, mas por um caminho de 5 etapas, não das 7 que você quer. A diferença não é de prazo — é de quantidade de etapas.

## 4. Ramo E5/E6

Não existe. Não há bifurcação por apresentação digital no fluxo E, não há memória de "recebeu material" usada para decidir etapa, e não há etapas E5/E6 no motor. Isso é construção nova (sem criar etapas fora da sua régua: E5/E6/E7/E8 passariam a existir de fato no motor).

## 5. E1 e suas subações

Não é representável hoje: cada etapa é um disparo único, os intervalos são em dias, nunca em horas, e não existe conceito de subação. O que existe é uma **segunda fila, independente**, para ligações (L1 manual, L2 +2 dias úteis, L3 +1, L4 +3).

Menor alteração: introduzir "passos internos" de etapa, com intervalo em horas, mantendo a etapa única. Assim:
- histórico e Biblioteca continuam vendo **E1**, uma etapa só;
- a Ação do Dia mostra cada passo pendente como um card (ligação 1, ligação 2, mensagem), todos rotulados como E1;
- a conclusão de um passo libera o seguinte.

## 6. Regra sábado → segunda / domingo → terça

Hoje **não é assim**: sábado tem janela (09:00–12:00) e domingo empurra para segunda. A regra que você quer é compatível e concentrada em um único ponto do calendário, mas exige duas mudanças: contar em dias corridos e aplicar o deslocamento por dia da semana.

Sobre a dúvida da Parte 6: sim — se a etapa teórica caía no sábado, foi deslocada para segunda e o executivo concluiu na segunda, a etapa seguinte conta **a partir da segunda** (execução real). Isso já é o comportamento do motor hoje.

## 7. Atraso

Já garantido. A referência é sempre a última execução real, nunca a data teórica. Uma etapa concluída com atraso empurra toda a sequência para frente; o motor não compensa nem empilha duas etapas no mesmo dia. Nada se perde: enquanto não concluída, a obrigação continua pendente e aparece como atrasada.

## 8. R

Existe como fluxo de reengajamento com R1 → R2 → R3 apenas. **R4 não existe.**

- Intervalo real: o fluxo de reengajamento ignora o número por etapa e usa um valor único de configuração — **2 dias úteis entre qualquer tentativa**. Ou seja, R1→R2 = 2 e R2→R3 = 2.
- R3 é terminal.
- "Pular R3 quando já recebeu material": NÃO DEFINIDO — não existe essa condição no motor.
- R4 e sua relação temporal com R3: NÃO DEFINIDO.
- "R começa após AGENDAMENTOS → FRIOS": estruturalmente coerente (em AGENDAMENTOS o lead é inelegível), mas o gatilho explícito ainda não existe.

## 9. RE

Existe: RE0 → RE1 → RE2 → RE3, com intervalos configurados em dias úteis:

- RE0: 0 (imediato)
- RE0 → RE1: +2
- RE1 → RE2: +3
- RE2 → RE3: +5 (terminal)

Divergências com sua premissa: você quer RE1 no dia seguinte (hoje +2) e RE2 cerca de dois dias depois (hoje +3). O salto condicional RE1 → RE3 quando a apresentação já foi feita: NÃO DEFINIDO. E o motor **não tem** hoje um sinal estruturado de "apresentação já realizada" para decidir isso. A identificação de reentrada também não é por etiqueta: ela depende do contexto/histórico do lead reconhecido.

## 10. Dias corridos × dias úteis — impacto das três opções

- **A) só E**: menor risco, mas cria dois calendários convivendo no mesmo motor (E em corridos, R/RE/RF em úteis) — confuso de manter e de explicar.
- **B) E + R**: intermediária; R hoje usa um valor global de reengajamento, então mudar R também exige tirar esse atalho. RF continua em úteis.
- **C) E + R + RE**: uma única regra de calendário para tudo. É tecnicamente a mais simples, porque o deslocamento vive em um único ponto e todos os fluxos passam por ele; o custo é revisar os números de RE e RF de uma vez.

**Mais coerente com o motor atual: C**, deixando RF de fora só se você quiser mantê-lo congelado — mas nesse caso RF vira a exceção a documentar.

## 11. Feriados

Calendário centralizado: nacionais + estaduais de São Paulo, calculados automaticamente, mais datas extras administradas pela gestão. Feriado não tem janela e não conta como dia útil.

Com a nova regra, o encadeamento resolve naturalmente: sexta + 2 corridos = domingo → terça; se a terça for feriado, o deslocamento continua para o próximo dia com operação (quarta). O caso que você citou (domingo → terça, com segunda feriado) não muda o resultado, porque o alvo já é terça; se a **terça** fosse o feriado, iria para quarta.

## 12. Ação do Dia

Confirmado e já é assim: o motor calcula etapa, data e cria a obrigação; a Ação do Dia lê, normaliza, deduplica, prioriza e apresenta. Ela não recalcula cadência nem inventa etapa.

## 13. Segunda-feira

Funciona naturalmente e em qualquer volume: o deslocamento é por data, não por cota. Com 100 ações teóricas no sábado, 100 no domingo e 100 na segunda, o resultado é 200 na segunda e 200 na terça — sem nenhuma regra artificial de limite diário.

## 14. Lacunas

1. Etapas E2, E5, E6, E7, E8 não existem no motor.
2. Não há bifurcação por apresentação/material, nem memória estruturada disso.
3. Não há subações dentro de etapa, nem intervalo em horas, nem transbordo de janela.
4. Contagem é em dias úteis; sábado tem janela; domingo cai em segunda.
5. Não há separação entre data teórica e data operacional — só o vencimento final é guardado.
6. Janelas divergentes convivem (mensagens, E0, execução manual) e nenhuma bate com 09:00–17:30 / sábado 08:00–16:00.
7. R4 e o salto de R3 não existem; R usa intervalo global.
8. RE não tem o salto RE1 → RE3 nem sinal de apresentação realizada.
9. Há duas cadências paralelas: mensagens e a fila de ligações L1–L4.

## 15. Menor construção necessária (depois)

1. **Calendário**: contar em dias corridos e aplicar, num único ponto, sábado → segunda, domingo → terça, feriado → próximo dia com operação. Guardar na fila as duas datas: teórica e operacional.
2. **Janelas**: unificar em uma configuração só, com os horários definitivos (09:00–17:30; sábado 08:00–16:00 quando houver operação; domingo fechado).
3. **Fluxo E**: nova versão do fluxo com E0→E1→E2→E3→E4→E7→E8 e ramo E4→E5→E6→E7→E8, com os intervalos que você definir. Ciclos em andamento continuam na versão antiga.
4. **Memória do ciclo**: registrar de forma estruturada "material solicitado/enviado" para decidir o ramo e o contexto de E7/E8.
5. **Passos internos**: E1 com ligação → +3h → ligação → mensagem, com transbordo para a próxima abertura quando a janela fechar (16:00 + 3h → próximo período; 14:00 + 3h → 17:00 no mesmo dia, permitido).
6. **R e RE**: registrar R4, a condição de pular R3, e os intervalos revisados de RE, substituindo o valor global de reengajamento por intervalos por etapa.
7. **Sem mexer**: Biblioteca, Ação do Dia como leitora, agendamento (data real, nunca deslocada), Safety Lock, GreenSales, usuários e permissões.

## Decisões suas que faltam antes de construir

- Os intervalos numéricos de cada etapa E (E0→E1, E1→E2, E2→E3, E3→E4, E4→E7, E7→E8 e do ramo E5/E6).
- Escopo da mudança de calendário: A, B ou C (recomendação: C).
- Intervalos definitivos de R4 e a relação R3 ↔ R4, e os novos intervalos de RE.
- O que caracteriza objetivamente "pediu/recebeu material".
