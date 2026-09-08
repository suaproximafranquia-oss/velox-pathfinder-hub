# Follow-up do GreenSales como origem do agendamento — diagnóstico de arquitetura

Somente leitura. Nada foi alterado: nem código, nem banco, nem cadência, nem Ação do Dia.

## Respostas às 11 perguntas

**1. O objeto interno já existente representa um agendamento vindo do follow_up?**
Sim. `portal_meetings` já guarda lead, data/hora, duração, executivo responsável, situação, motivo de cancelamento, observações e origem (campo `origin`, hoje "executivo"). Um compromisso nascido do GreenSales caberia nesse mesmo objeto com origem própria — não é preciso criar outra tabela de compromisso.

**2. Onde está cada informação hoje**
- Estado "Agendamento" (coluna do funil): `crm_leads.stage_key`, espelho do GreenSales; a movimentação de coluna é sincronizada, não decidida pelo Portal.
- Estado interno de cadência: registro do motor com o sinalizador `scheduled` / estado `SCHEDULED`, que bloqueia toda etapa automática.
- follow_up do GreenSales: apenas dentro da cópia bruta `crm_leads.raw_payload`; nenhum código do Portal lê esse campo.
- Data/hora do compromisso interno: `portal_meetings.scheduled_at` (e, para compromissos livres do executivo, `workspace_agenda_events.starts_at`).
- Responsável: `portal_meetings.executive_id` / `executive_name`.
- Situação/desfecho: `portal_meetings.status` + registro em livro de eventos da Ação do Dia (compareceu / não compareceu / reagendada).
- Histórico: livro append-only de eventos da Ação do Dia e histórico do lead; `portal_meetings` guarda só o estado atual.

**3. Dá para ligar follow_up → lead → compromisso sem segunda fonte de verdade?**
Sim. A chave já existe e é estável: lead `59193` no CRM, `gs_59193` no Portal. Basta o compromisso interno carregar a marca de origem externa (fonte + id do lead na origem) e ser tratado como espelho: o Portal nunca cria nem altera data por conta própria para compromissos dessa origem, apenas reflete o que veio do GreenSales.

**4. Comportamento correto quando o follow_up muda 10/09 → 11/09 → 12/09**
Atualizar o MESMO compromisso (identidade = lead + origem externa), nunca criar um novo por valor. E registrar cada mudança percebida como um evento de reagendamento no histórico. Assim o compromisso é sempre um só, e a trilha de mudanças fica no histórico — que é exatamente o que já se faz hoje com reuniões internas reagendadas.

**5. Como não perder alterações intermediárias**
Não é necessário capturar cada valor intermediário. A sincronização compara o valor atual da origem com o valor do compromisso interno; se mudou, atualiza e grava um evento "reagendado de X para Y, percebido em Z". Valores que apareceram e sumiram entre duas sincronizações simplesmente não existiram para a operação — o que importa é o compromisso vigente e a trilha das mudanças percebidas.

**6. O horário pode alimentar a prioridade T-5?**
Sim, sem nada novo. A Ação do Dia já trata reunião como prioridade máxima e já entra em foco poucos minutos antes do horário. Um compromisso espelhado do GreenSales gravado em `portal_meetings` herda esse comportamento automaticamente.

**7. A arquitetura guarda o estado "vencido sem contato e sem reagendamento"?**
Hoje não existe esse estado. Ao registrar "não compareceu", a reunião é encerrada (Cancelada) e nada fica pendente para o dia seguinte. É a principal lacuna.

**8. Dá para fazer a pergunta de 24 horas sem iniciar R?**
Sim, desde que exista o estado do item 7. A Ação do Dia é um agregador de leitura: se houver uma obrigação persistida de "verificação em 24h", ela aparece sem que o motor decida nada. O motor continua bloqueado enquanto o lead estiver em agendamento — nenhum R nasce sozinho.

**9. Dá para exigir a movimentação humana Agendamento → Frio antes do R1?**
Sim, e é o comportamento atual: enquanto o lead está marcado como agendado, toda etapa automática fica bloqueada. O R só pode começar depois de um evento explícito de liberação — que passaria a ser condicionado à mudança de coluna vinda do GreenSales.

**10. Risco de duplicar o sistema de agendamento?**
Só existe risco se for criada uma nova tabela ou um novo fluxo paralelo. Reutilizando `portal_meetings` com marca de origem externa e regra de somente-espelho, não há duplicação. O ponto de atenção é o executivo criar manualmente no Portal uma reunião para um lead que também tem follow_up — isso precisa ser impedido ou fundido.

**11. Menor alteração arquitetural necessária depois**
Cinco peças, nenhuma delas nova estrutura de agendamento:
1. Leitura do `follow_up` na sincronização e espelhamento em `portal_meetings` com origem externa e identidade por lead+origem.
2. Regra de somente-espelho: compromisso de origem GreenSales não é criado nem tem data editada pelo Portal; reagendar orienta a alterar na origem.
3. Evento de reagendamento no histórico a cada mudança percebida.
4. Novo desfecho "sem contato, sem reagendamento", que em vez de encerrar a reunião cria uma obrigação de verificação para 24 horas depois.
5. Na verificação de 24h: "encerrar" fecha a cadência; "não encerrar" apenas instrui a mover para Frios na origem — e o R só começa quando essa mudança de coluna chegar pela sincronização.

Nada disso exige mudar o Safety Lock, disparar WhatsApp, iniciar R por horário vencido ou alterar o GreenSales.

## Pontos que precisam de decisão sua antes de construir

- O que fazer quando o mesmo lead tiver follow_up na origem E uma reunião criada manualmente no Portal.
- Se um follow_up apagado na origem deve cancelar o compromisso interno.
- Se o lead precisa estar na coluna Agendamento para o follow_up virar compromisso, ou se o follow_up sozinho já basta.
