# Última rodada arquitetural — Financeira /f (somente leitura)

Nada foi alterado, executado, criado ou enviado. Onde o código atual não permite concluir, está escrito "não determinável no estado atual".

## 1. Contato humano real

- 1.1 Evidências que hoje existem no sistema: primeiro contato enviado; mensagem enviada pelo motor; mensagem enviada manualmente pelo executivo; mensagem recebida do investidor; entrega e leitura da mensagem; conteúdo enviado; ligação registrada como concluída com desfecho atendeu/não atendeu; reunião com desfecho resolvido; agendamento criado; observação escrita; confirmação de nome; interrupção/retomada manual. Só as duas primeiras famílias e a ligação concluída representam tentativa real de alcançar a pessoa.
- 1.2 Sim, vários parecem contato e não deveriam bloquear reentrada: abertura do card, entrega/leitura técnica da mensagem, observação escrita, criação de agendamento sem conversa, confirmação de nome, mudança de coluna. Nenhum deles prova que a pessoa foi abordada pelo novo responsável.
- 1.3 Não. Envio bloqueado pela trava não alcança ninguém. Hoje o registro fica com resultado de bloqueio, distinguível do envio real — deve ser tratado como "não houve contato".
- 1.4 Não. Copiar mensagem não é envio. Hoje, porém, a confirmação "SIM" na Ação do Dia grava exatamente o mesmo evento de mensagem enviada — ou seja, o sistema confia na declaração humana. Essa declaração é o único sinal disponível e deve continuar sendo aceita como contato.
- 1.5 Não como contato consumado; sim como tentativa. Deve contar para a sequência de tentativas, não para bloquear reentrada em primeira aproximação.
- 1.6 Sim. Ligação atendida é o contato humano mais forte que o sistema registra.
- 1.7 Não. Observação é registro interno.
- 1.8 Não deveria; mas hoje a criação de agenda cancela pendências da fila, ou seja, o motor já a trata como interrupção. É um ponto de divergência entre "interrompe a cadência" e "houve contato".
- 1.9 Definição técnica recomendada, sem subjetividade: **existe pelo menos um destes registros para o investidor — mensagem efetivamente enviada (automática ou declarada manualmente, com resultado diferente de bloqueado/falha), mensagem recebida do investidor, ou ligação concluída com desfecho atendeu.** Tudo o mais é atividade interna.

## 2. Limite da redistribuição

- 2.1 Sim. Sem essa trava, alternância entre dois executivos gera primeira aproximação infinita.
- 2.2 Não. Hoje o card guarda apenas o responsável atual e nunca é reatribuído; não existe registro de titularidade anterior. Nenhuma das quatro situações é distinguível — não determinável no estado atual.
- 2.3 Não existe nenhum conceito de ciclo de redistribuição.
- 2.4 Estrutura mínima: um registro de titularidade por lead (executivo anterior, executivo novo, data, origem da mudança) e um contador/identificador de ciclo no próprio card. Isso basta para bloquear repetição e para carimbar a primeira aproximação, sem qualquer estrutura de recuperação.
- 2.5 Confirmado explicitamente: a futura Retomada (ER) é assunto separado e não deve ser antecipada por esta correção.

## 3. Identidade canônica

- 3.1 Prioridade recomendada: telefone normalizado como chave forte; e-mail como chave forte secundária; nome apenas como desempate/confirmação, nunca sozinho. Origem não deve entrar na chave (senão a mesma pessoa vinda de dois canais nunca se une).
- 3.2 Não. Telefone pode faltar, vir malformado ou ser compartilhado. É suficiente como chave primária de tentativa, não como garantia.
- 3.3 Não unir automaticamente quando nomes divergem claramente: criar identidades distintas e marcar como conflito para revisão humana. Nunca fundir sozinho.
- 3.4 É justamente para isso que serve a tabela de identificadores: a identidade recebe um segundo telefone; o antigo permanece vinculado ao histórico.
- 3.5 Criar identidade sem identificador de telefone, apoiada em e-mail ou apenas local ao card. Nunca bloquear a entrada por falta de telefone.
- 3.6 Normalizar ambos para o mesmo formato e tratar como o mesmo identificador, distinguindo apenas o canal de envio. Hoje já existe normalização de WhatsApp.
- 3.7 Sim. Resolver (ou criar) a identidade antes do card evita órfãos e é o único jeito de a trava de primeira aproximação funcionar por pessoa.
- 3.8 Sim. O card continua sendo a unidade operacional da fila; a identidade é a camada de agrupamento.
- 3.9/3.10 Recomendado: **apenas vincular, com um card marcado como principal.** Consolidar ou desativar cards apaga história operacional e quebra as filas que referenciam o card antigo. Vincular é reversível; fundir não é.

