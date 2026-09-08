# Follow-up do GreenSales como origem do agendamento — fechamento da arquitetura

Somente leitura. Nada foi alterado: nem código, nem banco, nem cadência, nem Ação do Dia.

## 1. O que já existe e pode ser reutilizado

- **Compromisso interno**: `portal_meetings` já guarda lead, data/hora, duração, executivo responsável, situação, motivo de cancelamento, observações, tópico e um campo `origin` (hoje só "portal" ou "executivo").
- **Coluna do funil**: as colunas reais do funil são NOVOS, ZERO CONTATO, FRIOS, AGENDAMENTOS, OPORTUNIDADES, VÍDEO, 4COF/CONTRATO, PAGAMENTO, REMARKETING, VENCEMOS, FINALIZADO e NÃO LOCALIZADOS. A coluna vigente do lead fica em `crm_leads.stage_key`, espelhada do GreenSales — o Portal não decide coluna.
- **Bloqueio da cadência**: o motor já tem o estado "agendado", que bloqueia integralmente qualquer etapa automática.
- **Elegibilidade do relacionamento**: a fila de cadência só considera leads nas colunas ZERO CONTATO e FRIOS. Lead em AGENDAMENTOS já é, por construção, inelegível.
- **Ação do Dia**: já lê reuniões de `portal_meetings`, marca reunião como prioridade máxima, entra em foco poucos minutos antes do horário e usa o card padrão com nome, telefone e Ver ficha.
- **Desfecho e histórico**: já existem registro de compareceu / não compareceu e de reagendamento, ambos gravados em livro append-only + histórico do lead.
- **Responsável do lead**: `portal_leads.responsible_executive_id` (+ slug), com regra de congelamento — uma vez definido, não é sobrescrito.

## 2. O que falta para o fluxo pretendido

1. Leitura do `follow_up` na sincronização (hoje nenhum código lê esse campo; ele só existe dentro da cópia bruta do lead).
2. Identidade externa no compromisso (origem + id do lead na origem).
3. Regra de espelho: compromisso de origem GreenSales não tem data editada no Portal.
4. Desfecho novo "sem contato e sem reagendamento", que não encerra o compromisso.
5. Obrigação persistente de verificação em 24 horas.
6. Gatilho de liberação do R somente na transição de coluna AGENDAMENTOS → FRIOS percebida pela sincronização.

## 3. follow_up + reunião manual no mesmo lead

Hoje as duas coisas coexistiriam e apareceriam como duas ações distintas, porque a Ação do Dia só deduplica reunião × evento de agenda quando o horário é idêntico — não há nada que reconheça "mesmo compromisso" entre origens.

Menor regra, sem tabela nova: por lead, **um único compromisso ativo de origem GreenSales**, identificado por origem + id externo; quando ele existe, ele tem precedência e a reunião manual do mesmo lead no mesmo período é absorvida (fundida no espelho) ou impedida na criação. Não é preciso apagar reuniões manuais antigas — basta a precedência.

## 4. follow_up apagado na origem

A sincronização atual não percebe nada, porque não lê o campo. Passando a lê-lo, a comparação valor-atual × valor-espelhado cobre os três casos sem estrutura nova:

- existe → compromisso ativo;
- mudou → o mesmo compromisso é atualizado e um evento de reagendamento é gravado;
- sumiu → o compromisso espelhado é cancelado (situação Cancelada + motivo "follow-up removido na origem").

Nenhuma reunião nova é criada em nenhum dos casos.

## 5. follow_up sem estado AGENDAMENTO

Compatível e recomendável. A coluna vigente já está em `crm_leads.stage_key`, então a condição é direta: só vira compromisso quando `stage_key = agendamentos`. Lead em NOVOS ou FRIOS com follow_up preenchido é ignorado. Isso também protege a cadência: nas colunas elegíveis (ZERO CONTATO/FRIOS) o relacionamento continua rodando normalmente.

## 6. Identidade do compromisso GreenSales

Usar `portal_meetings`, sem tabela nova, com dois atributos de identidade: origem = "greensales" e id do lead na origem (59193). A chave de unicidade é o par (origem, id externo) — mudança de horário atualiza o mesmo registro, nunca cria outro. Hoje `origin` existe mas só aceita dois valores e não há campo para o id externo: é aí que entra a alteração mínima.

## 7. Ligação com T-5 / Ação do Dia

Automática. Gravado o compromisso em `portal_meetings`, ele herda tudo: card padrão com nome, telefone e Ver ficha, prioridade máxima, foco cinco minutos antes e ação principal no horário. A pergunta "Houve contato no agendamento?" já existe como desfecho compareceu/não compareceu com nota. A única mudança na tela é, no "não", oferecer as duas saídas: instrução para reagendar na origem (o Portal não grava horário novo) ou o estado de vencido sem contato.

## 8. Guardar "vencido sem contato e sem reagendamento"

Hoje não existe: "não compareceu" encerra o compromisso como Cancelada e nada sobra para o dia seguinte. É a maior lacuna. A forma mais barata é uma situação própria do compromisso (ex.: "vencido sem contato") que o mantém vivo, mais uma obrigação de verificação com vencimento em 24 horas — usando a fila de obrigações que a Ação do Dia já lê.

## 9. Verificação de 24 horas

Suportada assim que existir a obrigação persistida do item 8: a Ação do Dia é agregador de leitura e exibe o card padrão com o texto de decisão. "Sim" encerra a cadência (o motor já tem encerramento). "Não" apenas mostra a instrução de mover para FRIOS na origem — o Portal não move o lead e não inicia nada.

## 10. Liberar R somente após AGENDAMENTOS → FRIOS

Já é o comportamento estrutural: lead em AGENDAMENTOS está fora das colunas elegíveis e, com o estado agendado, toda etapa automática fica bloqueada. Quando a sincronização perceber a coluna FRIOS, o lead volta a ser elegível. Falta apenas ligar essa transição ao desbloqueio explícito do estado agendado no motor.

## 11. Responsável quando o vendedor vem vazio

Regra existente: o responsável é o do lead no Portal (`portal_leads.responsible_executive_id`), atribuído no Portal e congelado depois de definido; o GreenSales não é fonte desse dado. O compromisso deve herdar esse responsável. Risco real: no lead 59193 o responsável está vazio — nesse caso o compromisso nasceria sem dono e não apareceria na Ação do Dia de ninguém. **Decisão necessária antes de construir**: bloquear a criação do espelho sem responsável, ou criar e listar como pendência de atribuição.

## 12. Menor construção necessária

1. Sincronização passa a ler o `follow_up` apenas quando o lead está em AGENDAMENTOS.
2. `portal_meetings` ganha identidade externa (origem "greensales" + id do lead na origem) — nenhuma tabela nova.
3. Espelhamento idempotente: criar, atualizar horário ou cancelar; sempre o mesmo registro; evento de reagendamento no histórico a cada mudança percebida.
4. Precedência do espelho sobre reunião manual do mesmo lead.
5. Desfecho "vencido sem contato" + obrigação de verificação em 24 horas.
6. Decisão de 24 horas: encerrar cadência, ou instruir a mover para FRIOS.
7. Desbloqueio do R condicionado à transição de coluna percebida pela sincronização.

Nada disso toca GreenSales, Safety Lock, envio de WhatsApp, ou as réguas E, R, RE e RF.

## Único ponto em aberto

O tratamento do compromisso quando o lead ainda não tem responsável no Portal (item 11).
