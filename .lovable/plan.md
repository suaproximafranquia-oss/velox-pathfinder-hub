# Botão WhatsApp no modal de mensagem da Ação do Dia

## Implementação
- Alterar somente o botão secundário do modal “Mensagem oficial”, mantendo intacto o “Ver ficha completa” do card principal.
- Reutilizar `item.phone` e a normalização central existente para montar `https://api.whatsapp.com/send?phone=<dígitos>`.
- Abrir o contato em nova aba com proteção de segurança, sem texto preenchido, envio automático, fechamento do modal ou mudança de estado.
- Quando o telefone estiver ausente ou inválido, manter o modal aberto e exibir um aviso local claro.

## Validação
- Cobrir telefone brasileiro válido, sem DDI, mascarado e inválido/ausente.
- Comprovar que o clique apenas abre o contato e que copiar, concluir, fechar e o primeiro “Ver ficha completa” permanecem intactos.
- Executar testes focados, verificação de tipos, compilação automática e Preview autenticado quando houver sessão, sem publicar.
