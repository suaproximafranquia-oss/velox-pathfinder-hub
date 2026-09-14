# Regra de segunda-feira na E0 e confirmação após atendimento

## Objetivo
Ajustar somente o encerramento das ligações com mensagem associada na Ação do Dia da Financeira, sem alterar cadências ou módulos não relacionados.

## Implementação
- Fazer a E0 considerar uma única ligação quando a primeira tentativa for concluída numa segunda-feira operacional; se não houver contato, liberar diretamente a mensagem E0.
- Preservar integralmente, de terça a sexta, a sequência atual de duas ligações com intervalo de 10 minutos e mensagem somente após a segunda tentativa sem contato.
- No card de qualquer ligação cuja etapa tenha mensagem associada, ao escolher “Atendeu”, exibir a decisão “Deseja copiar a mensagem desta etapa?” com “Copiar mensagem” e “Concluído”.
- Reutilizar o carregamento e a cópia da mensagem oficial já existentes. Copiar não registra envio, não conclui a ligação e não cria ação; “Concluído” registra o atendimento pelo fluxo atual.
- Manter o comportamento atual de “Não atendeu” fora da exceção de segunda-feira.

## Detalhes técnicos
- Aplicar a exceção no resolvedor existente das ações internas da E0, usando o dia operacional em `America/Sao_Paulo`, sem criar outro motor ou persistência.
- Manter o registro do desfecho no servidor somente no clique final em “Concluído”.
- Identificar etapas com mensagem pelo plano vigente da própria etapa, sem lista paralela.
- Alterar apenas os arquivos diretamente responsáveis pelo plano interno, desfecho visual e testes focados.

## Validação
- Cobrir E0 na segunda-feira: uma ligação, mensagem após “Não atendeu”, decisão após “Atendeu” e ausência de segunda ligação.
- Cobrir E0 de terça a sexta: segunda ligação após 10 minutos e mensagem somente após a segunda tentativa sem contato.
- Cobrir demais etapas com ligação e mensagem: copiar ou concluir após “Atendeu”, garantindo que copiar não conclui.
- Executar testes focados, verificação de tipos, compilação e inspeção da Ação do Dia na prévia.
