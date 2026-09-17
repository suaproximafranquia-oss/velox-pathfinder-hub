# Roadmap

## Lapidações finais — Financeira /f

- [x] Resolver o NOVO de atividade do Portal ao concluir seu alerta, sem afetar NOVO de entrada e sem exigir recarga.
- [x] Adiar somente a disponibilidade inicial da R1 para o próximo dia operacional após AGENDAMENTOS → FRIOS.
- [x] Tornar o Material Institucional a única área condicionada à conclusão do Manual, com liberação manual permanente já autorizada.
- [x] Fazer o link personalizado abrir com o Manual já aberto, preservando token, identidade, responsável, sessão e parâmetros.
- [x] Fixar o contexto da mensagem E0 pelo resultado da primeira ligação, preservando integralmente a régua vigente.
- [x] Remover o cache negativo permanente da Central dos Nomes.
- [x] Validar os cenários focados, tipos, compilação e preview sem alterar módulos fora do escopo (53 testes, tipos e build aprovados; preview sem erro de página/console, com área protegida aguardando sessão).

- [x] /f: remover segundas ligações automáticas de E1/E2 e toda compensação E1→E2, mantendo ligação e mensagem em cards separados.
- [x] /f: reconciliar somente segundas ligações antigas abertas de E1/E2, preservando E0 e todo histórico executado/concluído.
- [x] /f: validar E0 intacta, E1/E2 com uma ligação, E3+ sem regressão, testes focados, tipos, build e acesso normal à Ação do Dia (49 testes e tipos aprovados; build OK; preview chegou ao login corporativo sem erro, sem sessão disponível para inspecionar os cards autenticados).

- [x] /f: E0 de segunda-feira com uma ligação e mensagem contextual; terça a sexta preserva duas ligações e 10 minutos.
- [x] /f: E0 atendida usa CONTATO_REALIZADO, sem contato usa SEM_CONTATO, com cópia sem envio ou conclusão automática.
- [x] /f: reconciliar filas E0 abertas desta segunda-feira sem alterar histórico concluído nem criar duplicatas.
- [x] /f: validar testes focados, tipos, build e recálculo da Ação do Dia sem duplicatas.

- [x] /f marco zero: preservar os 40 leads oficiais, 10 compromissos válidos e as referências de reentrada gs_56503/gs_57906.
- [x] /f marco zero: remover ações, pendências, filas, ciclos e resíduos internos anteriores, sem tocar no GreenSales externo.
- [x] /f marco zero: alinhar Workspace e CRM interno à mesma base oficial e manter atualização automática sem F5.
- [x] Validar contagens finais, vínculos preservados, ausência de resíduos, tipos, testes e compilação.

- [x] /f: remover imediatamente apenas o NOVO do alerta concluído e sincronizar fila + card principal da Ação do Dia sem F5.
- [x] /f: garantir RE0 por nova entrada comercial no motor/fila existentes, por ID canônico, sem coluna NOVOS, duplicação ou reinício de E0.
- [x] /f: aplicar somente os microajustes do Material Institucional e as respostas indicadas exclusivamente no Capítulo 12 do Manual do Investidor Financeira.
- [x] /f: executar reset operacional transacional, preservando leads atuais, compromissos reais, gs_57906 e gs_56503; manter ambiguidades.
- [x] Validar correções, contagens do reset, tipos, testes direcionados e compilação.
- [x] Relatar contagens exatas por categoria, ambiguidades preservadas e confirmação dos compromissos reais após o reset.

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
- [x] /f: link cru reconhece responsável oficial no CTA (sessão oficial do servidor já tem precedência sobre o cache).
- [x] /f: progresso do Manual na Jornada usa a régua existente de capítulos.
- [ ] Formulários públicos Financeira e Solar: entrada comercial na operação correta; rótulo/validação de Cidade coerentes.

- [x] /f: aplicar `result.queue` imediatamente, remover espera fixa e proteger a posição 1 até a resposta oficial.
- [x] /f: continuidade genérica somente para ligação `NAO` com próxima ação real do mesmo lead/etapa.
- [x] /f: manter compromissos passados prioritários, alertas do Portal persistentes e cópia de mensagem sem sobreposição.
- [x] Executar os 14 cenários focados sem tocar dados reais ou outros ambientes (37 testes direcionados passaram; tipos e build OK).

