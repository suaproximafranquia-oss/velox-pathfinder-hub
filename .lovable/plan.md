# Ajuste mínimo — Publicação da Apresentação Digital por ambiente

## Diagnóstico (verificado no código e no banco)

- A tabela `environment_presentations` tem `UNIQUE (environment)` + CHECK de ambiente (`financeira|solar|seguradora`), e o servidor grava via `upsert ... onConflict: "environment"` (`src/server/relationship/environment-presentation.server.ts`). **A unicidade de 1 apresentação vigente por ambiente já está garantida estruturalmente** — nenhum outro ambiente é afetado ao salvar.
- Dois pontos NÃO atendem à regra final:
  1. **Histórico:** o upsert sobrescreve a linha — a apresentação anterior é apagada (viola a regra "a anterior não é apagada").
  2. **"Ver como o investidor":** a pré-visualização atual em `src/routes/f.executivo.apresentacao-digital.tsx` (linha ~399) renderiza os **capítulos antigos**, não a apresentação vigente do ambiente.

## Ajuste mínimo proposto

### 1. Histórico append-only (única migração)
Criar `environment_presentations_history` com os mesmos campos de conteúdo + `archived_at`. GRANT SELECT a `authenticated`, GRANT ALL a `service_role`, RLS habilitado com policy de leitura autenticada; sem policy de escrita para usuários (escrita só via servidor).

Justificativa da migração: a estrutura atual NÃO suporta "a anterior não é apagada" (regra 4), então a exceção da regra 10 se aplica. Nenhuma coluna da tabela atual é alterada.

### 2. Servidor — arquivar antes de publicar
Em `saveEnvironmentPresentation` (`src/server/relationship/environment-presentation.server.ts`):
- Antes do upsert, se já existir linha do ambiente, copiá-la para `environment_presentations_history` (com quem publicou e quando).
- Depois, o upsert atual normalmente — a anterior deixa de ser vigente sem ser apagada.
- Nenhum outro ambiente é tocado; capítulos versionados e apresentações já emitidas permanecem intocados.

### 3. "Ver como investidor" passa a abrir a apresentação vigente
Na seção de pré-visualização da tela Apresentação Digital:
- Trocar o conteúdo da pré-visualização: seletor de ambiente (Financeira / Solar / Seguradora) que renderiza **texto de abertura + vídeo** da apresentação vigente daquele ambiente.
- A pré-visualização deixa de listar os capítulos antigos.
- Nenhum capítulo é criado, excluído ou modificado; a grade de capítulos continua visível apenas para gestão, sem pré-visualização.

### 4. Nada mais é tocado
Manual, CRM, GreenSales, Biblioteca, KPI, Campanhas, Ação do Dia, Safety Lock, ownership, históricos e demais módulos: sem alteração.

## Validação
- `bunx tsgo --noEmit`
- build
- Conferência do log de build em `/tmp/observability/build-errors.log`

## Detalhes técnicos
- Tabela nova: `environment_presentations_history` (id uuid PK, environment text CHECK, intro_text, video_url, is_published, published_at, published_by, archived_at, created_at).
- Arquivamento feito no servidor com o cliente privilegiado já existente, dentro da mesma função de salvar — sem nova superfície de API.
- Sem mudança de rotas, permissões ou RLS das tabelas existentes.
