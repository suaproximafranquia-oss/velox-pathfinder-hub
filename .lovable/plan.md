# Diagnóstico — reconhecimento de investidor existente pelo link cru em /f

## Qual é a regra atual

A decisão está inteiramente no servidor, na função de identidade do banco chamada por `resolvePortalIdentity` (`src/lib/portal-identity.functions.ts:90–232`):

1. Normaliza WhatsApp (últimos 11 dígitos) e e-mail (minúsculo, sem espaços). Sem nenhum dos dois válidos, a entrada é recusada.
2. Procura cadastro existente **primeiro pelo WhatsApp**, depois pelo e-mail. Entre candidatos, prefere quem já tem relacionamento iniciado, depois a atividade mais recente.
3. **O nome não participa da busca.** Se o cadastro é encontrado com nome diferente, o nome digitado é guardado apenas como alternativa; o nome oficial não é substituído.
4. Encontrando cadastro, devolve o identificador oficial com `recognized: true` e **não altera responsável comercial, escopo, origem nem histórico** — a atualização se limita a alternativas, marcação de divergência e horário de atividade.
5. Só cria cadastro novo quando nenhuma das duas buscas encontra nada.

**Confirmação nos dados reais de Rafael (`gs_59275`), sem alterá-los:** o registro contém uma entrada de nome alternativo e um evento `identity.recognized` de 10/09/2026 às 09:31:58 (São Paulo). Ou seja, no teste com nome divergente o servidor reconheceu o Rafael existente e não criou card novo.

## Ela está correta?

**Para a identidade, sim; para o que o investidor vê, não.**

A regra de identidade atende exatamente ao pedido: identificadores oficiais mandam, nome divergente não bloqueia, cadastro e responsável são preservados. Isso explica a parte positiva do teste — nenhum card "Pedro" foi criado.

A falha está na etapa seguinte, no navegador:

- **Tela de boas-vindas:** o Gateway só oferece "continuar como reconhecido" quando já existe identificação guardada no próprio navegador (`src/components/portal/gateway-overlay.tsx:106–134`). Pelo link cru em navegador sem esse histórico, o formulário aparece sempre, mesmo que o cadastro exista. A consulta de reconhecimento é usada apenas para confirmar o palpite local, nunca para descobri-lo.
- **Sessão após identificar:** no caminho reconhecido de `/f` (`src/lib/portal-session.ts:213–230`), a sessão é montada a partir do mesmo armazenamento local. Sem ele, a sessão fica com o nome digitado ("Pedro") e sem o executivo responsável, porque o servidor devolve apenas o identificador, sem nome nem responsável.
- Consequência já observada: sem esses dados locais, o Portal também não consegue obter a credencial que autoriza o registro da jornada, então Manual, Material e Calculadora continuam aparecendo como não iniciados.

Portanto: **o reconhecimento acontece e é correto; ele simplesmente não é comunicado ao investidor nem à sessão quando o navegador não tem histórico próprio.**

## Menor correção necessária

**Fazer o retorno reconhecido do servidor abastecer a sessão, em vez do armazenamento do navegador.** No caminho `/f`, quando a identidade é reconhecida, devolver junto o mínimo necessário para continuidade — nome oficial de exibição, executivo responsável e a credencial da jornada — e montar a sessão com isso.

Isso já respeita as travas existentes: a devolução ocorre apenas para quem comprovou e-mail e WhatsApp do próprio cadastro, e continua sem expor histórico, mensagens, escopo comercial ou dados de terceiros.

Não é necessário mudar a regra de identidade, tornar o nome autoridade, criar tabela, fila, motor ou arquitetura, nem recriar/mover card, responsável ou origem. Nenhum código ou dado foi alterado; este documento é somente diagnóstico.
