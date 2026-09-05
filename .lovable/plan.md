# Segunda rodada de análise técnica — Financeira /f (somente leitura)

Nada foi alterado, executado ou criado. Todas as respostas vêm da leitura do código e de consultas de leitura ao banco.

## 1. Marco operacional / leads antigos

- 1.1 Todo item da fila de relacionamento nasce em um único ponto (`upsertQueueItem`, `repository.server.ts`), chamado pelo motor (`engine.ts`) em três situações: agendamento de etapa, item imediato e follow-up.
- 1.2 A data de vencimento é calculada por dias úteis a partir do último evento (`decide.ts`). Nem `decide.ts` nem `engine.ts` consultam o marco.
- 1.3 Hoje o marco (`cadence_activation_date` = 2026-09-03) só é lido na **entrada**: ingestão de lead e registro da E0. A decisão do motor, a fila e a Ação do Dia não o consultam.
- 1.4 Sim, há risco: o cron de sincronização chama o tick do motor, que reavalia qualquer lead com cadência aberta, item vencido ou E0 já registrada — sem filtro por data. Filtrar só na Ação do Dia esconde o efeito, não o impede.
- 1.5 Recomendação: gravar o marco **no próprio ciclo** (a cadência nasce carimbada como "pós-marco" ou "histórica") e o motor recusar avanço de ciclo histórico. Marco na entrada + carimbo no ciclo + filtro de leitura, nessa ordem de autoridade.
- 1.6 Outro marco: não. `is_test`/`test_batch_id` controlam simulação, não elegibilidade. Não existe `activated_at` por ambiente.

## 2. Identidade única

- 2.1 A identidade operacional de fato é o card (`portal_leads.id`, no formato `gs_<id>` ou `ld_<id>`): é essa chave que a fila usa (100% dos itens).
- 2.2/2.3 Existem duas chaves concorrentes para a mesma pessoa: o espelho da origem (639 registros) e o card (115). A camada canônica existe (`investors` + `investor_identifiers`) mas cobre só 11% do espelho e 78% dos cards. O mesmo investidor pode existir com identificadores diferentes.
- 2.4 A reconciliação existe (`canonical_investor_id`), porém parcial e não obrigatória; a ingestão não a preenche.
- 2.5 Caminho recomendado: tornar a criação do card obrigada a resolver/criar a identidade canônica (por telefone normalizado + origem), sem mexer nos IDs já existentes — a identidade passa a ser um vínculo, não uma troca de chave.
- 2.6 Sim: a Ação do Dia deveria agrupar por identidade canônica e continuar executando sobre o card.
- 2.7 Impacto real: a trava que impede E0 duplicada é por card, não por pessoa. Dois cards da mesma pessoa hoje podem gerar duas E0. Jornada, notas, reuniões e mensagens também ficam divididas entre os dois IDs.

## 3. Redistribuição manual no GreenSales

- 3.1 O responsável vem no pacote da origem (`vendedor_id`).
- 3.2 Ele **nunca é lido** — o único uso é a definição do tipo. O responsável é resolvido pela conexão que executou a sincronização, não pelo lead.
- 3.3 Melhor detecção: comparar o responsável da origem com o responsável do card a cada sincronização — não depende de tag.
- 3.4 Sim, é necessário histórico de titularidade por investidor: hoje o card guarda apenas o dono atual e nunca é reatribuído (o preenchimento tardio só age quando está vazio).
- 3.5 Distinção viável com o que existe: card inexistente = novo; card existente com responsável diferente = redistribuído; mudança apenas de coluna = mesma titularidade; contato real = existe evento de mensagem/ligação/E0 concluída.
- 3.6 Disparo correto: o evento "mudança de responsável detectada na sincronização".
- 3.7 Reutilizar E0. Ela já é a etapa de primeira aproximação e respeita Manual/Automático por executivo; criar outro tipo de entrada criaria um terceiro fluxo.
- 3.8 A duplicidade é evitada tornando a chave da nova entrada dependente do par lead+responsável (hoje a trava é só por lead), mantendo a mesma natureza atômica de hoje.
- 3.9 O histórico anterior é preservado naturalmente: nada é apagado; basta o registro de troca de titularidade com data e executivo anterior.
- ZERO CONTATO em si não bloqueia; o que bloqueia é o lead não ser reconhecido como "entrada" quando as etiquetas não chegam na listagem.

