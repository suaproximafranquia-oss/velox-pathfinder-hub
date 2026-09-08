# Arquitetura — Follow-up do GreenSales e Motor de Datas da Cadência

Somente leitura. Nada foi alterado: nem código, nem banco, nem cadência, nem mensagens, nem Ação do Dia.

---

# PARTE A — Follow-up do GreenSales como origem do agendamento

## A1. O que já existe e pode ser reutilizado

- **Compromisso interno**: `portal_meetings` já guarda lead, data/hora, duração, executivo responsável, situação, motivo de cancelamento, observações, tópico e um campo de origem (hoje só "portal" ou "executivo").
- **Colunas reais do funil**: NOVOS, ZERO CONTATO, FRIOS, AGENDAMENTOS, OPORTUNIDADES, VÍDEO, 4COF/CONTRATO, PAGAMENTO, REMARKETING, VENCEMOS, FINALIZADO, NÃO LOCALIZADOS. A coluna vigente fica em `crm_leads.stage_key`, espelhada do GreenSales.
- **Bloqueio da cadência**: o motor já tem o estado "agendado", que bloqueia integralmente qualquer etapa automática.
- **Elegibilidade do relacionamento**: a fila de cadência só considera ZERO CONTATO e FRIOS. Lead em AGENDAMENTOS já é inelegível por construção.
- **Ação do Dia**: já lê `portal_meetings`, trata reunião como prioridade máxima, entra em foco poucos minutos antes do horário, com card padrão (nome, telefone, Ver ficha).
- **Desfecho e histórico**: já existem compareceu / não compareceu / reagendada, gravados em livro append-only e no histórico do lead.
- **Responsável**: `portal_leads.responsible_executive_id`, atribuído no Portal e congelado depois de definido.

## A2. O que falta

1. Ler o `follow_up` na sincronização (hoje nenhum código lê; ele só existe na cópia bruta do lead).
2. Identidade externa no compromisso (origem + id do lead na origem).
3. Regra de espelho: data não editável no Portal.
4. Desfecho "sem contato e sem reagendamento", que não encerra o compromisso.
5. Obrigação persistente de verificação em 24 horas.
6. Liberação do R somente na transição AGENDAMENTOS → FRIOS percebida pela sincronização.

## A3. follow_up + reunião manual

Hoje as duas coexistiriam como ações separadas: a deduplicação só ocorre quando o horário é idêntico. Menor regra, sem tabela nova: um único compromisso ativo de origem GreenSales por lead, com precedência sobre reunião manual do mesmo lead no mesmo período (fusão ou bloqueio na criação).

## A4. follow_up apagado

A sincronização hoje não percebe nada, porque não lê o campo. Lendo-o, a comparação valor-atual × valor-espelhado cobre tudo: existe → ativo; mudou → mesmo compromisso reagendado com evento no histórico; sumiu → compromisso cancelado com motivo "removido na origem". Nunca se cria reunião nova.

## A5. follow_up sem estado AGENDAMENTO

Compatível. A condição é direta: só vira compromisso quando a coluna for AGENDAMENTOS. Em NOVOS ou FRIOS o follow_up é ignorado, e a cadência segue normal nas colunas elegíveis.

## A6. Identidade do compromisso

Par (origem = "greensales", id do lead na origem). Mudança de horário atualiza o mesmo registro. Cabe em `portal_meetings`; falta apenas o campo de id externo e um valor de origem novo.

## A7. Ligação com T-5 / Ação do Dia

Automática: gravado em `portal_meetings`, o compromisso herda card padrão, prioridade máxima e foco antes do horário. A pergunta de contato já existe como desfecho com nota. A mudança é, no "não", oferecer reagendar na origem (sem gravar horário no Portal) ou marcar vencido sem contato.

## A8. Guardar "vencido sem contato"

Não existe hoje: "não compareceu" encerra a reunião e nada sobra. Solução mínima: situação própria que mantém o compromisso vivo + obrigação de verificação com vencimento em 24 horas, na fila que a Ação do Dia já lê.

## A9. Verificação de 24 horas

Suportada assim que existir a obrigação do A8. "Sim" encerra a cadência (o motor já tem encerramento). "Não" apenas instrui a mover para FRIOS na origem — o Portal não move nada e não inicia R.

## A10. Liberar R apenas após AGENDAMENTOS → FRIOS

Já é estrutural: em AGENDAMENTOS o lead está fora das colunas elegíveis e o estado agendado bloqueia tudo. Falta ligar a transição percebida ao desbloqueio explícito desse estado.

## A11. Responsável quando o vendedor vem vazio

Regra existente: o responsável é o do Portal, congelado após definido; o GreenSales não é fonte disso. O compromisso herda esse responsável. No lead 59193 ele está vazio — o compromisso nasceria sem dono e não apareceria para ninguém. **Decisão necessária**: bloquear a criação sem responsável, ou criar e listar como pendência de atribuição.

## A12. Menor construção (Parte A)

Ler follow_up só em AGENDAMENTOS; identidade externa em `portal_meetings`; espelhamento idempotente (criar/atualizar/cancelar) com evento de reagendamento; precedência sobre reunião manual; desfecho "vencido sem contato" + verificação em 24h; desbloqueio do R pela transição de coluna. Nenhuma tabela nova, nenhuma agenda paralela.

---

# PARTE B — Motor de datas da cadência

## B1. Como o motor calcula datas hoje

Cada etapa tem um número de dias, e a data de vencimento sai de uma função única que soma esses dias a partir de um instante de referência e, em seguida, empurra o resultado para o próximo momento operacional válido. O vencimento fica gravado na fila; a Ação do Dia só lê.

