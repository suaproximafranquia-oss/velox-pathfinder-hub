# Diagnóstico — Ambiente V (V0/V1/V2/V3), Agendamento e retorno para R

Somente análise. Nada foi alterado: nenhum código, migration, tabela, fila, cadência, mensagem ou Biblioteca.

## 1. O QUE JÁ EXISTE PARA ENGAJAMENTO

- Registro por investidor identificado (token assinado do Portal), nunca anônimo.
- Agregado no servidor, por investidor: número de sessões, retornos, tempo ativo acumulado, primeiro acesso a cada módulo, último acesso a cada módulo, primeiro e último acesso geral.
- Linha do tempo bruta: cada abertura de módulo e cada avanço de conteúdo é gravada com data/hora, módulo e percentual quando existe.
- Regras já embutidas: sessão nova só após 4 horas sem atividade; intervalo maior que 5 minutos entre sinais não vira tempo ativo (aba aberta e parada não conta).
- Classificação comercial pronta (sessões, retornos, tempo, amplitude, recência) usada na ficha do investidor.

## 2. COMO V0 PODERIA SER ALIMENTADO

Sem inventar mecanismo novo: V0 nasce do cruzamento de dois registros que já existem.

- Marco formal de disponibilização do material: já existe como fato estruturado, com data/hora, no histórico de relacionamento do lead (registro de "material disponibilizado"). É esse marco, e não a conversa, que autoriza a leitura.
- Atividade do investidor no material: já existe na linha do tempo do Portal, com data/hora e módulo.

Cruzar por investidor e comparar data/hora é possível hoje, e o servidor consegue fazer essa leitura inteiramente (os dois lados já são server-side). Filtrar apenas atividade posterior à disponibilização também é possível, porque a linha do tempo guarda cada evento com hora.

## 3. O QUE SIGNIFICA VISUALIZAÇÃO REAL

O que falta não é regra, é medida.

- O que já dá para afirmar com os dados atuais: se o investidor abriu o material depois do envio formal, quantas vezes voltou, em quantas sessões distintas e até onde avançou no conteúdo.
- O que ainda não dá para afirmar com precisão: quanto tempo efetivo ele passou dentro do material depois daquela data. O tempo ativo hoje é um total acumulado do investidor no Portal inteiro, não um tempo por módulo e por período.

Por isso, qualquer limite numérico (minutos, percentual) definido agora seria arbitrário. A ordem correta é: primeiro passar a medir tempo efetivo por módulo e por período, depois calibrar o limite com dados reais.

## 4. COMO V1/V2/V3 SE ENCAIXARIAM

O motor já sabe escolher texto diferente para a mesma etapa conforme o contexto do lead — é exatamente assim que hoje ele decide entre "sem contato" e "material enviado", e cada contexto já tem versão com nome e sem nome. V1/V2/V3 não seriam etapas novas: seriam E1/E2/E3 lidas em um terceiro contexto ("visualizou o material").

Consequências diretas:
- a identidade operacional continua E1/E2/E3 (fila, prazos, ordem, atrasos, tudo igual);
- não nasce segunda fila nem segunda cadência: muda apenas de qual gaveta da Biblioteca o texto é lido;
- não reiniciar V está garantido pela própria régua: ela nunca volta etapa; se a visualização for confirmada depois da E1, a próxima etapa aplicável (E2) é que passa a ser lida no contexto V.

Menor alteração necessária: (a) medir tempo efetivo por módulo no servidor; (b) gravar um marco de visualização confirmada como fato estruturado, no mesmo formato do marco de material disponibilizado; (c) admitir um terceiro valor de contexto e permitir que E1/E2/E3 aceitem contexto; (d) a Gestão cadastrar os textos nesse contexto.

## 5. COMO V SE RELACIONA COM AGENDAMENTO

Nada precisa ser criado. O agendamento hoje é um fato independente da etapa: quando surge, ele congela a régua e assume prioridade máxima na Ação do Dia. Como V1/V2/V3 continuam sendo E1/E2/E3, o comportamento seria idêntico ao de hoje, sem fila nem regra paralela.

## 6. O QUE ACONTECE SE O AGENDAMENTO NÃO EVOLUIR

Já implementado:
- o compromisso fica registrado e pendente;
- vencido o horário sem contato, entra na Ação do Dia a "Verificação 24h", com prioridade máxima e marcação de atraso;
- o executivo registra o desfecho e decide entre encerrar o fluxo ou retomar o relacionamento;
- o registro do agendamento e todo o histórico permanecem.

Se o agendamento evolui, o fluxo é encerrado pela regra atual e o lead não recebe mais etapas da régua — nem E, nem V, nem R.

## 7. COMO O LEAD ENTRA NO R