## 4. Dois motores

- 4.1 Relacionamento: etapas de conteúdo (E/R/RE/RF), sequência obrigatória, fila persistida com estados, encerramento explícito e snapshot de mensagem.
- 4.2 Ligações: tentativas L2–L5, dias úteis, desfecho atendeu/não atendeu. Não persiste "tarefa pendente" — a fila é recalculada a cada leitura.
- 4.3 Autoridade recomendada: o motor de relacionamento deve ser dono de etapa atual, próxima etapa, vencimento, encerramento e dependências; o de ligações deve ser dono apenas do **resultado** da ligação, reportado ao primeiro.
- 4.4 Sim, os dois conduzem o mesmo investidor ao mesmo tempo, por desenho.
- 4.5 A colisão é apenas atenuada: a cadência de mensagens do módulo antigo está desligada por bandeira e a ligação evita (em até um dia útil) cair no mesmo dia da mensagem — coincidência continua permitida.
- 4.6 A futura Central de Cadência deve configurar **um único motor**, com ligação como canal desse motor.
- 4.7 Para não surgirem três motores: uma fila persistida única, com canal como atributo, e um só lugar que calcula vencimento.

## 5. Histórico de etapas

- 5.1 Fonte mais confiável: o log de eventos do relacionamento (append-only, idempotente), somado à lista de etapas executadas na cadência e ao registro imutável de mensagens enviadas.
- 5.2 Não é uniforme: para ligações, só existe linha quando concluída — ausência não prova nada.
- 5.3 Distinguível hoje: executada, cancelada, encerrada (por ciclo) e manual x automática (por texto do resultado). **Não** distinguível: pulada ao nível de etapa e substituída/reagendada.
- 5.4 Sim para mensagens (estados discretos na fila). Não para ligações (não existe estado pendente persistido).
- 5.5 Quase: falta um registro de reagendamento/cancelamento por etapa com autor e horário. Sem isso, transições condicionais futuras terão pontos cegos.
- 5.6 Sem rastro suficiente: ligação não realizada, reagendamento de etapa (a data anterior é sobrescrita) e cancelamento automático (sem autor).

## 6. Agendamento

- 6.1 Quase: a tabela de reuniões já tem investidor, executivo, data/hora, duração, estado (7 valores), origem, motivo de cancelamento e observações.
- 6.2 Falta: histórico de alterações e um estado explícito de comparecimento (hoje "compareceu/não compareceu" vira Concluída/Cancelada).
- 6.3 O reagendamento **sobrescreve** a data; a data anterior não fica na tabela (só o novo horário aparece no log).
- 6.4/6.5 Não existe vínculo estrutural com etapa/fluxo — a reunião e a fila são apenas mescladas na mesma lista do dia. Esse vínculo precisará ser criado.

## 7. Notas do executivo

- 7.1/7.2 A observação registrada na Ação do Dia é gravada em dois lugares ao mesmo tempo: log técnico e linha do tempo do investidor, ligada ao ID do card.
- 7.3 São camadas diferentes: linha do tempo = leitura humana por investidor; log técnico = auditoria; "Nota do Executivo" é um terceiro caminho que grava só na linha do tempo.
- 7.4 Fonte oficial recomendada: a linha do tempo do investidor; o log técnico permanece como auditoria.
- 7.5 Sim — e hoje pior: a tela que grava a "Nota do Executivo" não está ligada a nenhuma rota do aplicativo (código órfão), e a ficha atual não exibe notas.
- 7.6 Recomendação: uma fonte de leitura (linha do tempo) + um log de auditoria; nada de terceiro histórico.

## 8. Relatório administrativo

- 8.1 Parcialmente: executado e pulado são reconstruíveis; **planejado não é** — ele é calculado na hora e nunca fotografado.
- 8.2 Fonte principal: o log de ações do dia (vocabulário fechado de eventos), unido às tarefas de ligação concluídas.
- 8.3 Executado x pulado por executivo e por dia: sim. Planejado histórico: só com uma foto diária.
- 8.4 Já são gravados quem clicou e de quem é o lead — porém dentro do campo livre, não em coluna própria.
- 8.5 A justificativa do pulo é obrigatória (mínimo 3 caracteres) e persistida.
- 8.6/8.7 Recomendação: calcular a partir do histórico e persistir apenas uma foto diária do planejado — sem tabela agregada de resultados.

