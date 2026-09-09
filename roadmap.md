# Roadmap

- [ ] Financeira /f: bloquear a conclusão por cerca de 4 segundos, aguardar resposta e revalidar antes de selecionar a próxima ação, preservando continuidade da mesma lead.
- [ ] Validar transição com ligação e mensagem do mesmo lead fictício, sem dados reais ou sincronização.

- [x] Financeira /f: classificação temporal E0, reclassificação no timer existente, horários da Central e próximo compromisso.
- [x] Financeira /f: mensagem após primeira ligação sem contato; tentativa adicional em +2h expira no mesmo dia; compensação E1→E2 sem alterar datas e sem passar para E3.
- [x] Financeira /f: contato GreenSales com confirmação explícita, observação única e subtítulos das ligações.
- [x] Financeira /f: preservar nome principal na submissão/sincronização do Portal, mantendo matching e criação existentes.
- [x] Executar somente testes direcionados aos dois escopos e verificar controles visuais com TEST-0001, sem sincronização nem alterações de dados reais.

- [x] Pré-gatilho da Ação do Dia (/f): antecipar preparo ao escolher "Não atendeu", sem efetivar nada antes do "Concluído".
- [x] Retirar V1 da sequência operacional: E0 → E1 → E2/V2 → E3/V3 → E4, com a decisão da V0 avaliada na chegada da E2.
- [x] Financeira /f: garantir representação mínima para follow_up elegível sem card, usando o proprietário oficial da conexão e vínculo canônico existente, sem iniciar cadência.
- [x] Validar com testes direcionados a elegibilidade, responsabilidade, idempotência e ausência de obrigações adicionais (32 testes passaram, sem acesso a dados reais).