## 4. Primeira aproximação duplicada

- 4.1 Sim, mas como trava de segundo nível: a trava por card continua, e a identidade evita segunda abordagem à mesma pessoa dentro do mesmo ciclo.
- 4.2 Mantendo o responsável e o ciclo na chave — a redistribuição abre um novo ciclo e, por isso, libera legitimamente nova primeira aproximação.
- 4.3/4.4 Melhor representação: **investidor + responsável + ciclo operacional.** "Card + responsável" não impede duplicação entre dois cards da mesma pessoa; "investidor + ciclo" impede a redistribuição legítima.
- 4.5 Sim, esse é o risco real: usar só investidor bloquearia uma abordagem legítima de novo responsável, e uma reconciliação errada (telefone compartilhado) bloquearia uma pessoa diferente. Por isso a fusão automática deve ser conservadora.

## 5. Marco operacional

- 5.1 O marco deve qualificar o **ciclo**: ciclos nascidos antes da data são históricos; ciclos nascidos depois são operacionais. Isso é mais estável do que olhar a data de criação do lead.
- 5.2 Deve continuar histórica. Um evento novo não deve ressuscitar dívida antiga — exceto se abrir explicitamente um novo ciclo.
- 5.3 Sim. Redistribuição depois do marco é entrada operacional nova.
- 5.4 Sim, exatamente: o ciclo é novo, mesmo que a pessoa seja antiga.
- 5.5 Sim. Primeira aproximação criada manualmente hoje é sempre pós-marco.
- 5.6 Hoje é único para todo o ambiente (uma configuração global). Um marco por executivo é possível no futuro, mas cria auditoria confusa; recomendação é manter único por ambiente.
- 5.7 Sim, o Admin deve poder ler e alterar, com registro de quem alterou — hoje é um valor de configuração sem histórico de alteração.
- 5.8 Risco: qualquer lead pós-marco que dependa de cadência aberta antes da data ficaria sem sequência; e mudar a data retroativamente altera a leitura de todo o passado, porque nada está carimbado no ciclo. Enquanto o marco for só uma data global comparada em tempo de leitura, ele é frágil.
- 5.9 Melhor opção: carimbar no ciclo, no momento da criação, algo equivalente a `operational_since` (data/hora de nascimento operacional) mais um sinalizador histórico. Nome de época (`cadence_epoch`) só se houver mais de um marco no futuro; hoje é desnecessário.

## 6. Ação do Dia — o que é "planejado"

- 6.1 Sim. A fila em tempo real é o comportamento correto para o executivo.
- 6.2 Sim — snapshot **apenas para auditoria administrativa**, sem influenciar a operação.
- 6.3 Todos os campos listados são adequados; acrescentar a chave da ação (para casar com execução/pulo) e o ambiente.
- 6.4 O snapshot deve representar o início do dia, e ser complementado por acréscimos do dia (uma linha por ação com o horário em que ela apareceu). Só o início do dia esconderia trabalho legítimo.
- 6.5 O dia operacional deve começar no início da janela de envio (a operação já usa 09:00, com fechamento às 22:00) no fuso de São Paulo.
- 6.6 Sim, marcada como surgida às 14h.
- 6.7 Sim — planejada e executada, com os dois horários. Caso contrário o relatório subnotifica produção.

## 7. Semântica de Pular

- 7.1 Resposta: **E — depende do tipo**, com regra fixa por tipo (não à escolha do executivo).
- 7.2 Comportamento recomendado por tipo:
  - Primeira aproximação: nunca some; volta no próximo dia útil (é obrigação de entrada).
  - Mensagem de etapa: sai do dia e volta no próximo dia útil, sem avançar a etapa.
  - Ligação: sai do dia e conta como tentativa não realizada; a tentativa continua devida.
  - Reunião: não pode ser pulada — só reagendada, cancelada ou resolvida.
  - Compromisso de agenda: pode ser pulado e desaparecer do dia, pois é item pessoal.
  Hoje, na prática, tudo é tratado igual: o pulo suprime o item **apenas naquele dia**, por chave de ação e data.
