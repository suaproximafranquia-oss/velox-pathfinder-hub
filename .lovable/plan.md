# Corrigir a Apresentação Digital interna e na Workspace

## Objetivo
Fazer as duas entradas internas da Financeira abrirem a mesma experiência de Apresentação Digital, inclusive quando ainda não há vídeo cadastrado, sem tocar na apresentação pública por convite nem em regras operacionais.

## Alterações
- Extrair da tela existente uma visualização reutilizável da Apresentação Digital com cabeçalho, área 16:9, legenda/contexto e estado vazio válido.
- Manter `videoUrl` opcional: sem URL, mostrar somente o espaço reservado; com futura URL própria de storage/CDN, usar o player nativo de vídeo.
- Fazer a entrada do menu interno e o cartão da Home da Workspace apontarem para o mesmo handler/rota, sem passagem pelo Manual do Investidor.
- Preservar edição, publicação, permissões e histórico existentes, sem Instagram, YouTube ou fallback social.
- Não alterar `portal/convite/$token`, Biblioteca, cadência, CRM, Agenda ou banco.

## Validação
- Testes focados das duas entradas, abertura sem vídeo e fechamento.
- Confirmar que nenhum iframe é criado sem `videoUrl`.
- Confirmar a rota pública de convite sem alterações.
- Executar typecheck e validar o build automático.
- Conferir no Preview as duas entradas autenticadas quando houver sessão disponível.