- [x] /f: preparar validação temporal isolada 288x para Ricardo/59034, Eduardo/59037, Francisco/59081 e João/59279, sem tocar a produção.
- [x] Central de Homologação: ativação/desativação persistente, relógio lógico 288x, fila isolada e limpeza por rodada.
- [x] Validar typecheck, build e testes focados sem executar reset geral ou tocar dados produtivos.

- [x] /f: suspender temporariamente somente a criação/recriação local de cards pelo GreenSales, mantendo a integração e o espelho ativos.
- [x] /f: remover cards e derivados operacionais locais fora de Ricardo/59034, Eduardo/59037, Francisco/59081 e João/59279.
- [x] Confirmar exatamente quatro cards, preservar seus dados temporais e não alterar relógio, GreenSales externo ou outros ambientes.

- [x] /f: adicionar Pausar/Continuar ao relógio ambiental 720x usando a linha `environment-clock-f`, com estado persistente e transições condicionais.
- [x] /f: manter allowlist dos quatro leads, Voltar ao tempo real e integrações operando durante a pausa.
- [x] Validar avanço, congelamento, retomada sem salto, idempotência/concorrência, tipos, testes relacionados e build (6 testes focados e tipos passaram; build automático OK).

- [x] Biblioteca de Mensagens: atualizar exclusivamente o CHECK de `step_context` para a lista fechada oficial.
- [x] Aplicar a migration e validar os sete valores permitidos mais um valor arbitrário rejeitado, sem deixar registros artificiais.
- [x] Executar typecheck e confirmar que nenhuma outra área foi modificada.

- [x] Financeira /f: alinhar o plano compartilhado de ações da Ação do Dia ao mapa definitivo E/V/R/RE/RF, sem alterar cadência ou transições.
- [x] Financeira /f: manter mensagens dinâmicas por etapa e contexto vigente na Biblioteca, preservando E5/RE2 manuais e RE0/RF conforme o mapa.
- [x] Financeira /f: desacoplar abertura e conclusão do modal do clipboard, tornar o painel opaco e validar etapas, contextos, tipos, testes e build.
- [x] Financeira /f: garantir ligação antes da mensagem na mesma etapa e concluir E5/RE2 manuais pela fila existente, preservando compensações e posição 1.
- [x] Financeira /f: validar Biblioteca vigente no clique, contextos V2/V3/E6/E7/E8, URL idempotente e modal aberto mesmo com falha do clipboard (73 testes direcionados e build automático OK).

- [x] Financeira /f: tornar o corpo publicado a única fonte da mensagem, sem exigir ou inserir link separado.
- [x] Biblioteca de Mensagens: remover da interface os campos de link e rótulo, preservando colunas e histórico existentes.
- [x] Validar E1 com/sem URL no corpo, ausência de inserção automática, versão vigente no clique, URL idempotente e modal após falha do clipboard.

- [x] /f: desconectar consumidores produtivos do relógio ambiental e restaurar exclusivamente o tempo real.
- [x] /f: desconectar gate/allowlist temporários da materialização normal e remover seus cartões da Central de Homologação.
- [x] Preservar correções reais, migrations e todos os dados; validar tipos, testes focados, build e existência dos quatro leads sem escrita no banco.

- [x] /f: controles administrativos ON/OFF dos seis cards do Portal, persistidos na configuração existente, sem afetar o Portal Solar.
- [x] /f: remover apenas os dois atalhos obsoletos da Central de Homologação.
- [x] /f: concluir alerta do Portal atualizando somente a novidade correspondente e ordenar claim, emergência, alerta, E0, atrasados e ações do dia.
- [x] Validar os fluxos direcionados, domingo, isolamento dos demais ambientes e compilação (47 testes focados e tipos passaram; build automático OK; inspeção autenticada não disponível por ausência de sessão).