- 7.3 Hoje significa "não executei hoje": não existe registro de tentativa perdida. Semanticamente deveria ser "não executado por decisão, com justificativa".
- 7.4 Sim, os cinco são situações distintas e hoje só três existem: pulou (Ação do Dia), cancelou (fila) e reagendou (reunião). "Não executou" e "não conseguiu executar" não existem — não determinável no estado atual.
- 7.5 Sim. Sem esses estados, transições condicionais futuras (ex.: três recusas seguidas ⇒ mudar de fluxo) não têm base.

## 8. Ligação como canal

- 8.1 Não. Ligação não deve virar etapa da mesma numeração E/R/RE/RF — isso obrigaria renumerar toda a Biblioteca.
- 8.2 Correto: **canal associado a uma etapa**, exatamente como no exemplo E3 → canal ligação e/ou mensagem.
- 8.3 Dependência recomendada: a ligação é a primeira tentativa da etapa; a mensagem é o complemento da mesma etapa.
- 8.4 Sim: ligação não atendida libera a mensagem da etapa.
- 8.5 Não cancelada automaticamente — depende do desfecho. Ligação atendida com conversa produtiva deve dispensar a mensagem daquela etapa; ligação atendida sem avanço não deveria.
- 8.6 Sim. Reunião marcada é interrupção: as ações posteriores devem ser recalculadas a partir dela (o motor já cancela pendências quando surge agendamento).
- 8.7 Sim, obrigatoriamente. Hoje o desfecho da ligação é apenas SIM/NÃO em uma fila separada e o motor de mensagens nunca o recebe.
- 8.8 Fonte de verdade do próximo passo deve ser **o motor de relacionamento**, alimentado pelos resultados de todos os canais.

## 9. Biblioteca

- 9.1 Confirmado: há garantia técnica de uma única versão ativa por etapa.
- 9.2 Regra recomendada: **uma ativa por combinação etapa + variante de nome + assinatura**; duas mensagens livres para a mesma etapa devem ser proibidas.
- 9.3 Sim, é exatamente a recomendação — e é o que o modelo atual já suporta.
- 9.4 Sim. O conteúdo (link e rótulo) deve permanecer dentro da própria mensagem, como está hoje.
- 9.5 Confirmado: vídeo, link, texto, orientação e assinatura são atributos da mensagem, não entidades operacionais separadas. O sistema antigo de conteúdos já foi removido; resta apenas o agrupamento por finalidade dentro da configuração do motor.

## 10. Central de Nomes

- 10.1 Sim. Ela decide o tratamento usado nas mensagens.
- 10.2 Não deve alterar cadastro. Hoje ela não altera — trabalha sobre o nome recebido.
- 10.3 Sim. A rejeição manual já é persistente e deve continuar.
- 10.4 Deve alterar somente o tratamento; o nome cadastral pertence à origem/investidor.
- 10.5 Precedência recomendada: nome confirmado pelo próprio investidor > correção do executivo > detecção automática > nome bruto da origem.

## 11. Reuniões

- 11.1 Reagendar deve criar nova ocorrência ligada à anterior. Hoje sobrescreve.
- 11.2 Sim, o compromisso original deve permanecer visível.
- 11.3 Comparecimento deve ser **resultado**, não estado — o estado é agendada/cancelada/concluída.
- 11.4 Sim, são situações diferentes e hoje ambas caem no mesmo desfecho de cancelamento.
- 11.5 Sim; hoje há apenas quem atualizou por último, sem histórico de alterações.
- 11.6 Sim; hoje não há qualquer vínculo com a etapa que gerou a reunião.
- 11.7 O **motor**, a partir do resultado da reunião. Executivo e regra configurada influenciam por meio do resultado registrado, não decidindo diretamente.

## 12. Notas e histórico

- 12.1 Sim: a nota do executivo deve ser apenas um evento na linha do tempo.
- 12.2 Sim, um tipo próprio de nota do executivo, para separá-la de eventos do motor.
- 12.3 Sim aos seis campos. Hoje autor, data/hora e investidor existem; ação relacionada e etapa só de forma indireta.
- 12.4 Visível para o executivo responsável, Admin e Gestora — sendo nota operacional, não conteúdo privado de conversa.
- 12.5 Não recomendado. Nota privada por executivo cria histórico invisível e conflita com supervisão.

