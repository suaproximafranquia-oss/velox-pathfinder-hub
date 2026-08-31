# Respostas à última bateria — decisões confirmadas para implantação

Somente respostas. Nada foi implementado, migrado ou alterado.

## 1. Central de Nomes — quem administra?

**Administrador (permissão administrativa, `user_roles`) cria, edita, exclui e importa.** Gestor e Colaborador **somente visualizam** — e o que eles enxergam não é a tabela, é o resultado aplicado: a sugestão de nome e o tratamento que a mensagem usaria. A gestão da lista em si é restrita ao Administrador, pelo mesmo motivo da Biblioteca: a lista decide o que sai escrito para o cliente.

## 2. Central de Nomes — o que será armazenado?

Correto. A Central é um **dicionário de nomes autorizados**, nada mais:

```text
primeiro_nome | forma_autorizada_de_exibição | quem_incluiu | quando
```

Os nomes são **primeiros nomes** (João, Maria, Thiago, Ana). A comparação é feita sobre a forma dobrada (sem acento, minúscula), mas a forma autorizada de exibição é gravada — assim "José" autorizado na Central sai "José", mesmo que o cadastro diga "JOSE" ou "jose". Nenhum sobrenome, telefone, lead ou vínculo com pessoa entra na tabela. A única ligação com o lead acontece na hora do envio: o sistema pega o primeiro nome do cadastro, procura na Central e decide COM NOME / SEM NOME — e pronto.

## 3. Central de Nomes — importação gigante

Correto, e é obrigatório por construção. A colagem **nunca é processada no navegador**:

```text
Administrador cola o texto → interface envia em partes → o servidor
normaliza (sem acento, sem duplicata, formato válido) → grava em lotes
→ mostra o resultado: quantos entraram, quantos já existiam, quantos
foram recusados (ruído, não-nome).
```

O navegador apenas acompanha o progresso e o resultado. Nenhum milhão de linhas passa pela tela. O índice de consulta fica no banco (a comparação é sempre "este primeiro nome existe?"), então o tamanho da lista não torna o envio mais lento nem pesado para o cliente.

## 4. Central de Nomes — exclusão

Correto. Excluir um nome significa apenas: **a partir daquele momento ele deixa de autorizar novas mensagens** — o próximo lead com aquele nome cai em SEM NOME (tratamento neutro), e o tratamento aparece na Ação do Dia para o Executivo confirmar. Nenhuma mensagem já enviada é tocada: o snapshot em `relationship_message_sends` está congelado e o histórico permanece exatamente como saiu.

A recíproca também vale: **incluir um nome não "corrige" nada do passado** — só vale para os envios seguintes.

## 5. Biblioteca — quem pode alterar conteúdo?

Confirmado. A divisão de autoridade é:

| Operação | Administrador | Gestor | Executivo |
|---|---|---|---|
| criar / editar (gera nova versão) | sim | não | não |
| ativar / desativar | sim | não | não |
| vincular / desvincular etapa | sim | não | não |
| excluir (protegido por histórico) | sim | não | não |
| ler o conteúdo | sim | sim | sim |
| executar a mensagem (ação manual, copiar texto) | sim | sim | sim |

A autoridade de escrita fica **somente** com a permissão administrativa — e isso vale no servidor, não só na interface. Executivos consomem: o texto exibido na Ação do Dia e no CRM é o da Biblioteca, na versão ativa, com COM NOME/SEM NOME já decidido.

## 6. Migração do localStorage

Confirmado. A regra de migração é:

```text
Dado no navegador → tem correspondente seguro no servidor? → migra.
Dado no navegador → não tem correspondente confiável?      → não é
inventado, não é convertido, não é "adivinhado". Fica como está,
marcado como não migrado, e o executivo refaz manualmente se quiser.
Depois de migrado, o localStorage vira só cache de exibição — nunca
decide o estado real.
```

Exemplos concretos do que isso significa: o WhatsApp digitado no perfil migra porque tem correspondente direto em `executive_profiles`; o `atlas:users:v3` de um navegador que diverge do banco **não vence** — o banco prevalece e o usuário refaz a edição se necessário; preferências puramente locais (tema, rascunho) nem entram na migração.

