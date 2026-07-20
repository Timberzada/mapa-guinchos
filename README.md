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

## Segurança

O site tem **duas senhas independentes**, ambas opcionais:

| | Para quê | Onde fica |
|---|---|---|
| **Senha de acesso** | Descriptografa a lista de empresas. Sem ela o site mostra só a tela de bloqueio — e o `empresas.json` no GitHub é texto ilegível, mesmo baixando direto. | Em lugar nenhum: só na cabeça de quem tem |
| **Senha de admin** | Destrava o token do GitHub para poder adicionar/remover. | Cifra o token no `localStorage` deste navegador |

Criptografia: PBKDF2-SHA256 (310.000 iterações) + AES-GCM 256, via Web Crypto nativa do navegador.

O `empresas.json` protegido fica assim:

```json
{"cifrado":1,"kdf":{"salt":"…","iter":310000},"iv":"…","ct":"…"}
```

> ⚠️ **A segurança depende inteiramente da força da senha de acesso.** O arquivo cifrado é público — quem quiser pode baixar e tentar quebrar offline. Use uma senha longa (frase de 4+ palavras).
> ⚠️ **Perdeu a senha de acesso, perdeu os dados.** Não existe recuperação. Use **Exportar JSON** de vez em quando.

## Configurar (aba Config)

**1 · Repositório** — usuário, repo, branch e nome do arquivo. Salvar recarrega a página.

**2 · Admin (token)**

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Repository access: **Only select repositories** → escolha o repo do mapa
3. Permissions → Repository permissions → **Contents: Read and write**
4. No site: defina uma **senha de admin** (8+ caracteres), cole o token e clique **Destravar admin**

Nas próximas vezes basta a senha — o token já fica cifrado no navegador. **Esquecer** apaga o token dali.

**3 · Senha de acesso** — com o admin destravado, defina a senha (10+ caracteres) e clique **Aplicar**. Isso criptografa a lista e faz o commit. **Remover** volta a lista para texto puro.

**4 · Backup** — importar um `.json` exportado antes.

Cada adição/remoção vira um commit no `empresas.json`. O GitHub Pages leva ~30–60s para republicar.

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
- Botão **🔒 Bloquear** volta para a tela de senha e limpa os dados da memória
- Busca por nome, cidade ou telefone; filtro por UF e por tipo
- Pontos de empresas na mesma cidade se espalham em círculo (não sobrepõem)
- Telefone vira link `tel:` no celular
- **Exportar JSON** (backup) e importar backup na aba Config

## Notas técnicas

- Projeção **Mercator**; `mapa.json → proj` guarda `minx/maxy/k/pad`, e o JS usa exatamente a mesma fórmula para posicionar os pontos — mapa e pontos ficam sempre alinhados.
- Contornos dos estados derivados do **Natural Earth** (domínio público).
- Municípios: lista oficial IBGE; coordenadas do **GeoNames** (CC BY 4.0). ~96% com coordenada exata; o restante foi ajustado para dentro do polígono do estado.
- Sem dependências, sem CDN, sem build. Abrir `index.html` direto do disco não funciona por causa do `fetch` — use `python3 -m http.server` para testar local.

## Testar localmente

```bash
cd mapa-guinchos
python3 -m http.server 8080
# abra http://localhost:8080
```
