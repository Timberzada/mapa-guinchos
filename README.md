# Mapa de Guinchos & Para-brisas

Mapa interativo do Brasil (27 UFs) para cadastrar empresas de guincho e para-brisa por estado/cidade.
100% estático — roda no GitHub Pages, sem servidor.

## Estrutura

```
index.html      app completo (HTML + CSS + JS, sem dependências)
mapa.json       paths SVG dos 27 estados + parâmetros da projeção
cidades.json    5.590 municípios com lat/lon
empresas.json   ← o "banco de dados" (editado pelo próprio site)
README.md
```

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `mapa-guinchos`) e suba estes arquivos na raiz.
2. Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
3. Acesse `https://SEU-USUARIO.github.io/mapa-guinchos/`.

## Ativar o modo admin (salvar de verdade)

Sem token, adições/remoções ficam só no `localStorage` do navegador.
Para gravar no repositório:

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Repository access: **Only select repositories** → escolha o repo do mapa.
3. Permissions → Repository permissions → **Contents: Read and write**.
4. Copie o token, abra o site → botão **🔑 Admin** → preencha usuário, repo, branch e cole o token → **Salvar configuração**.

A partir daí cada "Adicionar"/"remover" faz um commit em `empresas.json` via API do GitHub.
O token fica **apenas no seu navegador** — nunca é commitado.

> ⚠️ Qualquer pessoa com o token pode escrever no repo. Não compartilhe e não cole o token em nenhum arquivo do projeto.
> O GitHub Pages leva ~30–60s para republicar após o commit.

## Formato de `empresas.json`

```json
[
  {
    "id": "m8x2k1abc",
    "nome": "Guincho Rápido 24h",
    "telefone": "(11) 91234-5678",
    "tipo": "guincho",
    "uf": "SP",
    "cidade": "Campinas",
    "lat": -22.9056,
    "lon": -47.0608,
    "criadoEm": "2026-07-20"
  }
]
```

`tipo`: `guincho` | `parabrisa` | `ambos`

## Recursos

- Clique em um estado → filtra a lista; clique de novo → limpa
- Zoom com scroll, arrastar para mover, botões `+ − ⟲`
- Busca por nome, cidade ou telefone; filtro por UF e por tipo
- Pontos de empresas na mesma cidade se espalham em círculo (não sobrepõem)
- Telefone vira link `tel:` no celular
- **Exportar JSON** (backup) e importar backup na aba Config

## Notas técnicas

- Projeção **Mercator**; `mapa.json → proj` guarda `minx/maxy/k/pad`, e o JS usa exatamente a mesma fórmula para posicionar os pontos — mapa e pontos ficam sempre alinhados.
- Contornos dos estados derivados do **Natural Earth** (domínio público).
- Municípios: lista oficial IBGE; coordenadas do **GeoNames** (CC BY 4.0). ~96% com coordenada exata; o restante foi ajustado para dentro do polígono do estado.
- Sem `localStorage` de terceiros, sem CDN, sem build. Abrir `index.html` direto do disco não funciona por causa do `fetch` — use `python3 -m http.server` para testar local.

## Testar localmente

```bash
cd mapa-guinchos
python3 -m http.server 8080
# abra http://localhost:8080
```
