# Documentos públicos do app

Esta pasta contém documentos que precisam ser **acessíveis por URL pública** para conformidade com App Store, Google Play e LGPD.

Atualmente:
- `index.md` — landing (linka privacy + support)
- `privacy-policy.md` — Política de Privacidade
- `support.md` — Página de suporte (FAQ + contato) — **exigida pela App Store**

## ⚠️ Antes de publicar

1. Confira o endereço de e-mail de contato em todos os arquivos.
2. Atualize a data no topo do `privacy-policy.md` se fizer mudanças.

## Como hospedar (3 opções rápidas)

### Opção 1 — GitHub Gist (mais rápido, 30s)

1. Cole o conteúdo de `privacy-policy.md` em https://gist.github.com
2. Salva como gist público com nome `privacy-policy.md`
3. Clica em "Raw" — a URL resultante é a sua URL pública
4. Use essa URL no App Store Connect e no Play Console

**Prós:** zero setup. **Contras:** URL feia, sem domínio próprio.

### Opção 2 — GitHub Pages (recomendado, 10min)

1. Crie um repo público chamado `figurinhasbr` (ou similar) no GitHub
2. Suba esses arquivos da pasta `docs/` na raiz desse repo
3. Vá em `Settings → Pages → Source: main branch / root → Save`
4. Em ~1min você terá URL tipo `https://heitorolial.github.io/figurinhasbr/privacy-policy`
5. (Opcional) Configure domínio próprio depois, tipo `figurinhasbr.app`

**Prós:** profissional, MD renderiza automaticamente. **Contras:** precisa criar repo.

### Opção 3 — Vercel/Netlify (10min, melhor pra escalar)

1. Crie projeto em `vercel.com` apontando pra esse repo
2. Configure como site estático
3. URL final: `https://figurinhas-copa-2026.vercel.app/privacy-policy`

**Prós:** rápido, CDN global, fácil adicionar mais páginas (termos de uso, suporte). **Contras:** conta extra.

## URLs públicas em uso

Depois de subir `docs/` no GitHub Pages, as URLs ficam:

| Tipo | URL (depois de ativar Pages) | Onde usar |
|---|---|---|
| Landing | `https://<user>.github.io/<repo>/` | (opcional) |
| Privacy Policy | `https://<user>.github.io/<repo>/privacy-policy` | App Store Connect + Play Console (Data Safety) |
| Support | `https://<user>.github.io/<repo>/support` | App Store Connect (**campo Support URL — obrigatório**) + Play Console |

> ⚠️ A Apple frequentemente recusa `mailto:` no campo Support URL — por isso a página `support.md` agora é a fonte canônica. O e-mail continua dentro da página.

## Como ativar GitHub Pages (5 min)

1. Cria um repo público no GitHub (sugestão: `figurinhasbr` ou `figurinhas-copa-2026`).
2. Sobe o conteúdo da pasta `docs/` (deste projeto) **na raiz** do repo novo, ou aponta Pages pra `/docs` direto no repo deste app.
3. Vai em **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / folder: /docs (ou / root) → Save**.
4. Em ~1min as URLs acima ficam ativas.
5. (Opcional) Configura domínio próprio depois.