## B2. Onde a regra está configurada

Centralizada em dois arquivos: a configuração das etapas e das janelas (`src/lib/relationship/config.ts`) e o calendário (`src/lib/relationship/calendar.ts`). A decisão de qual etapa e para quando fica em `decide.ts`. Não está espalhada. Existe, porém, um segundo motor menor e independente para a fila de ligações (`src/lib/crm/cadence.ts`, L1–L4), que tem seus próprios intervalos.

## B3. Corridos ou úteis?

**Dias úteis** — em todo o motor de mensagens e também na fila de ligações. O conceito de dias corridos não existe hoje em nenhum prazo de cadência.

## B4. Sábado e domingo hoje

Sábado é dia útil parcial: há janela de envio das 09:00 às 12:00. Domingo não tem janela nenhuma. Feriados também não. Uma etapa que caia em dia sem janela não é perdida nem substituída: é empurrada para a próxima abertura, que é sempre o próximo dia com janela — ou seja, hoje sábado empurra para segunda, e domingo também empurra para segunda. **A regra "domingo → terça" não existe.**

## B5. Atraso

Não há recálculo nem perda. Se o vencimento já passou e o momento atual é operacional, a etapa fica devida agora e aparece como pendente/atrasada. Se o momento atual está fora da janela, ela é empurrada para a próxima abertura, sempre para frente. A Ação do Dia tem, além disso, um cálculo próprio de "atrasado" em dias úteis, apenas para exibição.

## B6. Como calcula a próxima etapa

A partir da **execução real da etapa anterior** (a última saída registrada), não da data teórica original do ciclo. Para o fluxo de acompanhamento há ainda um piso: a contagem só começa depois que o lead sai da coluna NOVOS. Consequência prática: um atraso desloca toda a sequência para frente — não acumula várias etapas no mesmo dia.

## B7. Múltiplas ações dentro de uma etapa

Não existe. Cada etapa é um disparo único. O que existe hoje é uma segunda fila, a de ligações (L1 manual, L2 +2 dias úteis, L3 +1, L4 +3), independente das etapas de mensagem. Não há nenhum conceito de subpasso dentro de uma etapa.

## B8. E1 com duas ligações e intervalo de 3 horas

Não é representável hoje. Os intervalos são em dias úteis, nunca em horas; não há segundo passo dentro da etapa; e não há regra de transbordo do tipo "passou das 17h, a segunda ligação vai para o próximo período". Isso exige passos internos com intervalo em horas e uma regra explícita de transbordo — é a lacuna maior da Parte B.

## B9. Feriados

Existem e são centralizados: nacionais + estaduais de São Paulo, calculados automaticamente, mais datas extras administráveis pela gestão, somadas ao calendário oficial. Feriado não tem janela e não conta como dia útil; a etapa é deslocada para o próximo dia com janela.

## B10. Calendário × janela de execução

Hoje estão **acoplados**: a mesma função calcula o dia e já devolve um instante dentro da janela de envio. Não existe registro separado de "data teórica" e "data operacional" — só o vencimento final. Além disso, convivem janelas diferentes: mensagens 09:00–21:00 (sábado 09:00–12:00), E0 07:00–22:30, e a janela da execução manual da Ação do Dia (06:00–22:00, sábado até 17:00). Os horários que você citou (09:00–17:30 e sábado 08:00–16:00) **não** são os configurados hoje.

## B11. Como a Ação do Dia recebe as obrigações

Exatamente como você quer: ela é agregadora de leitura. Lê reuniões, agenda, fila do motor, fila de ligações e primeiros contatos, normaliza, deduplica e ordena por prioridade. Não decide etapa nem recalcula data. A separação que você pede já está garantida.

## B12. A regra sábado → segunda / domingo → terça é compatível?

Compatível, e é uma alteração pequena — mas **não é o comportamento atual em dois aspectos**: hoje a contagem é em dias úteis (não corridos) e domingo cai em segunda (não em terça). Como o deslocamento acontece num único ponto do calendário, dá para trocar a contagem para dias corridos e aplicar o deslocamento por dia da semana sem transformar nada em "dias úteis". A distribuição que você descreve (A+C na segunda, B+D na terça) sai naturalmente do calendário, sem cota artificial por dia.

## B13. Menor alteração necessária depois (Parte B)

1. Separar, no cálculo, **data teórica** (referência + intervalo em dias corridos) de **data operacional** (deslocamento sábado → segunda, domingo → terça, feriado → próximo dia com janela) e guardar as duas na fila.
2. Trocar a unidade de intervalo das etapas de "dias úteis" para "dias corridos", mantendo a tabela de intervalos configurável por etapa.
3. Ajustar as janelas de execução para os horários que você definir, unificando as janelas divergentes que existem hoje.
4. Introduzir passos internos de etapa com intervalo em horas (caso E1: ligação, +3h, ligação, mensagem) e regra explícita de transbordo quando a janela fechar.
5. Manter intocado: a Ação do Dia como leitora, o cálculo a partir da execução real, o calendário de feriados centralizado, e o agendamento — compromisso de agenda é data real e **nunca** é deslocado pela regra de cadência.

## Pontos que precisam da sua decisão antes de construir

- Confirmar os horários operacionais definitivos (os atuais são outros).
- Confirmar se a mudança para dias corridos vale também para R e RE, ou só para o fluxo E nesta etapa.
- Como tratar o compromisso quando o lead ainda não tem responsável no Portal (Parte A, item 11).