## 13. Gestora e Admin

- 13.1/13.2 Recomendação: **formalizar como papel do sistema**, mantendo o perfil funcional como consequência. Hoje a autoridade dela existe só numa lista dentro do código, enquanto o banco só conhece Admin.
- 13.3 Garantia: popular o papel no banco antes de qualquer mudança de acesso e ter uma verificação que falhe visivelmente (tela de erro) em vez de simplesmente devolver lista vazia.
- 13.4 Sim, a separação de três níveis é a correta e já corresponde ao modelo de acesso existente (completo x supervisão).
- 13.5 Somente dados operacionais. Conteúdo privado deve permanecer restrito ao responsável — é assim que o código já se comporta.

## 14. Alertas

- 14.1 Sim, recomendo eliminar a persistência da lista de alertas no navegador.
- 14.2 Manter no navegador apenas preferências e marcações visuais (lido, dispensado).
- 14.3 Sim, sempre derivado dos registros atuais.
- 14.4 Correto: nenhum alerta deve existir sem entidade válida.
- 14.5 Investidor removido ⇒ alerta desaparece; investidor mesclado ⇒ alerta aponta para a identidade resultante.

## 15. Apresentação Digital / E20

- 15.1 Sim, manter manual por enquanto — é o que mantém a E20 fora do caminho de envio automático.
- 15.2/15.3 Hoje "enviado" é uma **declaração humana**; o sistema distingue apenas "emitido/link gerado" de "declarado enviado". Não distingue "copiado". Confirmação de recebimento não existe.
- 15.4 Modelo futuro: três estados explícitos — emitido, entregue ao investidor (declarado) e acessado (já existe registro de acesso ao link).
- 15.5 Sim, E20 deve ser etapa do mesmo motor, como já é conceitualmente.
- 15.6 Sim, bloquear etapas posteriores até a confirmação é coerente com a natureza de fechamento da E20.
- 15.7 Sim; a imutabilidade deve continuar, e é reforçável no banco no futuro.

## 16. Dicionário de etapas

- 16.1 Fonte canônica: a configuração executável do motor (`config.ts`) — é ela que decide.
- 16.2 Sim, os rótulos devem ser derivados dessa mesma fonte.
- 16.3 A fotografia atual pode continuar, mas **apenas como documentação**, nunca consultada por código de decisão.
- 16.4 Preservar aliases num mapa único de tradução (chave antiga → chave atual), separado da lista de etapas vigentes.
- 16.5 Sim: as chaves de etapa estão gravadas em fila, eventos, cadências, envios e Biblioteca. Nenhuma chave já usada pode ser renomeada — só traduzida.

## 17. Legado

- 17.1 Não apagar (histórico operacional): eventos do relacionamento, fila, cadências, envios de mensagem com texto congelado, decisões, log do motor, linha do tempo, tarefas de ligação, ações de primeira aproximação, reuniões, ocorrências e acessos da E20, capítulos da apresentação, mensagens da Biblioteca (inclusive versões antigas), lotes de teste e backups.
- 17.2 Pode sair com segurança: coluna de ambiente do espelho (nunca lida), canal de mensagem desligado por bandeira dentro do módulo de ligações, dicionários de etapas duplicados, lista paralela de conteúdos da homologação, documentação e comentários residuais.
- 17.3 Classificação: **código morto** = canal desligado, dicionários duplicados, tela de nota órfã; **tabela histórica** = tudo do 17.1; **alias** = chaves antigas de etapa (preservar como tradução); **dado operacional** = fila, cadências, cards, reuniões; **documentação** = fotografia das etapas e roteiro; **seed** = conteúdo inicial da Biblioteca (só remover depois que houver versão publicada própria); **cache** = alertas e eventos guardados no navegador (descartáveis).

## 18. Central de Cadência

- 18.1/18.2 Devem ir para o banco (configuráveis): dias e intervalos entre etapas, horários da janela, feriados, textos e links das mensagens, rótulos e ativação/desativação de etapas. Devem permanecer em código: ordem estrutural dos fluxos, condições de transição, regras de interrupção e encerramento, idempotência e a trava de envio.
- 18.3 Sim, o risco é real: cadência 100% configurável vira uma linguagem de programação sem tipos, impossível de testar. A separação acima é a proteção.
- 18.4 Mínimo para o Admin: intervalos, janela/feriados, conteúdo das mensagens e ligar/desligar etapa.
- 18.5 Sim. O motor deve continuar com regras estruturais em código mesmo depois da Central.

