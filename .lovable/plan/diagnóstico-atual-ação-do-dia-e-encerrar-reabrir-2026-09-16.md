# Diagnóstico atual — Ação do Dia e Encerrar/Reabrir

## Objetivo
Entregar uma leitura exclusivamente diagnóstica do comportamento atual, sem alterar código, banco, dados, regras, testes ou publicação.

## Verificações
- Confirmar nos registros atuais de Tiago Nunes da Silva e Mislem Alves a E0 materializada, status, vencimento, responsável e posição relativa na fila.
- Separar as três regras envolvidas: data estrutural da E0 pelo corte das 18h, horário de vencimento da obrigação e janela manual da Ação do Dia.
- Explicar os filtros e a ordenação atuais, incluindo a proteção de itens já reivindicados (`PROCESSING`).
- Rastrear o efeito real de `Encerrar negociação` e `Reabrir Lead` sobre o cadastro, histórico, estado comercial, ciclo e ações futuras.
- Verificar como `Pular` é persistido e se altera ou não o estado `EXECUTED` da fila.
- Comparar a elegibilidade por estágio do GreenSales com o mecanismo atual usado por Portal, TikTok e Meta.
- Concluir objetivamente quais partes da retomada por última etapa executada já são suportadas e quais integrações ainda não existem.

## Entrega
Responder nos sete blocos solicitados, escolher uma única alternativa real para os E0 da madrugada e distinguir claramente comportamento esperado de problema atual.

## Restrições
- Nenhuma alteração em arquivos do produto ou no banco.
- Nenhuma ação sobre leads, fila ou cadência.
- Nenhum teste novo, deploy ou publicação.
