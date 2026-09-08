# Financeira /f — Planejamento do motor de cadência e da Ação do Dia

Documento de planejamento. Nada foi alterado: nenhum código, banco, migration, etapa, chave, mensagem, rota ou permissão.

## A) Mapa atual encontrado

**Régua que o motor executa hoje:** E0 → E1 → E3 → E4 → E12 (cinco etapas, um único caminho, sem bifurcação). As chaves E2, E5, E6, E7 e E8 não existem como etapas executáveis; existem apenas como títulos editoriais guardados sobre outras chaves técnicas.

**Prazos que existem hoje:** E0 imediato, E1 em 1 dia útil, E3 em 2, E4 em 3, E12 em 5 — todos contados em dias úteis a partir da última mensagem enviada.

**Ação do Dia:** é só um agregador de leitura. Junta reuniões, agenda, itens pendentes da fila, ligações, deveres de encerramento e primeiros contatos pendentes; remove itens pulados e leads arquivados; ordena para exibir. Ela não cria obrigação nem decide etapa.

**Etapas com ações internas:** não existem. Cada etapa é um único disparo. Ligação e mensagem aparecem como itens independentes, sem dependência temporal entre si.

**Pular:** existe uma única modalidade, e ela **exige justificativa** — a ação sem justificativa é recusada no servidor. Ela grava no livro de registro e some da lista.

**Janelas:** hoje convivem duas. A do motor (mensagens): Seg–Sex 09:00–21:00, Sábado 09:00–12:00, com a E0 numa faixa própria 07:00–22:30. A da execução manual na tela: Seg–Sex 06:00–22:00, Sábado 06:00–17:00, domingo fechado. Domingo já não executa em nenhuma das duas.

**Agendamento:** já congela tudo. O estado vira "agendado" e toda etapa automática fica bloqueada até movimentação explícita.

**Biblioteca:** cada etapa tem versões numeradas, com variante COM NOME e SEM NOME no mesmo registro, e apenas uma versão ativa por chave. A Ação do Dia busca a versão ativa no clique do COPIAR e grava um retrato imutável na conclusão.

## B) O que já funciona e pode ser preservado

- A cadeia motor → fila → Ação do Dia → execução → histórico. Nenhuma decisão vive na tela.
- Congelamento no agendamento, com desbloqueio só por ação humana.
- Contagem em dias úteis, feriados nacionais e de São Paulo, mais datas extras administradas pela gestão.
- Reagendamento automático quando a hora cai fora da janela: a etapa não se perde, ela anda para a próxima abertura.
- Versionamento da Biblioteca com COM NOME / SEM NOME e retrato imutável na conclusão.
- Registro de ligações, desfechos de reunião e notas vinculados ao lead.
- Versionamento de fluxo: um ciclo em andamento continua na versão em que nasceu, mesmo que a régua mude depois.

## C) O que precisa ser construído

1. **Régua de nove etapas com dois caminhos.** Hoje a próxima etapa é "a próxima da lista"; precisa passar a considerar o caminho (com ou sem material) e o histórico do ciclo.
2. **Etapa com ações internas.** E0 (ligação → 10 min → ligação → mensagem) e E1 (ligação → 3h → ligação → mensagem) não têm representação hoje. Precisa existir a noção de "passos dentro da etapa", com pré-requisito e intervalo mínimo, sem virar etapa nova.
3. **Ligação sempre antes da mensagem** em E2/E3/E4, e a mensagem cancelada quando a ligação gerou contato humano.
4. **Segunda ligação que não coube na janela** vira pendência prioritária da próxima janela, em vez de se perder.
5. **Memória estruturada do ciclo:** já recebeu material, já foi finalizado, já esteve no R, em que ponto do R parou.
6. **Eventos novos:** pediu/recebeu material, compareceu, não compareceu, retornou depois de finalizado.
7. **Transição do não comparecimento** para o ambiente R, disparada pela movimentação humana AGENDAMENTO → FRIO.
8. **Segundo eixo de contexto** em E7 e E8 (sem contato / material enviado), dentro da mesma chave.
9. **Fila travada** na Ação do Dia: hoje o executivo pode atender qualquer item.
10. **Pular de sábado para lead novo**, sem justificativa e sem nota, separado do pular normal.
11. **Janela de ligação** 09:00–17:30 e janela opcional de sábado 08:00–16:00, com a regra de que sábado não antecipa segunda.

## D) Dependências

- Os prazos de E1→E2, E2→E3, E3→E4, E4→E7, E5, E5→E6, E6→E7, E7→E8 e os do fluxo R ainda precisam da sua decisão. Sem eles a construção não fecha.
- Os textos oficiais das etapas novas e dos dois contextos de E7/E8 precisam existir na Biblioteca antes de qualquer ativação.
- A definição exata de "pediu o material" (respondeu, clicou, ambos) precisa ser fechada, porque é ela que separa os dois caminhos.

## E) Riscos