## 19. Retomada futura (só conceito)

- 19.1 Confirmado: totalmente separada da correção de redistribuição manual.
- 19.2 O fluxo descrito é coerente com o modelo atual, mas **nada dele existe hoje** — sequência ER, fila de recuperação e arquivo não estão implementados; portanto é conceito, não determinável no estado atual.
- 19.3 Sim, conceitualmente antigos responsáveis ficam inelegíveis naquele ciclo.
- 19.4 Sim, três responsáveis por ciclo é o limite conceitual assumido.
- 19.5 Confirmado: só após aprovação específica.

## 20. Conclusão

**A. Já definidas:** definição de contato real (1.9); ciclo como portador do marco; identidade por vínculo, nunca fusão automática; chave de primeira aproximação = investidor + responsável + ciclo; ligação como canal da etapa; motor como fonte única do próximo passo; uma mensagem ativa por etapa+variante+assinatura, com conteúdo dentro dela; Central de Nomes só decide tratamento; linha do tempo como fonte humana; alerta sempre derivado; E20 manual; configuração executável como dicionário canônico.

**B. Precisam de decisão do negócio:** se agendamento sem conversa conta como contato; se ligação atendida sem avanço dispensa a mensagem da etapa; limite de redistribuições e prazo de inelegibilidade; se a Gestora vira papel formal agora; horário exato do início do dia operacional; se o marco é alterável pelo Admin.

**C. Podem ser implementadas:** carimbo operacional no ciclo; histórico de titularidade; leitura do responsável vindo da origem; resolução da identidade antes do card; snapshot diário de auditoria; estados de pulo/cancelamento/reagendamento por etapa; vínculo reunião↔etapa e reagendamento como nova ocorrência; tipo próprio de nota; alertas derivados; dicionário único de etapas.

**D. Devem esperar:** unificação dos dois motores; ligação como canal do motor; Central de Cadência; Retomada/ER; qualquer fusão de cards; automação de envio da E20.

**E. Dependências:** contato real ⇒ redistribuição; identidade ⇒ trava de primeira aproximação e relatório; histórico de titularidade ⇒ limite de redistribuição; estados de execução ⇒ relatório e transições condicionais; resultado estruturado da ligação ⇒ motor único; dicionário único ⇒ Central de Cadência.

**F. Riscos de regressão:** reconciliação agressiva unindo pessoas distintas pelo mesmo telefone; marco carimbado no ciclo despertando dívida antiga se aplicado ao contrário; trava por identidade impedindo primeira aproximação legítima; mudança de chave de etapa quebrando fila/eventos já gravados; migrar leitura para políticas de banco e deixar a Gestora sem acesso; mexer na fila de ligações sem preservar as tarefas concluídas.

**G. Ordem recomendada:** 1) definição de contato real como função única e auditável; 2) carimbo operacional no ciclo; 3) identidade resolvida antes do card (só vínculo); 4) leitura do responsável da origem + histórico de titularidade + limite de ciclo; 5) primeira aproximação por investidor+responsável+ciclo; 6) estados de execução (pulou/cancelou/reagendou/não executou); 7) snapshot diário de auditoria e relatório; 8) reunião ligada à etapa; 9) papel formal da Gestora; 10) dicionário único; 11) resultado estruturado da ligação; 12) Central de Cadência; 13) Retomada.

**H. Não mexer:** a trava global de envio de WhatsApp e todos os seus pontos de saída; o isolamento entre `/f`, `/s`, `/seg` e a página institucional; dados reais do Portal e da integração de origem; histórico já gravado (eventos, envios, ocorrências, reuniões, linha do tempo, backups); chaves de etapa já persistidas; Thiago Rodrigues e os registros preservados no reset.

**I. Prioridades:** P0 — contato real, carimbo do ciclo, identidade antes do card, responsável da origem + histórico de titularidade, trava de primeira aproximação. P1 — estados de execução, snapshot/relatório, reunião ligada à etapa, resultado estruturado da ligação. P2 — papel formal da Gestora, alertas derivados, dicionário único, tipo próprio de nota. P3 — limpeza de código morto, documentação, três estados da E20, Central de Cadência.
