# Lapidação final cirúrgica — E5, material e imagens

## Objetivo
Consolidar E5 como identidade atual da apresentação, adicionar a preparação manual e universal de material e tornar links e substituições de imagens seguros, sem alterar cadência, históricos ou ambientes protegidos.

## Implementação

1. **Identidade E5 e apresentação existente**
   - Exibir a apresentação atual como **E5 — Apresentação digital / entrega do material** no painel e nos rótulos operacionais.
   - Fazer a geração consultar a mensagem ativa de E5, mantendo `relationship_e20_*`, tokens, snapshots, validade de sete dias e registros antigos como compatibilidade física/histórica.
   - Preservar E6 exclusivamente como acompanhamento pós-apresentação e manter E20 fora da identidade operacional atual.

2. **Variáveis da apresentação**
   - Reutilizar o renderizador oficial e resolver, no servidor, nome/tratamento, responsável e links permitidos pelo conteúdo ativo de E5.
   - Aceitar os nomes técnicos oficiais de link já usados pela Biblioteca, apontando links normais para o Manual.
   - Manter o bloqueio integral para qualquer `{{variável}}` desconhecida ou sem valor.

3. **Envio de material após contato**
   - Criar a finalidade estável `envio_material_pos_contato`, versionada na Biblioteca e separada das etapas da cadência.
   - Inserir somente a versão inicial informada, sem tocar versões ou textos de R/RE.
   - Na ficha do lead, adicionar a operação independente ao lado da apresentação; no clique, reler o lead e o responsável no servidor, recalcular o tratamento, buscar a versão ativa e abrir revisão/cópia.
   - Copiar não enviará, não gravará snapshot de envio, não concluirá ação, não mudará etapa/status/vencimento e não criará apresentação ou cadência.

4. **Fonte única dos links normais do investidor**
   - Centralizar em uma função semântica da Financeira a URL `https://portalvelox.com.br/f/{slug}` com abertura direta do Manual pelo mecanismo oficial.
   - Fazer E0 `CONTATO_REALIZADO`, a nova finalidade e demais geradores normais da Financeira usarem essa função.
   - Preservar como exceção o convite exclusivo da apresentação, com token e validade próprios; não alterar Solar, Seguros, preview ou navegação interna.

5. **Substituição segura de imagens**
   - Fazer upload do novo arquivo, persistir e confirmar o novo override antes de remover somente o arquivo do override anterior.
   - Em falha, manter o override anterior e limpar apenas o novo upload órfão quando seguro.
   - Atualizar a imagem salva diretamente para a nova referência, sem piscar para o asset original, e nunca remover o asset de fábrica.

## Validação
- Criar testes focados para identidade E5/E6/E20, placeholders conhecidos e desconhecidos, versão ativa/nome/tratamento/responsável da ação universal, URL central do Manual, exceção do convite, ausência de efeitos operacionais e troca segura de override.
- Confirmar que a ação Pós-apresentação e os textos/bindings R1–R5 e RE0–RE5 permanecem intactos.
- Executar testes focados, verificação de tipos, build automático e preview em `/f`.

## Limites
- Sem mudanças em `/s`, `/s/portal`, `/seg`, GreenSales, Portal Leads, autenticação, domínio, hospedagem, segurança, cadência E0–E8, R/RE ou históricos gravados.
- Sem publicação/deploy neste patch.
