# Consolidar Apresentação Digital com Mux

## Objetivo
Separar definitivamente a configuração administrativa da experiência pública, usando uma única apresentação vigente da Financeira e mantendo intactos o token, a validade e a geração dos convites existentes.

## Alterações
- Adaptar a configuração vigente de `environment_presentations` para guardar `mux_playback_id`, preservando `video_url` apenas como histórico inativo e mantendo publicação/histórico.
- Simplificar `/f/executivo/apresentacao-digital` para Financeira: Playback ID do Mux, texto de contexto, Publicada, Salvar e acesso à experiência real do convite; sem player, Solar ou Seguradora.
- Fazer o cartão da Home navegar para essa mesma tela administrativa, sem modal paralelo.
- Após a validação atual de `/portal/convite/$token`, carregar a apresentação publicada da Financeira e renderizar uma página pública exclusiva com Mux Player, contexto, carregamento, placeholder sem ID e erro amigável.
- Remover dessa rota somente os redirecionamentos para `/f` com `m=manual` e a apresentação por capítulos, sem alterar emissão, token, expiração, vínculo ou auditoria do convite.
- Não usar Instagram, YouTube, iframe social ou MP4 bruto como fonte principal.

## Dados e segurança
- Migration mínima adicionando `mux_playback_id` às tabelas vigente e histórica, sem apagar `video_url` nem outros dados.
- Leitura pública limitada à apresentação publicada da Financeira; escrita continua protegida pela autorização administrativa existente.
- O Playback ID fornecido será usado em testes controlados, não gravado como conteúdo oficial sem uma ação administrativa explícita.

## Validação
- Testes focados da configuração, persistência contratual, Home, convite válido/inválido/expirado, ausência de ID, erro do player e eliminação de `m=manual`.
- Typecheck, build automático e inspeção do Preview, console, requests e redirecionamentos.
- Teste com convite real vigente quando houver acesso seguro, sem alterar dados reais de leads.
- Confirmar que Biblioteca, E/R/RE, cadência, Ação do Dia, CRM, GreenSales, Agenda, Workspace de leads, Manual e geração/validação de convites permaneceram intactos.