## 7. Dados antigos / legado

Confirmado. Regra de preservação máxima:

1. **Primeiro se tira a participação operacional** do legado (deixa de alimentar qualquer fluxo).
2. **Só se exclui** o que a auditoria já determinou seguro e necessário — e mesmo assim com o histórico preservado onde houver referência (snapshots, logs, mensagens).
3. Nada é apagado "de passagem" durante outra alteração.

Isso vale para rotas espelho `executivo.*`, `crm/distribution.ts`, a tabela `relationship_content_groups` congelada, os aliases E2/E5/E6/E7 e os vínculos marcados "(legado)" — todos permanecem até que a remoção seja explicitamente pedida.

## 8. Falha durante a implantação

Correto, e fica registrado como **regra permanente de execução**:

```text
Encontrou dependência que contradiz a auditoria?
  → NÃO improvisar
  → NÃO sobrescrever
  → NÃO apagar
  → NÃO continuar parcialmente
  → PARAR, relatar o conflito exato (tabela, campo, valor, etapa)
    e AGUARDAR nova instrução sua.
```

Nenhuma decisão de contorno será tomada por conta própria durante os comandos.

---

## Itens fechados (não serão reabertos)

E0 · WhatsApp como remetente institucional · link personalizado · GreenSales · sem vínculo = sem vínculo · snapshot congelado · idempotência por chave determinística · Ação do Dia como visão de leitura · Remarketing independente · isolamento dos ambientes · Solar/Seguros · Home por ambiente · ficha do investidor · cadência · Biblioteca como fonte do motor · **servidor como fonte de verdade do projeto inteiro** (navegador exibe e cacheia, nunca decide).

## Decisões ainda pendentes de você

1. **Nome composto**: a regra atual trata "Ana Paula" como nome completo quando as duas partes são autorizadas. Com a Central, mantém essa exceção ou **somente o primeiro nome** sempre?
2. **Tratamento neutro**: quando o nome não está autorizado, hoje a mensagem usa "caro investidor" (o template já existe assim). Mantém esse texto neutro ou a mensagem SEM NOME usa outra formulação?
3. **Manual**: remover a estrutura de vídeo dos capítulos, inclusive 1, 7 e 14?
4. **Upload de imagens institucionais** (cards e áreas do Portal): criar agora, com armazenamento próprio compatível com a hospedagem externa?
5. **Envio manual do CRM** (`CRM_TEMPLATES` / Primeiro Contato manual): aposentar esses textos próprios e passar tudo pela Biblioteca?

## DOIS COMANDOS FINAIS (mantidos, agora com as regras desta bateria)

**COMANDO FINAL 1 — Identidade, acesso e verdade do servidor**
Cadastro de usuários no banco (fim do `SEED_USERS` como verdade), status ON/OFF valendo na sessão viva, WhatsApp e slug persistidos e usados sem queda para valor de código, permissões com verdade única no servidor, **migração do localStorage pela regra do item 6** (só o que tem correspondência segura), **preservação máxima do legado (item 7)**, segredo dedicado nas rotas públicas, assinatura do webhook e ampliação das tabelas do backup. Bloco autocontido: nada aqui depende do motor.

**COMANDO FINAL 2 — Central de Nomes, mensagens e entrega**
Central de Nomes como autoridade única do COM NOME/SEM NOME: **escrita só do Administrador, leitura aplicada para todos** (item 1), **dicionário puro de primeiros nomes** (item 2), **importação em lotes no servidor** (item 3), **exclusão que nunca toca o histórico** (item 4); substituição da lista fechada `name-base.ts` por ela em todos os pontos mapeados; autoridade de escrita da **Biblioteca exclusivamente administrativa** (item 5); correção de rótulos e conteúdos reservados; cadastro do template oficial da Meta; persistência do `wamid` com consumo de status (tentativa → aceite → entrega → leitura → falha); reconciliação do GreenSales além da coluna "novos"; retenção de backup em horário brasileiro. Depende do Comando 1 apenas em WhatsApp/slug do executivo.