- **Ciclos em andamento.** Trocar a régua no meio do caminho de um lead ativo mudaria a jornada dele. Mitigação: a régua nova nasce como uma nova versão de fluxo; quem já está andando termina na antiga.
- **Duplicação de obrigação** quando uma etapa passa a ter vários passos internos. Mitigação: cada passo precisa de identidade própria e estável, do mesmo jeito que hoje cada item da fila tem.
- **Duas janelas convivendo** (a do motor e a da tela). Se as regras novas forem escritas numa só, a outra continua valendo e o comportamento fica inconsistente.
- **Fila travada e trabalho real.** Travar demais pode paralisar o executivo quando um lead é impossível de atender. Precisa existir sempre pelo menos uma saída legítima por item.
- **Histórico órfão** se um passo interno for concluído e a etapa for recalculada. Mitigação: o retrato imutável já grava por item da fila; os passos internos precisam entrar no mesmo mecanismo.

## F) Arquitetura mínima proposta

Cinco peças, e nada além disso:

1. **Nova versão de fluxo**, versionada, contendo as nove etapas, os dois caminhos e os prazos que você definir. Não substitui a atual: nasce ao lado.
2. **Plano de passos dentro da etapa.** Cada etapa passa a poder declarar uma lista ordenada de ações (ligação, ligação, mensagem) com intervalo mínimo entre elas e condição de cancelamento (contato humano). O passo é gerado como item de fila com identidade própria, então nunca duplica e nunca se perde.
3. **Memória do ciclo.** Um registro por lead com os fatos que decidem caminho: recebeu material, foi finalizado, esteve no R e até onde foi. Lido do que já foi executado, nunca do texto da mensagem.
4. **Eixo de contexto na Biblioteca.** A versão publicada passa a declarar o contexto ao qual pertence, além das duas variantes de nome que já existem. Nenhuma chave nova, nenhuma renomeação.
5. **Prioridade e trava calculadas no servidor**, como parte da montagem da fila, e apenas refletidas na tela.

Modelo de prazo recomendado, para não virar calendário rígido: cada obrigação carrega **data-alvo**, **janela em que pode ser executada** e **tolerância**. Passada a tolerância ela não some — vira pendência, e a pendência ganha prioridade sobre o previsto para o dia. Assim o começo pode ser intenso e o fim espaçado sem que nada seja perdido por causa de fim de semana ou feriado.

## G) Respostas às perguntas

**Etapas com ações internas (item 2):** não, a arquitetura atual não representa isso. Cada etapa é um disparo único. É a alteração estrutural mais relevante de toda a lista.

**Duas modalidades de Pular (item 3):** não. Existe uma só, e a justificativa é obrigatória no servidor. Separar as duas exige um tipo novo de postergação que não escreve justificativa nem nota — e que preserva a ordem de entrada do lead.

**Travar a fila (item 4):** não. A tela entrega a lista inteira e qualquer item é acionável. A trava tem que nascer no servidor, no mesmo ponto que monta a lista: ele calcula qual é o item liberado e marca os demais como bloqueados. A tela apenas obedece.

**Onde calcular a prioridade (item 5):** no servidor, na montagem da fila. O motor decide *o que* existe; o servidor decide *em que ordem* aparece; a tela não decide nada. A ordem que você definiu (agendamentos → leads novos por ordem de entrada → atrasados → previstos) precisa ser explícita ali, não herdada da ordem em que os registros são lidos.

**Representar prazos (item 6):** data-alvo + janela + tolerância + pendência + prioridade, como descrito acima. É a estrutura que permite começo intenso e fim espaçado sem datas cegas.

**Congelar no agendamento (item 7):** sim, já funciona exatamente assim hoje, inclusive com retomada só por ação humana. Nenhuma construção necessária.

**Identificar se já recebeu material (item 8):** parcialmente. O ciclo já registra as etapas executadas, então "executou E5" seria uma leitura confiável — mas como E5 não existe hoje como etapa, esse fato ainda não é gravado em lugar nenhum. Com a régua nova, passa a ser confiável.

**R sem depender do tempo desde o cadastro (item 9):** sim, é viável, e é justamente o papel da memória do ciclo. O R passa a olhar o que aconteceu, não há quanto tempo aconteceu.

**Contexto em E7/E8 (item 10):** sim, cabe no versionamento atual sem criar etapa. A alteração mínima é o registro da versão passar a declarar a qual contexto pertence, e a busca da mensagem passar a considerar dois eixos em vez de um. As variantes COM NOME / SEM NOME continuam exatamente como estão.

**Central dos Nomes (item 11):** sim, fica intocada. Ela continua decidindo apenas se o primeiro nome é confiável; o contexto entra como camada adicional, sem interferir nessa decisão.

