# Titularidade GreenSales — Financeira /f

Hoje todo lead novo do GreenSales acaba atribuído a Thiago Rodrigues. O card é criado corretamente na entrada, mas o dono fica errado, então os demais executivos não enxergam os próprios investidores.

## Causa confirmada

- Nenhum dos sete executivos tem o código de vendedor do GreenSales preenchido no cadastro (campo existe, está vazio para todos).
- Sem esse código, a entrada usa um caminho reserva: assume o usuário da conexão do GreenSales (Thiago) como responsável.
- Com o dono errado, a regra de visibilidade do banco esconde o card de quem não é o dono nem administrador.

## O que será feito

1. **Cadastro do código de vendedor na tela de Usuários**
   - Campo "Código GreenSales" passa a ser gravado no servidor, junto de nome, e-mail e WhatsApp.
   - Somente Administrador/Gestora podem alterar.
   - Validação: código único por executivo; aviso claro se já estiver em uso.

2. **Cadastro dos códigos informados**
   - Preenchimento dos códigos de vendedor de cada executivo conforme a lista oficial que você fornecer (nenhum código será inventado).

3. **Entrada de leads: dono correto e rastreável**
   - A resolução por código de vendedor continua sendo a primeira e única fonte oficial.
   - O caminho reserva deixa de silenciosamente eleger o dono da conexão: quando o vendedor não é reconhecido, o lead entra como "sem responsável definido", com registro do código recebido para diagnóstico, e continua visível para Administrador e Gestora.
   - Nenhuma alteração em E0, cadência, Ação do Dia, WhatsApp ou Safety Lock.

4. **Correção de titularidade dos cards já criados (opcional, sob confirmação)**
   - Após os códigos estarem cadastrados, um ajuste pontual reatribui apenas os cards cujo lead traz um código de vendedor que agora resolve para outro executivo.
   - Só cards do escopo GreenSales, sem tocar em histórico, mensagens, etapas ou datas.
   - Nada é executado sem você aprovar a lista exata de cards afetados.

5. **Papéis dos usuários**
   - Seis executivos não têm papel registrado no servidor, o que também limita o que enxergam. Cada um recebe o papel correspondente (Gestora ou Colaborador) no mesmo movimento.

## Detalhes técnicos

- `executive_profiles.greensales_vendor_id`: gravação via server function de gestão de usuários, com índice único parcial (ignora nulos).
- `src/server/crm/responsible.server.ts`: mantém `resolveResponsibleByVendorId` como fonte oficial; `lead-intake.server.ts:240-242` deixa de aplicar `connectionUserId` como responsável e passa a registrar evento `responsavel_nao_resolvido` com o `vendedor_id` bruto.
- `portal_leads` sem responsável continua legível por admin/gestora pela policy atual.
- Reatribuição (item 4) roda como script de dados revisado, atualizando somente `responsible_executive_id`/`responsible_executive_slug` em `portal_leads` de `scope=green_sales`, com registro em `lead_ownership_history`.
- `user_roles`: inserção dos papéis faltantes por migration/dados, sem alterar `usr_thiago`.

## Preservado

IDs, usuários, WhatsApp, permissões de módulo, camada centralizada de autorização, Ação do Dia, Notas do Executivo, histórico, E0/cadência, Safety Lock, `/s`, `/seg` e `/`.

## Preciso de você

A lista oficial de código de vendedor GreenSales por executivo (Larissa, Marton, Milton, Paulo, Carlos, Talita, Thiago) e o papel de cada um (Gestora ou Colaborador).
