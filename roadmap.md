# Roadmap

- [x] Financeira /f: KPI, Painel de Campanhas e Brain Analytics com a mesma fonte oficial server-side, sem mudar cálculos ou layout.
- [x] Financeira /f: preservar identidade oficial e vínculo em link cru; atualizar nome de card existente pela origem GreenSales respeitando proteção manual.
- [x] Financeira /f: nova data comercial reconhecida como RE0 idempotente apesar de tags antigas, sem inventar coluna ausente.
- [x] Validar somente os três pontos com testes direcionados; não sincronizar nem alterar dados reais (9 arquivos, 41 testes passaram; build automático OK; produção e E2E autenticado não confirmados).

- [x] Financeira /f: compromissos após foco como pendências abertas, sem atraso ou bloqueio, com desfecho acessível.
- [x] Financeira /f: nova submissão válida determina RE0; sem submissão não abre RE; repetição idempotente.
- [x] Exceção autorizada: ajustar somente abertura/idempotência da reentrada e vínculo com a fila existente, preservando histórico e RE0–RE3.
- [x] Financeira /f: persistir PDF e metadados no servidor e recuperar no perfil executivo sem cache local.
- [x] Validar somente cenários fictícios direcionados, preservando 4s, cadência, demais ambientes e dados reais (55 testes; validação automática OK; PDF fictício de uma página inspecionado sem cortes ou sobreposições; armazenamento validado com mocks, sem operação em dados reais).

- [x] Financeira /f: bloquear a conclusão por cerca de 4 segundos, aguardar resposta e revalidar antes de selecionar a próxima ação, preservando continuidade da mesma lead.
- [x] Validar transição com ligação e mensagem do mesmo lead fictício, sem dados reais ou sincronização (6 cenários visuais: continuidade, gravação lenta, falha de leitura, recusa, fim da continuidade e resposta antiga; clique duplo bloqueado).

- [x] Financeira /f: classificação temporal E0, reclassificação no timer existente, horários da Central e próximo compromisso.
- [x] Financeira /f: mensagem após primeira ligação sem contato; tentativa adicional em +2h expira no mesmo dia; compensação E1→E2 sem alterar datas e sem passar para E3.
- [x] Financeira /f: contato GreenSales com confirmação explícita, observação única e subtítulos das ligações.
- [x] Financeira /f: preservar nome principal na submissão/sincronização do Portal, mantendo matching e criação existentes.
- [x] Executar somente testes direcionados aos dois escopos e verificar controles visuais com TEST-0001, sem sincronização nem alterações de dados reais.

- [x] Pré-gatilho da Ação do Dia (/f): antecipar preparo ao escolher "Não atendeu", sem efetivar nada antes do "Concluído".
- [x] Retirar V1 da sequência operacional: E0 → E1 → E2/V2 → E3/V3 → E4, com a decisão da V0 avaliada na chegada da E2.
- [x] Financeira /f: garantir representação mínima para follow_up elegível sem card, usando o proprietário oficial da conexão e vínculo canônico existente, sem iniciar cadência.
- [x] Validar com testes direcionados a elegibilidade, responsabilidade, idempotência e ausência de obrigações adicionais (32 testes passaram, sem acesso a dados reais).

- [x] /f: RE só nasce de nova entrada comercial GreenSales; atividade/aviso do Portal nunca cria RE.
- [x] /f: Aviso do Portal não alimenta continuidade nem fila; prioridade logo após a ação em atendimento.
- [x] /f: card do aviso sem texto interno, com data/hora real (America/Sao_Paulo).
- [x] /f: continuidade prioritária da cadeia E0 (Ligação 1 → Ligação 2 → Mensagem) mesmo com origem atrasada.
- [x] /f: botão Copiar da Mensagem E0 copia, mostra confirmação e só encerra no Concluído.
- [ ] /f: link cru reconhece responsável oficial no CTA, sem fallback padrão.
- [x] /f: progresso do Manual na Jornada usa a régua existente de capítulos.
- [ ] Formulários públicos Financeira e Solar: entrada comercial na operação correta; rótulo/validação de Cidade coerentes.
