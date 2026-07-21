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

## Segurança e login

Duas camadas independentes:

| | Quem tem | Permite |
|---|---|---|
| **Login** (usuário + senha) | Cada pessoa da equipe, com senha própria | Ver o mapa e a lista |
| **Senha de admin + token** | Só você | Cadastrar, remover e gerenciar usuários |

Sem login, o site fica aberto para qualquer um com o link.

### Como funciona por baixo

Envelope encryption. A lista é cifrada com uma **chave aleatória de 256 bits**; essa chave é guardada cifrada **uma vez para cada usuário**, com a senha dele. Entrar = descobrir a chave a partir da sua senha e então abrir a lista.

O ganho prático: remover uma pessoa é apagar o envelope dela — ninguém mais precisa trocar de senha.

```json
{
  "cifrado": 2,
  "usuarios": [
    {"u":"felipe","kdf":{"salt":"…","iter":310000},"iv":"…","ct":"…"},
    {"u":"joao",  "kdf":{"salt":"…","iter":310000},"iv":"…","ct":"…"}
  ],
  "iv": "…", "ct": "…"
}
```

`ct` de cada usuário é a chave dos dados cifrada com a senha daquele usuário. O `ct` de fora é a lista de empresas.

Cripto: PBKDF2-SHA256 (310.000 iterações) + AES-GCM 256, tudo com Web Crypto nativa. Sem biblioteca externa.

> ⚠️ **A proteção vale o que valer a senha mais fraca.** O arquivo cifrado é público — dá para baixar e tentar quebrar offline. Exija senhas longas.
> ⚠️ **Perdeu todas as senhas, perdeu os dados.** Não há recuperação. Exporte o JSON de vez em quando.
> ℹ️ A sessão fica aberta enquanto a aba existir (`sessionStorage`). Fechou a aba, pede login de novo.

## Configurar (aba Config)

**1 · Repositório** — usuário, repo, branch e arquivo. Salvar recarrega a página.

**2 · Admin (token)**

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Repository access: **Only select repositories** → o repo do mapa
3. Permissions → Repository permissions → **Contents: Read and write**
4. No site: crie uma **senha de admin** (8+), cole o token, **Destravar admin**

Depois disso, só a senha destrava — o token fica cifrado no navegador. **Esquecer** o apaga dali.

**3 · Login e usuários** — com o admin destravado, crie o primeiro usuário e clique **Ativar login**. Depois o bloco vira a lista de contas, onde dá para **adicionar**, **trocar senha** e **remover**. Não é possível remover o último usuário (use **Desativar login**).

**4 · Backup** — importar um `.json` exportado antes.

Toda alteração vira um commit automático no `empresas.json`. O GitHub Pages republica em ~30–60s.

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
- Botão **🔒 Bloquear** encerra a sessão e volta para a tela de login
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
