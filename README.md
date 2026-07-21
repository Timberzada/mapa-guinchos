# Mapa de Guinchos & Para-brisas

Mapa interativo do Brasil (27 UFs) para cadastrar empresas de guincho e para-brisa por estado e cidade.
Aplicação Node com login, pensada para rodar no Railway.

## Estrutura

```
server.js       API + servidor HTTP
db.js           persistência (JSON com escrita atômica)
auth.js         sessão por cookie assinado
index.html      front completo (HTML + CSS + JS, sem dependências)
mapa.json       paths SVG dos 27 estados + parâmetros da projeção
cidades.json    5.590 municípios com lat/lon
```

Os dados ficam em `DB_PATH` (padrão `./data/dados.json`) — fora do repositório.

## Deploy no Railway

1. **New Project → Deploy from GitHub repo** → selecione este repositório.
2. **Variables** — defina:
   - `SESSION_SECRET` — string aleatória longa. Sem ela, todo deploy derruba as sessões.
   - `NODE_ENV=production` — liga o cookie `Secure`.
   - `DB_PATH=/data/dados.json`
   - *(opcional)* `ADMIN_USUARIO` e `ADMIN_SENHA` criam o admin inicial sem passar pela tela de setup.
3. **Settings → Volumes → New Volume**, mount path `/data`.
   Sem isso os dados somem a cada deploy.
4. **Settings → Networking → Generate Domain**.

O Railway detecta Node automaticamente e roda `npm start`. Não há etapa de build nem módulo nativo, então o deploy leva poucos segundos.

### Primeiro acesso

Abra a URL: se ainda não existe nenhum usuário, a tela pede para **criar o administrador**. Feito isso, o cadastro fecha — a rota `/api/setup` passa a responder 409 e novos usuários só saem pelo painel.

## Como funciona a segurança

| | Como |
|---|---|
| Senhas | bcrypt, custo 12. O hash nunca sai do servidor. |
| Sessão | Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção, assinado com HMAC-SHA256. |
| Revogação | O cookie carrega o `token_version` do usuário. Trocar a senha ou remover a conta invalida as sessões abertas **na hora**. |
| Força bruta | Rate limit de 20 tentativas de login por 15 min por IP. |
| Enumeração de usuários | Login sempre roda o bcrypt, mesmo sem usuário, e devolve a mesma mensagem nos dois casos. |
| Coordenadas | O cliente manda só UF e cidade; lat/lon vêm da base do servidor. Não dá para forjar posição. |
| Estáticos | Whitelist explícita — só `index.html`, `mapa.json` e `cidades.json`. `server.js`, `package.json` e o arquivo de dados não são serváveis. |

## Permissões

- **Administrador** — cadastra e remove empresas, gerencia usuários, importa backup.
- **Usuário comum** — só visualiza o mapa e a lista.

Um administrador não consegue remover a própria conta nem o último admin do sistema.

## API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/status` | público |
| POST | `/api/setup` | só enquanto não há usuários |
| POST | `/api/login` · `/api/logout` | público |
| GET | `/api/empresas` | logado |
| POST · DELETE | `/api/empresas` · `/api/empresas/:id` | admin |
| POST | `/api/empresas/import` | admin |
| GET · POST · DELETE | `/api/usuarios` … | admin |
| POST | `/api/usuarios/:id/senha` | admin |

## Rodar local

```bash
npm install
SESSION_SECRET=qualquercoisa npm start
# http://localhost:3000
```

## Recursos do mapa

- Clique num estado filtra a lista; clique de novo limpa
- Zoom com scroll, arrastar para mover, botões `+ − ⟲`
- Busca por nome, cidade ou telefone; filtros por UF e tipo
- Empresas na mesma cidade se espalham em círculo, sem sobrepor
- Telefone vira link `tel:` no celular
- Exportar/importar JSON para backup

## Notas técnicas

- Projeção **Mercator**. `mapa.json → proj` guarda `minx/maxy/k/pad` e o front usa a mesma fórmula para posicionar os pontos, então mapa e pontos nunca saem de alinhamento.
- Contornos dos estados derivados do **Natural Earth** (domínio público).
- Municípios: lista oficial do IBGE; coordenadas do **GeoNames** (CC BY 4.0). Cerca de 96% com coordenada exata; o restante foi ajustado para cair dentro do polígono do estado.
- Persistência em JSON é decisão consciente de escala: sem dependência nativa, sem etapa de build, e o volume do Railway já dá durabilidade. Se um dia a lista passar de dezenas de milhares, `db.js` é o único arquivo a trocar.
