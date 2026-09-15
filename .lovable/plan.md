# Correção universal da mensagem após ligação positiva — Financeira /f

## Objetivo
Aplicar uma única regra de seleção de mensagem após ligações na Ação do Dia, preservando a Biblioteca, o histórico e a cadência existente.

## Implementação
- Criar uma decisão pura e centralizada para o pós-ligação: resultado positivo (`SIM`/`ATENDEU`) nas etapas E0, E1, E2/V2, E3/V3, E4, E7, R1, R2, RE0, RE1 e RE3 resolve a chave existente `ENVIO_MATERIAL_POS_CONTATO`; resultado negativo mantém a chave e o contexto próprios da etapa.
- Fazer a leitura exibida no modal e o snapshot de conclusão consumirem a mesma decisão, garantindo que o texto copiado e o conteúdo auditado sejam idênticos e venham da versão ativa da Biblioteca.
- Manter o fluxo atual no mesmo card: ligação → resultado → modal atual → copiar → concluir, sem escolha manual e sem novo card.
- Ajustar RE0 e RE3 para ligação + mensagem imediata e manter R1/R2 nesse mesmo padrão dentro da própria etapa, sem criar etapa, prazo, relógio ou fonte de verdade; preservar integralmente as transições existentes após a conclusão.
- Não alterar mensagens publicadas, versões anteriores, histórico enviado, layout da Biblioteca, Agenda, prioridade ou reconciliação.

## Testes e validação
- Cobrir individualmente SIM e NÃO para E1, E2/V2, E3/V3, E4, E7, R1, R2, RE0, RE1 e RE3, além da manutenção da regra em E0.
- Confirmar que SIM sempre registra `ENVIO_MATERIAL_POS_CONTATO` e NÃO conserva a mensagem/contexto específico da etapa.
- Confirmar R1, R2, RE0 e RE3 no mesmo card, sem novo prazo, e ausência de alteração em `/s`, `/s/portal` e `/seg`.
- Executar testes focados, verificação de tipos e build. Não publicar.

## Detalhes técnicos
- Reutilizar `MATERIAL_AFTER_CONTACT_STEP` e o resolvedor atual da Biblioteca; nenhum texto será codificado.
- Transportar a chave efetivamente resolvida até o registro do snapshot, sem mudar a identidade da linha da fila nem o avanço da etapa.
- Preservar idempotência, claims/PROCESSING e registros já executados.
