# Estudo de viabilidade — Homologação integrada temporária da régua /f

Somente análise. Nada foi alterado, executado ou criado.

## Respostas diretas

**1. É tecnicamente possível?** Sim, com uma estrutura temporária pequena. A base já existe: o Laboratório de lotes (`src/server/testing/test-lab.server.ts`) cria personagens fictícios que entram pelo caminho real de entrada, percorrem o motor real e podem ser apagados por lote.

**2. Como identificar os personagens?** Já existe marcação técnica: cada lead nasce com `is_test` e um `test_batch_id` (ex.: lote `TB-07`). Toda consulta e toda limpeza usam esse par. Personagens do teste também podem receber prefixo próprio no identificador externo.

**3. Isolamento em relação aos leads reais?** Sim no nascimento, na saída de mensagem e na limpeza. O ponto que hoje NÃO é isolado é o processamento: o ciclo do motor varre todos os leads elegíveis de produção de uma vez. Para o teste acelerado é obrigatório um ciclo restrito a uma lista de personagens (mesma função, com filtro), senão acelerar o teste significaria também processar leads reais.

**4. Relógio acelerado só para eles?** Sim, mas não com um relógio global falso. A régua atual (`cadence-v2.ts`) calcula vencimento por DATA de calendário a partir da origem do ciclo, comparando com a hora real do servidor. Existe uma abstração de relógio virtual no projeto, porém ela nunca foi ligada à régua da Financeira. A forma segura e barata é o **deslocamento de datas dos próprios personagens**: a cada "dia virtual" o executor recua as datas de origem e vencimento apenas das linhas marcadas como teste. Nada global muda, e leads reais nunca são tocados.

**5. Menor intervalo seguro por dia virtual.** O limite não é o relógio, é a duração de um ciclo do motor. Cada "dia" exige: deslocar as datas do lote, rodar o ciclo restrito, deixar a Ação do Dia recalcular e gravar o resultado. Recomendação: **começar em 20 segundos por dia virtual**, com o ciclo executado em série (um dia só começa quando o anterior terminou) e trava de execução única. 10 segundos só é aceitável se medido em ambiente real com o lote pequeno; abaixo disso o risco é sobreposição de ciclos, disputa pelas mesmas tarefas e leitura da tela no meio de uma transição. A regra de ouro: **nunca por temporizador fixo, sempre "próximo dia só após o anterior concluir"** — assim a velocidade se ajusta sozinha e nunca gera corrida.

**6. Concluir em poucos minutos?** Sim. O caminho mais longo da régua (entrada → E8, com material) gira em torno de 20 dias de calendário; com 20 segundos por dia isso é cerca de 7 minutos, e os personagens correm em paralelo dentro do mesmo dia virtual. Sem o caso de longa espera, a homologação completa fica na faixa de 5 a 10 minutos.

**7. Bifurcações reais da régua atual.**
- Entrada: origem GreenSales (espelho) x origem Portal/formulário x link cru sem executivo.
- Identidade: pessoa nova x pessoa já existente reconhecida por e-mail/WhatsApp com nome divergente.
- E0: modo manual x automático; Ligação 1 → 10 min → Ligação 2 → Mensagem; atendeu x não atendeu.
- Caminho normal E0 → E1 → E2 → E3 → E4.
- Caminho V: quando o investidor visualiza sem responder, E2 e E3 mudam de contexto (V2/V3).
- E4: pediu material → E5 imediato → E6 → E7 → E8; não pediu → E7 → E8.
- Compromisso real (AGENDAMENTOS ou VÍDEO com data): congela a cadência; sem compromisso, "atendeu" sozinho não congela.
- Saída do compromisso para FRIOS: abre a série R.
- R: R1 → R2 → R3 → R4; com material já enviado, R2 salta direto para R4; a R3 tem dois textos conforme o lead já tenha passado por E4.
- RE (reentrada): nova data comercial na mesma pessoa abre RE0 → RE1 → RE2 → RE3; sem necessidade de nova apresentação, RE1 vai direto a RE3.
- Fim de jornada: encerramento normal x reaproximação tardia (item 10).
- Portal: acesso, Manual, Material, Simulador, retorno após ausência → aviso na Ação do Dia.