- [x] /f: liberar temporariamente apenas o bloqueio manual da Ação do Dia em 13/09/2026, até antes de 14/09/2026 00:00:00 (America/Sao_Paulo).
- [x] Validar expiração automática e preservação integral da regra permanente de domingo, fila e ações futuras.

- [x] /f: consolidar E6 em contexto editorial único COM_NOME/SEM_NOME, preservando versões contextuais antigas como histórico.
- [x] /f: reler o nome atual do lead em cada preparação de mensagem pelo resolvedor existente, sem alterar snapshots.
- [x] /f: tratar o agendamento original como pendência de desfecho comparecimento + novo agendamento, sem revisão automática de 24h.
- [x] Validar prioridades, domingo, E7/E8 e testes/compilação sem tocar os ambientes e fluxos protegidos (67 testes focados e tipos aprovados).

## Lapidação final das jornadas R e RE — Financeira /f

- [x] Ampliar R para R1 → R2 → R3 → R4 → R5, com R3/R5 contextuais, R4 somente após envio manual e R5 terminal.
- [x] Ampliar RE para RE0 → RE1 → RE2 → RE3 → RE4 → RE5, usando histórico CONTENT_SENT e o motor/fila existentes.
- [ ] Organizar e publicar os conteúdos aprovados de R/RE na ordem operacional, preservando versões e histórico. Bloqueio: os registros encontrados estão incompletos ou trocados; faltam textos oficiais confiáveis para R5, RE4 e RE5.
- [x] Validar transições, contextos, reentrada, Biblioteca, tipos, testes e compilação sem tocar dados reais.

## Lapidação pontual da Home Financeira /f

- [x] Persistir e refletir os seis controles do Portal pela configuração oficial do servidor, sem afetar o Solar.
- [x] Impedir a montagem parcial da Home Financeira enquanto os dados essenciais carregam.
- [x] Substituir somente a resposta sobre exclusividade de território.
- [x] Validar os três pontos com testes direcionados, tipos e compilação (2 testes passaram; tipos e build automático OK).

- [x] /f Portal Leads: listar todo o universo oficial de `crm_leads` GreenSales, mesclando apenas o estado dos cards existentes.
- [x] /f Portal Leads: manter leads sem card sem ações operacionais, E0, cadência, fila ou criação de `portal_leads`.
- [x] Validar contagem do universo, 43 cards preservados, zero duplicidade/novas obrigações e compilação/testes (570 no espelho, 43 cards, 0 filas, 0 cadências ativas, 0 IDs duplicados; 27 testes e tipos aprovados).

## Correção cirúrgica E0 e Material Institucional — Financeira /f

- [x] Corrigir `enteredNow` com marcador operacional existente, preservando idempotência, históricos e reentrada.
- [x] Recuperar pelo fluxo oficial os leads NOVOS elegíveis sem E0 e confirmar ausência de duplicidades (28/28 com obrigação inicial única).
- [x] Trocar os dois placeholders por imagens editoriais editáveis e ajustar somente as legendas indicadas.
- [x] Fazer o CTA final usar o responsável da sessão reconhecida, mantendo o cadastro como fallback.
- [x] Validar testes focados, sessão, slots, tipos e compilação sem alterar as áreas protegidas (21 testes e build aprovados).

## Domínio público oficial da Financeira /f

- [x] Centralizar `https://portalvelox.com.br` como origem pública da Financeira, preservando local e homologação.
- [x] Ajustar os geradores existentes do Portal personalizado, convite E5 e material padrão sem alterar caminhos ou tokens.
- [x] Confirmar Manual, Material, Simulador e CTA público pela mesma fonte central, sem tocar assets ou outras marcas.
- [x] Validar testes focados, tipos e compilação (11 testes e tipos aprovados; build automático OK).

## Correção da execução pública de `can_access_e0_action`

- [x] Revogar `EXECUTE` de `PUBLIC` e `anon`, preservando `authenticated`.
- [x] Confirmar as permissões efetivas sem alterar função, RLS ou fluxo E0.
- [x] Validar E0, consulta da Ação do Dia, testes focados, tipos e compilação (43 testes focados e tipos aprovados; build automático OK). Um teste legado adicional mantém falha preexistente isolada em `actionRank`, sem relação com permissões ou consulta.

