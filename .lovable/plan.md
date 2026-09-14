# Perfil determinístico e slots editoriais da Financeira

## Escopo
- Alterar somente a experiência Financeira solicitada: Manual/Ficha em `/f` e modo editor de `/universo` por unidade.
- Preservar dados históricos, regras comerciais, cadências, permissões, textos e imagens atuais.

## 1. Leitura determinística do investidor
- Criar um módulo puro e testável para normalizar as respostas reais do Capítulo 13, atribuir 0/1/2 pela posição orientada a cautela/intermediação/execução, somar o score e mapear as cinco faixas e seus textos fixos.
- Persistir Capítulo 6 e Capítulo 13 dentro de `portal_leads.journey.investorProfile`, mesclando profundamente com o JSON já existente e validando o token do próprio investidor no servidor.
- No Capítulo 6, manter salvar e “Pular e continuar”, conservar o evento real existente e remover somente a criação do comentário “IA Corporativa”.
- No Capítulo 13, salvar todas as respostas efetivamente selecionadas, score, perfil e intenção final; manter o evento real da jornada e substituir a leitura livre atual pelo resultado determinístico.
- Disponibilizar o perfil persistido para leitura autenticada na Ficha, sem depender do navegador onde o Manual foi preenchido.
- Remover a aba “IA Corporativa”, seus quatro blocos e os dois acessos “Gerar PDF” da Ficha. Manter “Relatório” e substituir seu conteúdo pela leitura curta solicitada, exibindo apenas dados declarados ou “Não informado”.

## 2. Slots editoriais por posição
- Registrar oito chaves estáveis de posição, com rótulo, asset original e chave legada compatível.
- Resolver cada imagem pela precedência: alteração pendente/específica da posição → override específico salvo → override legado do asset → imagem original.
- Adicionar identificação `data-portal-asset-slot` às imagens dos painéis e da galeria sem alterar layout, ordem, proporção, legenda ou conteúdo.
- Fazer o editor localizar primeiro a imagem diretamente pelo slot no DOM, mantendo a busca por URL apenas como compatibilidade para slots antigos.
- Preservar autorização do servidor, isolamento por unidade, pré-visualização, remoção, “Salvar alterações” e “Descartar”. Nenhum override será migrado, apagado ou resetado.

## Validação
- Testes unitários das cinco faixas, estabilidade do score, persistência mesclada do JSON e ausência de comentário artificial.
- Testes dos oito slots, precedência específica/legada/original e independência entre posições que compartilham asset.
- Verificar a Ficha sem “IA Corporativa”/“Gerar PDF” e com o novo Relatório.
- Verificar visualmente os oito controles no modo editor autorizado quando houver sessão disponível.
- Executar testes direcionados, verificação de tipos e confirmar a compilação automática.