**8. Quantidade mínima de personagens: 8.**
1. E completo sem resposta (E0 não atendido → E1…E4 → E7 → E8).
2. E com material (E4 pede material → E5 → E6 → E7 → E8).
3. Caminho V (visualiza e não responde → E2/E3 em contexto V).
4. E0 atendido sem compromisso (prova que atender não congela).
5. Compromisso real → congelamento → volta a FRIOS → série R completa.
6. Compromisso com material já enviado → R2 saltando para R4.
7. Reentrada: encerra o ciclo, nova data comercial, RE0 → RE1 → RE3, com identidade, responsável e histórico preservados.
8. Portal/Jornada: entra pelo link, é reconhecido, abre Manual, Material e Simulador, retorna depois e gera o aviso na Ação do Dia.
Personagem 5 cobre também RE2 se receber nova apresentação, o que dispensaria um nono personagem.

**9. Cadência + Portal + Jornada + Ação do Dia juntos?** Sim. São as mesmas estruturas oficiais; os personagens têm card, ficha, jornada e obrigações como qualquer lead. A Ação do Dia precisa ser observada com o executivo responsável do lote.

**10. Mensagens 100% fictícias?** Sim, com três travas já existentes e independentes: envio real de WhatsApp bloqueado até 2029 e ainda dependente de autorização explícita; o despachante força simulação para qualquer lead marcado como teste; e o destinatário é verificado antes da saída. O texto exibido continuará vindo da Biblioteca — se quiser literalmente "TESTE E1", isso precisa ser um rótulo de tela do modo teste, não um texto novo na Biblioteca.

**11. Origem GreenSales sem efeito externo?** Parcialmente. A entrada é reproduzida internamente com um pacote de dados equivalente, sem nenhuma chamada ao sistema externo — isso é seguro. **Limitação declarada:** movimentações que só existem lá fora (mudança de coluna/etiqueta feita no GreenSales, agendamento criado por lá) não podem ser homologadas de ponta a ponta; só é possível homologar o que acontece depois que o dado chega. Os personagens precisam de identificadores externos fictícios que jamais colidam com os reais.

**12. Rollback completo?** Quase. A limpeza por lote hoje remove lead, card, ciclo, fila, eventos do motor, decisões, mensagens e linha do tempo. **Lacunas encontradas:** apenas duas tabelas carregam a marcação de teste (leads e cards); registros derivados como jornada e engajamento do Portal, compromissos, notas do executivo, tarefas de cadência, envios registrados e o log do motor não são apagados pela rotina atual. São todos rastreáveis pelo identificador do personagem, então a limpeza pode ser estendida — mas isso é trabalho a fazer, não algo pronto.

**13. Algo impede "nasceram → executaram → morreram → desapareceram"?** Nada impede em definitivo. Três pendências: estender a limpeza às tabelas acima; garantir que o ciclo acelerado seja restrito ao lote; e evitar que a marcação de teste seja perdida quando um card é recriado por sincronização.

**14. Menor estrutura temporária necessária.**
- Um ciclo do motor que aceite uma lista de personagens (mesma lógica, escopo restrito).
- Um executor de dias virtuais: deslocar datas do lote → rodar o ciclo → registrar → repetir, em série.
- Um roteiro de personagens com os desfechos de cada um (atendeu, pediu material, agendou, voltou a frios, reentrou).
- Extensão da limpeza por lote.
- Uma tela simples de acompanhamento por dia virtual (pode ser a listagem de lote já existente).
Nada disso exige tabela nova, motor novo, fila nova nem alteração da régua.

**15. O que a arquitetura atual NÃO garante hoje.**
- Aceleração de tempo dentro da régua da Financeira: não existe; hoje seria por deslocamento de datas dos personagens.
- Ciclo do motor restrito a um lote: hoje o ciclo é global.
- Limpeza total dos registros derivados: incompleta.
- Homologação do lado externo do GreenSales: impossível sem tocar no sistema externo.
- Preservação garantida da marcação de teste em recriações de card por sincronização: não confirmada.

## Item 10 — o caso de longa espera

É o **RF (relacionamento esfriado)**: 20 dias corridos após a última tentativa efetiva de uma jornada encerrada gera o RF0, e 30 dias após a execução real do RF0 gera o RF1, que é terminal. Ele não é continuação de E, R ou RE e não altera nenhuma dessas transições. **Pode ficar de fora da homologação integrada principal** sem prejuízo, e ser validado depois em teste isolado de dois personagens, já que sozinho acrescentaria cerca de 50 dias virtuais ao roteiro.
