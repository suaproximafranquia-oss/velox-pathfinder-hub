# Lapidação pontual da Home Financeira `/f`

## Implementação

- Manter os seis módulos do Portal do Investidor na configuração existente do servidor, com gravação exclusiva do Administrador.
- Após salvar, propagar uma notificação local e fazer a Home Financeira reler o estado oficial, sem transformar o navegador em fonte de verdade.
- Na Home `/f`, aguardar a visibilidade oficial e os demais dados iniciais já carregados antes de exibir a página completa; durante a espera, mostrar um estado de carregamento estável.
- Aplicar essa espera e essa visibilidade somente à Financeira. O Portal Solar continuará independente.
- Substituir exclusivamente a resposta de “Existe exclusividade de território?” pelo texto fornecido, sem alterar outras perguntas ou respostas.

## Validação

- Confirmar salvamento e releitura dos seis controles, atualização sem F5 e isolamento do Portal Solar.
- Confirmar que a Home não exibe módulos parciais durante a carga.
- Executar testes direcionados, verificação de tipos e conferir a compilação automática.