## 9. Permissões da Gestora

- 9.1 Sim, hoje ela vê tudo, mas por regra de aplicação; o acesso ao banco é feito com credencial administrativa que ignora as políticas.
- 9.2 A distinção já existe no código: modo supervisão (vê responsável, origem, situação) x completo (dono do relacionamento, vê conteúdo privado).
- 9.3 Manter supervisão de leitura e nunca colocá-la como responsável de card — a Ação do Dia é montada por responsável, então ela não recebe ações alheias.
- 9.4 Sim: Admin com poder de correção; Gestora com leitura ampla e justificativas.
- Achado relevante: a tabela de papéis do banco tem uma única linha (Admin). A Gestora não existe como "manager" ali — se algum dia a leitura passar a respeitar as políticas, ela perde a visão silenciosamente.

## 10. Central de Alertas

- 10.1/10.2 Não há tabela de alertas: tudo é recalculado no navegador a partir de investidores, reuniões e jornadas.
- 10.3 Sim — a lista fica guardada no navegador (três chaves locais, limitadas a 300/500 itens).
- 10.4 Não há invalidação por relevância, apenas descarte dos mais antigos por limite.
- 10.5 Sim: um alerta antigo pode apontar para investidor que não existe mais; a tela mostra o cartão sem contato. Isso explica plausivelmente o caso "Augusto" sem qualquer dado semeado.

## 11. Apresentação digital / E20

- 11.1/11.2 Capítulos são versionados e publicados; a emissão cria uma ocorrência ligada ao lead, assinada pelo executivo responsável real.
- 11.3 A emissão é feita pela função de emissão da E20, que encerra ocorrência anterior aberta antes de abrir a nova.
- 11.4/11.5 Não há envio: é geração de link e texto para cópia manual, com registro humano de "enviado". Por isso não passa pela trava global — que continua ativa nos caminhos reais de envio. Recomendação: se um dia a E20 enviar sozinha, ela precisa passar pela trava.
- 11.6/11.7 Sim: cada emissão congela o roteiro e o texto; alterações posteriores não afetam ocorrências já emitidas. A imutabilidade é garantida pelo aplicativo, não por regra de banco.

## 12. Resíduos

- 12.1 Sujeira inofensiva: a coluna de ambiente do espelho (nunca lida) e a "fotografia" documental das etapas. Podem causar comportamento incorreto: os quatro dicionários de etapas simultâneos e a segunda lista de conteúdos usada na homologação (pode divergir do que o motor decide).
- 12.2 Preservar: aliases históricos e etapas legadas da Biblioteca (mensagens antigas continuam legíveis).
- 12.3 Antes da Central de Cadência: unificar os dicionários de etapas em uma fonte única.
- 12.4 Dependência escondida: a exigência de conteúdo por etapa é derivada da configuração — mexer nela altera diagnósticos da Biblioteca.
- Não há cache de mensagens: a versão ativa é sempre lida do banco na hora.

## 13. Conclusão

**A) Já decidíveis:** motor de relacionamento como autoridade única de etapa/vencimento; identidade canônica como vínculo obrigatório na criação do card; responsável da origem passa a ser lido; linha do tempo como fonte oficial de nota; dicionário único de etapas.

**B) Precisam de regra de negócio:** o que conta como "contato real" para reabrir E0; se a redistribuição reinicia o ciclo ou só troca o dono; política de comparecimento/reagendamento; escopo exato do que a Gestora pode ler.

**C) Seguro implementar:** carimbo de marco no ciclo; histórico de titularidade; foto diária do planejado; vínculo reunião↔etapa; ligar a nota do executivo a uma tela real.

**D) Não implementar ainda:** unificação dos dois motores; troca de chave primária de identidade; Central de Cadência configurável; redistribuição automática.

**E) Dependências:** identidade canônica antecede redistribuição e relatório; histórico por etapa antecede transições condicionais; dicionário único antecede a Central de Cadência.

**F) Ordem recomendada:** 1) marco no ciclo; 2) identidade canônica obrigatória; 3) leitura do responsável da origem + histórico de titularidade; 4) rastro por etapa (reagendou/cancelou/pulou, com autor); 5) reunião como entidade ligada ao fluxo; 6) relatório administrativo; 7) dicionário único de etapas; 8) só então Central de Cadência.
