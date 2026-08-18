# Fonte única no servidor e reset operacional seguro

## Objetivo
Eliminar estados operacionais exclusivos do navegador sem alterar layout ou regras homologadas. O reset real permanece bloqueado até a persistência servidor ser validada e o lead protegido ser confirmado por identificador estável.

## Diagnóstico confirmado
- Leads do Workspace ainda são lidos de `localStorage` e o pull atual reincorpora registros `localOnly`.
- Ownership, status visual/encerramento, estado comercial/arquivamento, janela de relacionamento, eventos, reuniões e leads privados ainda possuem fonte operacional local.
- Mensagens e timeline existem no servidor, mas são mescladas com histórico local e a fila de gravação pode se perder antes do envio.
- Pipeline/Board/Coluna e a Data de Ativação da Cadência já estão persistidos no servidor; a posição atual é resolvida por coluna, mantendo tags apenas como informação.
- O banco contém um lead recente chamado `Thiago`, ID `ld_msy1onox18t1`, com primeiro contato e histórico. Não existe correspondência literal `Thiago Rodrigues`; nenhuma exclusão será permitida até confirmar esse ID como o lead protegido.

## Implementação

### 1. Modelo operacional no servidor
- Criar estrutura persistente para o Workspace/CRM com: proprietário oficial, estado comercial, visualização/encerramento, privacidade, observações e âncoras da janela de relacionamento.
- Persistir eventos operacionais hoje mantidos no bus local e reuniões hoje mantidas apenas no navegador.
- Aplicar GRANTs, RLS por responsável/gestão e índices de leitura; preservar políticas existentes.
- Fazer backfill somente aditivo a partir das tabelas já persistidas. Não importar dados do navegador e não apagar registros.

### 2. Leitura e escrita server-first
- Criar server functions autenticadas e finas para listar e alterar Workspace, ownership, status, relacionamento, eventos e reuniões.
- Converter ações operacionais para aguardar confirmação do servidor; cache local não poderá confirmar sucesso nem restaurar registros ausentes no banco.
- Remover `localOnly` do merge de leads. Limpar storage deixará apenas a interface vazia durante carregamento e, em seguida, reconstruirá tudo pelo servidor.
- Mensagens/timeline passam a ler substituição autoritativa do servidor, sem mesclar registros locais desconhecidos; gravações deixam de depender do debounce em memória.
- Manter local apenas: sessão/autenticação, preferências visuais, rascunhos e cache descartável.

### 3. Separação das camadas
- Portal dos Leads continua como espelho da origem.
- Workspace passa a fornecer a carteira operacional persistida.
- CRM lê e altera exclusivamente essa carteira; não dispara cadência diretamente do espelho do Portal.
- Cadência continua sem retroatividade e desabilitada quando não houver Data de Ativação.

### 4. Compatibilidade e proteção
- Preservar usuários, perfis, permissões, templates, Biblioteca, Revista, configurações e dados reais.
- Não criar seeds, mocks, leads ou mensagens artificiais.
- Desabilitar os resets locais como operações operacionais; homologação local só poderá limpar preferências/artefatos explicitamente não operacionais.
- Adicionar testes para coluna sobre tag, ausência de ativação, histórico anterior à ativação e transição real para Novos.

### 5. Validação obrigatória antes do reset
- Comparar snapshots de dados retornados pelo servidor em dois contextos isolados de navegador autenticados com a mesma conta.
- Limpar cookies/cache/storage de um contexto, autenticar novamente e confirmar o mesmo snapshot.
- Executar uma alteração operacional reversível em um contexto e comprovar a leitura no outro.
- Validar mensagens, timeline, ownership, estado, posição, reuniões, jornada, cadência e eventos.
- Confirmar no banco que nenhuma linha foi apagada durante esta fase.

### 6. Reset real — etapa separada e bloqueada
- Primeiro executar somente dry-run no servidor, com contagens e IDs candidatos por tabela.
- Proteger o lead confirmado por ID estável e excluir também seus relacionamentos do conjunto candidato. Nunca proteger apenas por nome.
- Gerar snapshot de segurança e hash do escopo antes da execução.
- Exigir aprovação explícita do relatório de dry-run; somente depois executar uma rotina transacional no servidor.
- Validar contagens pós-reset e provar que cadastro, posição, mensagens, timeline, eventos, cadência e jornada do lead protegido permanecem idênticos.

## Critérios de conclusão
- Dois navegadores exibem o mesmo estado e uma limpeza local não altera dados.
- Toda mutação operacional confirmada num navegador aparece no outro.
- Pipeline/Board/Coluna continua governando a posição; tags não governam fluxo.
- O reset local não existe como reset operacional.
- Nenhuma exclusão ocorre antes da validação e da aprovação do dry-run.
- O lead protegido é preservado integralmente por ID confirmado.