**Biblioteca — estado por etapa (item 12):** todas as etapas listadas têm conteúdo histórico preservado, com COM NOME e SEM NOME, e todas têm versão ativa. O problema é só de associação: a etapa que você chama de E4 está guardada na chave `E2`, a E5 na chave `RE0`, a E6 na `E20`, a E7 na `E27`, a E8 na `RE1`, o R1 na `E3`, o R2 na `E4`, o R3 na `E5`, o R4 na `RE2`, o RE0 na `E6`, o RE1 na `E7`, o RE2 na `FINALIZACAO`, o RE3 na `R1`, o RF0 na `R2` e o RF1 na `R3`. Tudo pode ser reassociado sem apagar nem criar conteúdo. As etapas E2 e E3 do seu desenho estão nas chaves `E3` e `E12`. Nada falta.

**RE (item 13):** os quatro textos existem e estão ativos, guardados nas chaves deslocadas acima. Estrutura de fluxo RE0→RE1→RE2→RE3 já existe no motor com prazos próprios.

**RF (item 14):** os dois textos existem. O fluxo RF0→RF1 já existe no motor. Nada a construir agora.

**Duplicação, perda ou órfão (item 15):** o risco concreto está nos passos internos da etapa e no pular de sábado. Se um passo interno não tiver identidade própria e estável, ele pode ser recriado a cada recálculo. Se o pular de sábado não for um tipo distinto, ele vai cair no caminho que exige justificativa e vai gerar nota indevida. Fora isso, o vínculo com o lead já é sólido em todos os registros existentes.

### As 15 finais, objetivamente

1. **Já suportam:** congelamento no agendamento, dias úteis e feriados, reagendamento por janela, versionamento de fluxo, versionamento da Biblioteca com as duas variantes de nome, retrato imutável na conclusão, registro por lead.
2. **Precisam mudar:** definição do fluxo, decisão da próxima etapa, passos internos da etapa, memória do ciclo, eventos de material e de comparecimento, montagem e ordenação da fila, trava da fila, modalidade de pular, janela de ligação e regra de sábado.
3. **Menor alteração estrutural:** as cinco peças da seção F.
4. **Dá para fazer sem migration?** Não. A memória do ciclo, os passos internos da fila e o eixo de contexto da Biblioteca precisam de espaço novo no banco.
5. **Dado a migrar:** nenhum. Nada precisa ser convertido nem apagado. Os ciclos atuais continuam na régua atual e os registros históricos ficam como estão.
6. **Evitar duplicação com passos internos:** cada passo recebe identidade própria e estável, derivada do ciclo, da etapa e da ordem do passo. Repetir o cálculo reencontra o mesmo item em vez de criar outro.
7. **Obrigação criada duas vezes:** mesma resposta — identidade estável mais a regra que já existe hoje, de recusar etapa repetida ou fora de ordem.
8. **Não continuar no E depois do agendamento:** já garantido pelo bloqueio atual. Basta não abrir exceção na régua nova.
9. **R só após AGENDAMENTO → FRIO:** o R passa a nascer de um evento explícito de não comparecimento, nunca de silêncio nem de tempo decorrido.
10. **Pular R3 quando E5 já aconteceu:** consultando a memória do ciclo no momento de escolher a próxima etapa do R.
11. **Contexto certo em E7/E8:** a etapa executada E5 presente no histórico do ciclo define material enviado; ausente, define sem contato. Nunca pelo texto.
12. **Sábado não antecipar segunda:** o sábado passa a filtrar por natureza do item — atrasados, próprios do sábado, agendamentos e leads novos disponíveis — em vez de mostrar tudo o que já venceu ou vence.
13. **Domingo nunca executar:** já é assim nas duas janelas; a regra nova só precisa manter isso e não criar exceção.
14. **Trava da fila:** calculada no servidor, junto da prioridade; a tela recebe qual item está liberado e bloqueia os demais.
15. **Autoridade de cada regra:** a configuração do motor define quais etapas existem, em que ordem e com que prazo. O motor decide o que acontece com cada lead. O servidor decide o que aparece e em que ordem. A Biblioteca decide o texto. A tela não decide nada.

## Recomendação

É uma **mudança estrutural**, em uma construção única e versionada, e ela só deve começar depois que você fechar: os prazos de cada etapa, a definição de "pediu o material" e os textos oficiais das etapas e contextos novos.

## Arquivos e configurações que a construção envolveria

- `src/lib/relationship/config.ts` — etapas, sequência, prazos, janela de ligação
- `src/lib/relationship/decide.ts` — bifurcação e escolha da próxima etapa
- `src/lib/relationship/machine.ts` e `types.ts` — eventos novos e memória do ciclo
- `src/lib/relationship/flow-plan.ts` e `src/server/relationship/flow-versions.server.ts` — versão nova do fluxo
- `src/server/relationship/scheduler.server.ts` e `closure.server.ts` — criação dos passos e encerramento
- `src/server/crm/daily-actions.server.ts` — prioridade, trava da fila e regra de sábado
- `src/server/crm/daily-actions-log.server.ts` — modalidade de pular sem justificativa
- `src/lib/crm/daily-actions-window.ts` — janela de ligação e sábado opcional
- `src/server/relationship/message-library.server.ts` e `step-message.server.ts` — eixo de contexto
- Uma migration única para: memória do ciclo, passos internos da fila e contexto da Biblioteca
