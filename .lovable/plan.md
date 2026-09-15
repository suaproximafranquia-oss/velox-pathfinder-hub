# Correção cirúrgica — Ação do Dia / Financeira `/f`

## Implementação

- Derivar uma única data operacional da E0 a partir do `entry_at` real e carregá-la pela abertura existente do ciclo, preservando `origin_date`, `theoretical_date` e `due_at`.
- Fixar a estrutura da E0 nessa data: segunda e entradas acumuladas do fim de semana usam uma ligação e mensagem; terça a sexta usam duas ligações com intervalo de 10 minutos.
- Manter sábado como execução opcional, domingo como acumulação para segunda e impedir que o fim de semana produza atraso indevido.
- Preservar a continuidade da mesma E0 e ordenar entradas convergentes de sexta a domingo pelo instante real de entrada.
- Reutilizar a leitura oficial da Ação do Dia em uma atualização silenciosa aproximada de 60 segundos, preservando a ação `PROCESSING` e a seleção corrente.
- Antes de exibir a fila, neutralizar somente pendências incompatíveis com estados comerciais congeladores, de forma idempotente e auditável; E0 sem primeiro contato permanece protegida.

## Testes e validação

- Criar testes focados para os cenários A–R solicitados, incluindo fronteiras de 18:00, sábado/domingo, atraso sem mudança estrutural, continuidade em +10 minutos, ordem cronológica, neutralização e proteção de `PROCESSING`.
- Executar apenas testes relacionados, verificação de tipos, build e preview de `/f`.
- Não publicar nem alterar `/s`, `/s/portal`, `/seg`, GreenSales, autenticação, segurança, E1–E8, R/RE, histórico ou demais áreas protegidas.

## Detalhes técnicos

- Reutilizar o motor, a fila e os campos atuais; não criar tabela, fila, data paralela ou arquitetura nova.
- Limitar as mudanças aos módulos de planejamento E0, abertura manual, leitura/ordenação da Ação do Dia, reconciliação server-side e atualização visual já existentes.
