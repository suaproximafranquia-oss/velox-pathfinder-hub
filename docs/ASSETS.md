# Arquitetura de Assets — auditoria e plano de migração (KingHost)

Documento vivo. Atualize sempre que uma nova mídia entrar no projeto.

## 1. Como os assets estão armazenados hoje

| Tipo | Onde está | Como o código referencia |
| --- | --- | --- |
| Fotografias e capas (47 arquivos) | **Fora do repositório**, em CDN da plataforma. No repo existe apenas um ponteiro `*.asset.json` em `src/assets/**` com a URL `/__l5e/assets-v1/<id>/<arquivo>` | Importado pelo registro central `src/lib/assets/registry.ts` |
| Logo Velox | Mesma estrutura (`src/assets/editorial/velox-logo.png.asset.json`) | `assetUrl("logo-velox")` |
| Favicon | `public/favicon.ico` — **binário real no repositório** | `/favicon.ico` |
| `src/assets/portal-revista.jpg` | Binário real no repositório, **sem nenhuma referência no código** (resíduo) | — |
| Fontes | Google Fonts via `<link>` em `src/routes/__root.tsx` | CDN externo (Google) |
| Mídias da **Revista Velox** e dos **módulos institucionais do Portal** | **Storage privado do backend** (bucket `revista`), entregues por URL **assinada com validade de 6 h** (`src/server/magazine.server.ts`) | `storage://caminho` no banco, resolvido em runtime |
| Mídias da **Biblioteca de Conteúdos** (homologação/cadência) | Storage privado do backend | idem |
| Vídeos | **Não existe hoje nenhum arquivo de vídeo no projeto.** O material institucional usa `MediaSlot` (placeholder). As tags `<video>` existentes (Revista e módulos institucionais) tocam arquivos enviados pelo administrador para o storage do backend | `<video src={urlAssinada}>` |

## 2. O que depende da plataforma Lovable

- **Todos os ponteiros `*.asset.json`**: o binário está no CDN da plataforma. A URL `/__l5e/...` **deixa de funcionar** fora dela.
- Nada mais. Não há dependência de domínio `.lovable.app` para renderizar o material (existem apenas duas menções à URL de preview em textos/metadados).

## 3. O que depende de serviços externos

- Google Fonts (fontes tipográficas) — funciona em qualquer hospedagem; opcionalmente pode ser auto-hospedado depois.
- Backend gerenciado (Storage + banco) para Revista, módulos institucionais e Biblioteca — continua funcionando após a migração desde que as credenciais sejam mantidas; caso o backend também mude, esses arquivos precisam ser exportados do bucket.

## 4. O que é levado junto com o código

- `public/favicon.ico`
- `src/lib/assets/registry.ts` (manifesto completo: chave → caminho de produção → uso)
- Todo o código das páginas (não contém URL de mídia hardcoded)

## 5. O que precisa ser copiado manualmente na migração

1. **Os 47 binários do CDN atual.** Cada `*.asset.json` traz `url` e `original_filename`. Baixe cada `url` e grave no servidor no caminho `path` declarado no registro (`/assets/images/...`, `/assets/logos/...`).
2. **Os arquivos do bucket `revista`** (páginas da Revista, blocos institucionais, biblioteca), caso o backend seja trocado.

Depois de copiar, defina no ambiente de produção:

```
VITE_ASSET_BASE_URL=https://portal.velox.com.br
```

A partir daí `assetUrl()` resolve `https://portal.velox.com.br/assets/images/fundador-mario-sergio.png` em vez da URL do CDN — **sem alterar nenhuma página**.

## 6. Risco atual de perda

- **Baixo, porém real, para os binários do CDN**: eles não estão versionados no repositório. Se a conta da plataforma for encerrada antes do download, os arquivos se perdem. Recomendação: fazer o download completo (script abaixo) e guardar um backup antes de qualquer encerramento.
- **Médio para o storage do backend**: as URLs são assinadas e expiram em 6 h — nunca guarde a URL, guarde o caminho `storage://`. O que está no banco já segue essa regra.
- Nenhum asset crítico depende de URL temporária dentro do código.

### Script de exportação (rodar antes da migração)

```bash
# Baixa todos os binários apontados pelos *.asset.json para ./export/assets
python3 - <<'PY'
import json, pathlib, urllib.request, re
BASE = "https://velox-pathfinder-hub.lovable.app"  # ou a URL de preview vigente
reg = pathlib.Path("src/lib/assets/registry.ts").read_text()
for p in pathlib.Path("src/assets").rglob("*.asset.json"):
    d = json.loads(p.read_text())
    out = pathlib.Path("export") / d["url"].lstrip("/")
    out.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(BASE + d["url"], out)
    print(out)
PY
```

Em seguida renomeie cada arquivo para o `path` do registro (nome semântico) e envie para a KingHost.

## 7. Estrutura recomendada (já implementada)

```
/assets
  /images      fotografias e capas
  /videos      vídeos institucionais e da operação (ainda inexistentes)
  /logos       marca Velox
  /documents   PDFs institucionais (ainda inexistentes)
```

Regras adotadas:

1. Nenhum componente importa `*.asset.json` diretamente — tudo passa por `src/lib/assets/registry.ts`.
2. Cada posição do material depende de uma **chave semântica** (`fundador-mario-sergio`, `diretora-expansao-larissa`, `equipe-expansao`…), nunca de um nome de arquivo opaco.
3. Trocar uma foto = trocar o ponteiro daquela chave. A página não muda.
4. `assetInventory()` devolve o inventário completo para auditoria de migração.

## 8. Vídeos — situação e recomendação

- **Situação:** não há vídeo hospedado no projeto. O material institucional reserva três posições (`MediaSlot`): vídeo institucional, vídeo da operação e depoimentos.
- **Recomendação (a decidir junto):** hospedagem de vídeo na KingHost é viável para arquivos curtos (< 30 MB, MP4 H.264) servidos de `/assets/videos/`, mas sem streaming adaptativo. Para vídeos institucionais mais longos, o mais adequado é um serviço de vídeo (CDN com HLS) e guardar apenas o ID/URL no registro. Nenhuma decisão foi tomada nesta implementação.

## 9. Checklist de aceite da migração

- [ ] Todos os binários baixados do CDN (conferir contagem com `assetInventory().length`)
- [ ] Arquivos renomeados conforme `path` do registro
- [ ] Enviados para `/assets/**` na KingHost
- [ ] `VITE_ASSET_BASE_URL` configurada
- [ ] Bucket `revista` exportado (se o backend mudar)
- [ ] Nenhuma requisição a `/__l5e/` no DevTools após o deploy
- [ ] Material institucional visualmente idêntico
