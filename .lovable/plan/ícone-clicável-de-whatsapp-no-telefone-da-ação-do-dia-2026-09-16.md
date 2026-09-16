# Ícone clicável de WhatsApp no telefone da Ação do Dia

## Implementação
- Alterar somente a linha de telefone do card central da Ação do Dia.
- Exibir um controle compacto apenas com o ícone `MessageCircle` imediatamente antes do número, sem mudar a tipografia ou o link telefônico existente.
- Fazer o ícone chamar o mesmo `handleOpenWhatsapp`, que usa `openDailyActionWhatsapp` e a normalização central `normalizeWhatsappNumber` já usados pelo botão WhatsApp do modal.
- Reutilizar o mesmo aviso local para telefone ausente ou inválido, sem abrir modal, concluir ação ou alterar qualquer estado operacional.

## Testes e validação
- Ajustar somente o teste focado do card para confirmar presença e acessibilidade do ícone, reutilização do mesmo handler, URL normalizada, bloqueio de URL inválida e ausência de transições operacionais.
- Executar os testes focados do componente/handler, verificação de tipos e aguardar a compilação automática.
- Não publicar nem fazer deploy.