## Separação de origem e telefone na Ação do Dia — Financeira /f

- [x] Separar a origem corrente da aplicação da origem pública externa da Financeira, sem redirecionar editor, preview ou navegação interna.
- [x] Manter Portal personalizado, Manual, Material, Simulador, CTAs e convite E5 em `https://portalvelox.com.br`, preservando caminhos e tokens.
- [x] Formatar somente a exibição do telefone no card da Ação do Dia, sem alterar banco, `tel:`, `wa.me`, validações ou lógica E0.
- [x] Validar testes focados, preview Lovable, navegação interna, tipos e compilação (8 testes e tipos aprovados; preview permaneceu em sua própria origem, sem erros; build automático OK).

## Cópia de mensagem na Ação do Dia — Financeira /f

- [x] Abrir a janela com a mensagem oficial antes da única tentativa automática de cópia.
- [x] Manter o resultado visível e a segunda tentativa manual, sem concluir ou registrar a ação ao copiar.
- [x] Validar preview, testes focados, tipos e compilação (8 testes e tipos aprovados; build OK; preview abriu normalmente, com a área autenticada indisponível sem sessão ativa).

## Runtime publicado da Financeira /f

- [x] Corrigir a entrada do servidor e ativar o empacotador oficial da Hospedagem Lovable, sem alterar rotas ou regras operacionais.
- [x] Validar preview, tipos, compilação e testes focados da Ação do Dia (15 testes aprovados).
- [ ] Confirmar `/`, `/f`, `/f/executivo` e `/_serverFn/*` no domínio oficial após a nova publicação assumir o tráfego. Bloqueio: a conferência única ainda recebeu o pacote anterior (`content_hash` inalterado), com `502` durante a propagação.


## Lapidação final — E5, material pós-contato, links e asset override
- [x] Consolidar identidade operacional E5 sem alterar históricos E20.
- [x] Corrigir placeholders permitidos da apresentação mantendo bloqueio de desconhecidos.
- [x] Adicionar finalidade versionada e ação manual universal de envio de material.
- [x] Centralizar links normais do investidor no Manual; preservar convite exclusivo.
- [x] Tornar substituição de override transacional e segura.
- [x] Validar testes focados, tipos, build e preview (30 testes focados e build automático aprovados; `/f/executivo` abriu sem erro de página/console e apresentou o login corporativo, pois a sessão injetada não foi reconhecida pela aplicação).

- [x] Corrigir E0 SIM para encerrar sem SEM_CONTATO; preservar NAO e demais fluxos; validar testes/typecheck/build/preview (35 testes focados, tipos e build aprovados; preview sem erro de página/console, com área protegida aguardando sessão).

## Correção cirúrgica — data operacional e reconciliação viva da Ação do Dia
- [x] Fixar a data operacional e a estrutura da E0 pela entrada real, incluindo corte das 18:00 e fim de semana.
- [x] Preservar continuidade, ordenação cronológica por entrada e ação PROCESSING durante a releitura silenciosa.
- [x] Neutralizar pendências incompatíveis de forma seletiva, auditável e idempotente, preservando E0 sem primeiro contato.
- [x] Validar cenários A–R, tipos, build e preview de /f, sem deploy ou alterações nas áreas protegidas (94 testes focados, tipos e build aprovados; preview sem erro de página/console, com área protegida no login corporativo).

## Comando C — Agenda + link curto individual (/f)

- [x] Adicionar Agenda lateral compacta e somente leitura à Ação do Dia, usando compromissos existentes e atualização silenciosa de 3 minutos.
- [x] Implementar navegação visual por dia e os oito slots operacionais, sem alterar fila, cadência, lead ou compromissos.
- [x] Expor e copiar o link curto do executivo autenticado a partir do slug oficial, preservando o Portal e links existentes.
- [x] Validar testes focados, tipos, build, preview e console, sem publicar nem alterar áreas protegidas (19 testes focados e tipos aprovados; Preview validado sem erro após iniciar o servidor; build automático aprovado).

