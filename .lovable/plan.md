# Diagnóstico — por que a E0 foi enviada de novo no lugar da E1

Somente investigação. Nada foi alterado em código, banco, cadência ou comportamento.

## Resposta curta

O motor **não** repetiu a E0 para o mesmo lead. Nos registros do servidor não existe nenhum lead com dois eventos `FIRST_CONTACT_SENT`, nem duas decisões `E0/E0_V1` com resultado `sent`, nem duas mensagens `msg_e0_<lead>`.

O que aconteceu foi outra coisa, e ela é real: **a mesma pessoa recebeu a mensagem de E0 duas vezes porque existiam DOIS cards diferentes para o mesmo telefone**. Cada card é uma identidade própria para o motor, com cadência própria, e toda identidade nova começa na E0.

Evidência encontrada (telefone `...9887766`):

```text
ld_mt7p6loyurxj  24/08 20:38  msg_e0_ld_mt7p6loyurxj  (E0)
ld_mt7zwv6mr87x  25/08 07:01  msg_e0_ld_mt7zwv6mr87x  (E0 outra vez, outro card)
```

Enquanto isso, o primeiro card continuava parado esperando a E1 — todas as avaliações dele terminaram em `noop` com o motivo "Etapa **novos** no fechamento do dia não é elegível para cadência automática", ou seja, a E1 nunca chegou a ser criada. Para o operador o efeito visível é exatamente o relatado: "recebeu E0, depois deveria vir E1, e veio E0 de novo".

## Respostas item a item

1. **Como o sistema registra que a E0 já foi enviada** — em três lugares que se reforçam: a mensagem com id determinístico `msg_e0_<leadId>` em `crm_messages`; o evento `e0_<leadId>` do tipo `FIRST_CONTACT_SENT` em `relationship_events` (chave única); e a etapa gravada em `executed_steps` no registro de cadência.

2. **Onde o estado fica armazenado** — `relationship_cadences` (uma linha por escopo + rodada + lead): estado, fluxo, etapa atual, etapas executadas, últimos horários, janela de 24h. A fila fica em `relationship_queue` e a explicação de cada decisão em `relationship_decisions`.

3. **Como o motor escolhe a próxima etapa** — pela sequência do fluxo (`E0 → E1 → E3 → E4 → E12`), pegando a primeira etapa que ainda **não** está em `executed_steps`, e verificando ordem, prazo em dias úteis, janela operacional e template.

4. **O que impede o reenvio da E0** — a presença de `E0` (e `E0_V1`) em `executed_steps`, a chave única do evento e a chave primária da mensagem. As três travas estão funcionando: só valem **por identidade de lead**.

5. **Como decide enviar a E1** — a E1 é 1 dia útil depois da referência, e a referência é a **saída do lead da coluna NOVOS** (primeira ação humana). Enquanto o card fica em NOVOS, a decisão é sempre `noop` e a E1 não é criada.

6. **Diferença entre os conceitos** — sim, são quatro coisas distintas: etapa atual (`current_step`), última mensagem enviada (`crm_messages` / `last_outbound_at`), próxima mensagem programada (`relationship_queue`) e histórico completo (`relationship_events` + `relationship_decisions`).

7. **O motor pode perder o estado e voltar para E0?** — não por corrupção: quando não encontra registro, ele cria um registro novo em `CADENCE_NOT_STARTED`, que só sai do lugar com um primeiro contato. O caminho real de "voltar para E0" é justamente o **leadId novo**: outro card = registro inexistente = cadência começa do zero.

8. **É idempotente?** — sim para o mesmo `leadId`: reserva atômica da tarefa na fila, chave única de evento e id determinístico da mensagem. Processar o mesmo lead várias vezes não redispara a E0.

9. **Sincronização/reconciliação redefine a etapa para E0?** — não foi encontrado nenhum caminho que reescreva `executed_steps` ou apague a mensagem `msg_e0_`. O risco vem da criação de um **novo card** (novo cadastro do mesmo telefone, ou card do Portal convivendo com o card do GreenSales), não de reset de etapa.

10. **Usa estado persistido ou reinfere?** — usa o estado persistido no banco; só o horário e a elegibilidade do momento são recalculados a cada execução.

11. **Fuso/janela** — a janela usa deslocamento fixo -03:00 e não reposiciona o lead na E0. O que a janela faz é adiar: os E0 das 07:01 são exatamente a fila de adiamento noturno abrindo. Não é a causa do reenvio.

12. **Condição exata que permitiu a segunda E0** — um segundo card com `leadId` diferente para o mesmo telefone. As travas de idempotência são todas indexadas pelo `leadId`; sem uma chave por **pessoa/telefone**, o segundo card é tratado como lead novo e a máquina de estados abre corretamente na E0 (e não em RE0, porque a reentrada só é detectada quando é o mesmo registro que volta).

Fator agravante que tornou o sintoma visível: o primeiro card ficou parado em NOVOS, então a E1 dele nunca foi programada, e a única mensagem nova naquele telefone foi a E0 do card duplicado.

Observação secundária, sem relação com a cadência: toda mensagem do motor sai com o rótulo `[TESTE — E0 SIMULADA]` e autor "Motor de Relacionamento (TESTE — E0 SIMULADA)", inclusive nas etapas E1/E3. Isso faz qualquer etapa parecer "E0" na leitura da conversa e pode ter reforçado a percepção do problema.

## Como confirmar em 100% o caso específico

Para fechar o diagnóstico no lead exato do teste, basta informar o nome ou o telefone usado. Com ele eu comparo, lado a lado: cards existentes para o telefone, registros de cadência de cada card, eventos, decisões e mensagens — e digo se o caso é o mesmo padrão acima ou uma segunda causa.

## Próximo passo (somente após sua decisão)

Nada será corrigido agora. As linhas de correção possíveis, quando você autorizar, são: identidade única por pessoa/telefone antes de abrir cadência; mesclagem/vínculo de cards duplicados; e revisão do gate de NOVOS para que a E1 não fique indefinidamente parada.