Pela transição estruturada de estágio "Agendamentos → Frios", feita pelo executivo na origem. Essa transição, uma única vez, abre a instância de reengajamento, cancela o que restou do ciclo anterior e deixa a régua programar R1 → R2 → R3 → R4. Nenhuma mensagem é enviada nesse momento.

## 8. COMO O SISTEMA DISTINGUE OS DOIS CONTEXTOS DE R3

Hoje ele distingue apenas material recebido x não recebido: quando existe o marco de material disponibilizado, R2 pula direto para R4 — a regra do item 12 do pedido já está implementada e não precisa mudar.

O que ainda não existe é a distinção entre "não chegou à E4" e "já passou pela E4". A informação existe no banco — cada etapa executada fica gravada na fila do lead com identificação da etapa e data —, mas hoje o motor não a consulta para escolher texto de R3, e o histórico de etapas guardado dentro da instância é reiniciado quando a instância de reengajamento é aberta. Ou seja: a informação está preservada no histórico do lead, mas precisa ser lida de lá, e não do contador da instância nova.

Com isso, os três desfechos pedidos ficam decidíveis apenas com registros existentes:
- material efetivamente disponibilizado → pula R3 (já funciona);
- sem material e sem E4 executada → R3 como primeira oferta;
- sem material e com E4 executada → R3 como reoferta.

E a regra de ouro do item 10 fica respeitada: visualização do material não conta como "chegou à E4"; são fatos gravados separadamente.

## 9. COMO O HISTÓRICO DE E4/E5/E6 É PRESERVADO

- Etapas executadas ficam gravadas na fila do lead, com etapa, situação e data; nada é apagado, inclusive na troca de ambiente (o que sobra é cancelado, não removido).
- Os marcos de material (pedido e disponibilizado) são eventos permanentes do lead, não da instância.
- Risco real e único: ler o histórico do contador da instância nova (que nasce vazio) em vez do histórico do lead. É uma decisão de leitura, não uma perda de dado.

## 10. O QUE JÁ EXISTE E O QUE PRECISA SER CRIADO

Já existe: engajamento server-side com regra de atividade real; linha do tempo com data/hora e módulo; marco formal de material disponibilizado; seleção de texto por contexto com variantes com nome e sem nome; fila única com prazos e atrasos; agendamento com prioridade, verificação 24h e desfecho humano; entrada em R por transição de estágio; pulo de R3 quando houve material.

Precisa ser criado: medição de tempo efetivo por módulo e por período; marco estruturado de visualização confirmada; terceiro contexto de etapa aceito por E1/E2/E3; segundo eixo de contexto para R3 (chegou ou não à E4) lido do histórico do lead; e os textos correspondentes cadastrados pela Gestão.

## 11. MENOR ARQUITETURA POSSÍVEL

Quatro peças, todas aditivas, nenhuma paralela:
1. tempo efetivo por módulo no engajamento já existente (mesma regra de atividade real, sem segunda fórmula);
2. um marco de visualização confirmada gravado como fato, igual ao marco de material;
3. contexto de etapa com um valor a mais, e E1/E2/E3 passando a consultar contexto;
4. contexto de R3 resolvido pelo histórico do lead.

Sem tabela nova de fila, sem cadência nova, sem segundo motor de engajamento, sem etapa nova visível.

## 12. RISCOS OU CONFLITOS ENCONTRADOS

- Definir o limite de "consumo suficiente" antes de medir tempo por módulo produziria número arbitrário e alarmes falsos.
- Ler "chegou à E4" do contador da instância nova daria resposta errada em todo lead que veio de agendamento.
- Sem texto cadastrado no novo contexto, o motor por regra atual não envia nada e a etapa fica pendente — o cadastro precisa vir antes de ligar a chave.
- Visualização e oferta são fatos distintos; tratá-los como um só quebraria a escolha de R3.
- A leitura de V0 precisa considerar somente atividade posterior ao envio formal; ignorar isso transformaria acesso antigo ao Portal em visualização confirmada.

## 13. CONCLUSÃO

O conceito V se encaixa na arquitetura atual como uma leitura diferente da mesma régua, não como um caminho paralelo. O que falta é medição de tempo dentro do material, um marco de visualização confirmada e um eixo de contexto a mais — tudo aditivo.

"É possível implementar o Ambiente V reutilizando o Engajamento atual, sem criar segunda fila, segunda cadência ou novo mecanismo de Engajamento?"

SIM. O engajamento já é server-side, identificado, com regra própria de atividade real; a fila e a régua já tratam E1/E2/E3 com contexto e variantes de texto; o agendamento e a entrada em R já são independentes da etapa. A única lacuna é de medição e de vocabulário de contexto, não de mecanismo.