## Comando D — simplificação do núcleo da Ação do Dia (/f)

- [x] Fixar a prioridade oficial: agendamentos/compromissos prioritários → alertas → E0/RE0 → atrasadas → normais, incluindo entradas após 18h e preservando claimed/PROCESSING.
- [x] Unificar E0–E4 e equivalentes existentes em uma ligação seguida da mensagem oficial, preservando histórico e neutralizando apenas segundas ligações abertas.
- [x] Manter ligação e mensagem como uma única experiência no card atual, com contexto automático e conclusão somente no botão Concluído.
- [x] Restringir a cadência normal a ZERO_CONTATO/FRIO, preservar a exceção inicial da E0 e reconciliar toda a fila a cada leitura oficial.
- [x] Reancorar E1–E4 exclusivamente na execução real anterior, contando o intervalo a partir do dia seguinte, e ajustar pendências futuras existentes sem duplicação.
- [x] Corrigir somente o status visual da Agenda para LIVRE, OCUPADO ou INDISPONÍVEL.
- [x] Validar testes focados e relacionados, tipos, build e Preview de /f e /f/executivo, sem publicar nem alterar áreas protegidas (114 testes, tipos, build e Preview aprovados; /s, /s/portal e /seg intactos; sem publicação).

## Correção universal da mensagem após ligação positiva — Financeira /f

- [x] Resolver SIM/ATENDEU em E0, E1, E2/V2, E3/V3, E4, E7, R1, R2, RE0, RE1 e RE3 pela finalidade existente `ENVIO_MATERIAL_POS_CONTATO`.
- [x] Preservar a mensagem específica da etapa/contexto para NÃO ATENDEU, sem alterar versões publicadas ou histórico.
- [x] Tornar RE0 e RE3 ligação + mensagem e preservar R1/R2 como ligação + mensagem no mesmo card, sem nova etapa, prazo ou relógio de cadência.
- [x] Garantir que modal, conclusão e snapshot usem a mesma mensagem resolvida automaticamente.
- [x] Validar cenários positivos e negativos, tipos e build, sem publicar nem tocar áreas protegidas (93 testes focados, tipos e build aprovados; `/s`, `/s/portal` e `/seg` intactos).

## Correção do reaparecimento da mensagem no mesmo card — Financeira /f

- [x] Impedir que tick/reconciliação rebaixe `PROCESSING` ou `EXECUTED` para `PENDING` ao materializar a mesma chave oficial, preservando reativação legítima de item neutralizado.
- [x] Permitir que retry da conclusão composta retome somente a mesma ligação já executada com o mesmo resultado e encerre a mensagem da mesma execução.
- [x] Validar E0 SIM/NAO, reconciliações repetidas, reload, duplicidade, múltiplos leads, caso Thyana somente leitura, testes focados, tipos, build e Preview, sem publicar (139 testes aprovados; tipos, build e Preview OK; Thyana permanece com uma ligação e uma mensagem E0 `EXECUTED`, sem nova pendência; área executiva aguardou sessão corporativa).

## Consolidação da Apresentação Digital com Mux

- [x] Separar a configuração administrativa da experiência pública, mantendo somente a Financeira e uma única rota de configuração.
- [x] Persistir o Playback ID do Mux na apresentação vigente e no histórico, preservando o campo antigo apenas como histórico inativo.
- [x] Renderizar a apresentação pública pelo convite validado, sem Manual, capítulos, `m=manual` ou redirecionamento automático para `/f`.
- [ ] Validar testes focados, tipos, build e Preview com convite válido, inválido e expirado, sem publicar.

## Correção da Apresentação Digital interna e na Workspace

- [x] Fazer menu interno e cartão da Workspace abrirem a mesma experiência da Apresentação Digital, sem redirecionamento ao Manual.
- [x] Tornar a ausência de `videoUrl` um estado válido com título, legenda e placeholder, sem iframe social.
- [x] Preservar a rota pública de convite, Biblioteca, cadência, CRM, Agenda e banco.
- [x] Validar testes focados, tipos e build; Preview público sem erros e validação autenticada bloqueada pelo login corporativo local (5 testes, tipos e build aprovados; nada publicado).

## Finalização visual da Apresentação Digital — Financeira

- [x] Usar a fotografia institucional anexada como fundo em cover, com tratamento azul-marinho e contraste para o conteúdo.
- [x] Refinar título, vídeo e legenda da experiência pública, preservando integralmente Mux, convite e dados.
- [x] Adicionar continuação direta para `https://portalvelox.com.br/f`, sem depender do histórico do navegador.
- [x] Validar testes focados, tipos, build e Preview desktop/mobile, sem publicar (12 testes e tipos aprovados; build OK; fundo, legenda e destino confirmados sem overflow; o Chromium automatizado manteve o erro de codec conhecido do arquivo Mux, sem alteração no player).

## Integração Encerrar/Reabrir — Portal, TikTok e Meta
- [x] Integrar `closed_at` ao motor V2 apenas para Portal/TikTok/Meta e neutralizar obrigações abertas sem convertê-las em execução.
- [x] Reabrir a mesma instância pela execução real, materializando somente a obrigação correta e idempotente.
- [x] Preservar Pular, histórico, snapshots, GreenSales e todos os módulos fora do escopo.
- [x] Validar cenários A–M, tipos, build e Preview sem publicação ou alteração de dados reais (91 testes focados, tipos e build aprovados; `/f` abriu sem erro de página/console; nenhum dado real foi alterado).

## Blindagem única da Ação do Dia

- [x] Separar o card efetivamente ativo dos registros apenas persistidos como `PROCESSING`.
- [x] Preservar somente uma ação ativa nas releituras e ordenar as demais pela hierarquia oficial.
- [x] Validar cenários A–J, tipos, build e Preview sem publicação ou alteração de dados reais (69 testes focados, tipos e build aprovados; `/f` respondeu 200 sem erro recente no servidor; a sessão autenticada não estava disponível para abrir os cards).

## WhatsApp no modal de mensagem da Ação do Dia

- [x] Substituir somente o “Ver ficha completa” do modal de mensagem por abertura manual do contato no WhatsApp.
- [x] Reutilizar o telefone da ação e a normalização central, sem texto preenchido, envio ou transição operacional.
- [x] Validar testes focados, tipos e build sem publicar (37 testes aprovados; Preview autenticado chegou à entrada operacional, mas o usuário injetado não tinha acesso aos cards para inspeção do segundo modal).

## Modo Janela — cópia silenciosa da mensagem

- [x] Manter a abertura e as duas tentativas de cópia separadas de qualquer conclusão ou avanço operacional.
- [x] Remover confirmações de sucesso e exibir somente `Mensagem não foi copiada.` quando uma tentativa falhar.
- [x] Validar testes focados, tipos e build sem publicação (133 testes relacionados e tipos aprovados; build automático OK; Preview autenticado permanece condicionado à sessão operacional).

## Semântica dos intervalos da cadência V2

- [x] Garantir em uma única origem que `days: N` represente deslocamento direto de N datas corridas desde a execução anterior.
- [x] Preservar os intervalos e condições comerciais existentes de E, R e RE, aplicando o calendário operacional somente após a data teórica.
- [x] Cobrir +1, +2, +3, +4, +5 e +7, incluindo segunda, quarta, sexta, sábado/domingo e consistência entre consumidores.
- [x] Validar somente testes focados da cadência, tipos e build, sem publicação (133 testes relacionados e tipos aprovados; build automático OK).

## Agenda e ligação/mensagem na mesma etapa

- [x] Acrescentar os blocos 12h–13h e 18h–19h à Agenda, preservando a ocupação por sobreposição.
- [x] Manter todas as etapas compostas ativas após SIM/ATENDEU até a mensagem da mesma etapa ser concluída.
- [x] Validar testes focados, tipos, build e Preview sem publicação (112 testes e tipos aprovados; build automático OK; `/f` abriu sem erro de página, mas a sessão disponível permaneceu na página pública e não expôs a Agenda autenticada).
