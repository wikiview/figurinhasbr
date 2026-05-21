# Setup de Pagamentos (RevenueCat + IAP)

Tudo que precisa ser feito **fora do código** pra liberar a compra Premium de R$ 14,90 (one-time, vitalício).

**Resumo**: criar produto IAP nas duas lojas → conectar lojas no RevenueCat → criar entitlement → pegar API keys → setar no `eas.json` → buildar e testar.

---

## Fase 1 — App Store Connect (IAP iOS)

1. Acessa **https://appstoreconnect.apple.com** → My Apps → Figurinhas Copa 2026 (depois de criar o app — ver `app-store-setup.md`, ainda a fazer)
2. Vai em **Monetization → In-App Purchases → +**
3. Tipo: **Non-Consumable** (one-time, vitalício)
4. **Reference Name**: `Premium Lifetime`
5. **Product ID**: `app.figurinhasbr.copa2026.premium_lifetime`
   - ⚠️ Esse ID **não pode ser alterado depois**. Anota direito.
6. **Price**:
   - Brazil: R$ 14,90
   - (Apple mostra os preços equivalentes em outros países — pode deixar default ou ajustar)
7. **App Store Localizations** (PT-BR e EN-US):
   - **Display Name PT**: `Premium Vitalício`
   - **Description PT**: `Remove anúncios e libera o scan automático de figurinhas via IA. Compra única, válida pra sempre.`
   - **Display Name EN**: `Lifetime Premium`
   - **Description EN**: `Removes ads and unlocks automatic sticker scanning with AI. One-time purchase, lifetime access.`
8. **Review Information**:
   - **Screenshot**: tira print da tela de paywall (depois que ela existir)
   - **Review Notes**: `One-time purchase. Premium status is managed via RevenueCat entitlement "premium".`
9. Salva. Status vai ficar **"Ready to Submit"**. Não submete ainda — o produto sobe junto com a versão do app.

---

## Fase 2 — Google Play Console (IAP Android)

1. Acessa **https://play.google.com/console** → Figurinhas Copa 2026
2. Vai em **Monetize → In-app products → Create product**
3. **Product ID**: `app.figurinhasbr.copa2026.premium_lifetime` (mesmo da Apple, mais fácil)
4. **Name**: `Premium Vitalício`
5. **Description**: `Remove anúncios e libera o scan automático de figurinhas via IA. Compra única, válida pra sempre.`
6. **Default price**: R$ 14,90 (BRL)
7. **Status**: Active
8. Salva.

---

## Fase 3 — RevenueCat

### 3.1 Criar conta e projeto

1. Acessa **https://app.revenuecat.com/signup** → cria conta (gratuito até US$ 2.5K/mês de revenue)
2. **Create new project**: `Figurinhas Copa 2026`

### 3.2 Conectar App Store

1. No projeto → **Project settings → Apps → + New App → App Store**
2. **Bundle ID**: `app.figurinhasbr.copa2026`
3. Configurar **App-Specific Shared Secret** (App Store Connect → My Apps → Figurinhas → App Information → App-Specific Shared Secret → Generate) → cola no RC
4. Configurar **In-App Purchase Key** (App Store Connect → Users and Access → Integrations → In-App Purchase → +) → baixa o `.p8` → cola Key ID + Issuer ID + arquivo no RC
5. Salva

### 3.3 Conectar Google Play

1. **+ New App → Google Play**
2. **Package name**: `app.figurinhasbr.copa2026`
3. Precisa de um **Service Account JSON** do Google Cloud com permissões na Play Console:
   - Google Cloud Console → IAM → Service Accounts → Create → role `Pub/Sub Editor` (pra Real-Time Developer Notifications) → cria chave JSON
   - Play Console → Setup → API access → Link → adiciona o service account com permissões: View financial data, Manage orders and subscriptions
4. Sobe o JSON no RC
5. Salva

### 3.4 Importar produtos

1. **Products → Import** (RC vai puxar automaticamente os produtos que você criou nas Fases 1 e 2)
2. Confirma que ambos `app.figurinhasbr.copa2026.premium_lifetime` aparecem (iOS + Android)

### 3.5 Criar Entitlement

1. **Entitlements → + New**
2. **Identifier**: `premium`
   - ⚠️ Tem que ser exatamente `premium` — é o ID que o código (`src/lib/purchases.ts`) procura.
3. **Attached products**: marca os dois `premium_lifetime` (iOS + Android)
4. Salva

### 3.6 Criar Offering

1. **Offerings → + New**
2. **Identifier**: `default`
3. **Make this the current offering**: ✓
4. **+ Add Package** → Package type: `Lifetime` → seleciona o produto `premium_lifetime`
5. Salva

### 3.7 Pegar API keys

1. **Project settings → API keys**
2. Copia:
   - **Apple App Store**: chave começa com `appl_`
   - **Google Play**: chave começa com `goog_`

---

## Fase 4 — Setar API keys no projeto

Edita `eas.json` e adiciona em **preview** e **production**:

```json
"env": {
  ...existing...,
  "EXPO_PUBLIC_RC_API_KEY_IOS": "appl_xxxxxxxxxxxxx",
  "EXPO_PUBLIC_RC_API_KEY_ANDROID": "goog_xxxxxxxxxxxxx"
}
```

(Quando me passar as keys eu já adiciono e rodo o update.)

---

## Fase 5 — Sandbox testing (depois de buildar)

### iOS

1. App Store Connect → Users and Access → **Sandbox → Testers → +**
2. Cria um email novo (não precisa ser real, ex: `sandbox-heitor@figurinhasbr.app`) — Apple não envia email, é só identificador
3. No iPhone de teste: Settings → App Store → Sandbox Account → loga com esse email
4. Roda o app → tenta comprar → Apple oferece sandbox flow (sem cobrar)

### Android

1. Play Console → Setup → **License testing → +**
2. Adiciona o email Google do tester
3. No celular logado com esse email, abrir o app via Internal Testing ou Closed Testing track
4. Compra mostra "This is a test purchase" — sem cobrar

---

## Fase 6 — Sincronização com Supabase (webhook RevenueCat → Edge Function)

O cliente usa `customerInfo.entitlements.active['premium']` (RC SDK em memória) como **fonte de verdade rápida** para a UI. A persistência em `profiles.is_premium` agora é feita **exclusivamente** pelo webhook do RC chegando numa Edge Function do Supabase — o app não escreve mais `is_premium` direto.

Isso fecha o vetor de adulteração: mesmo que alguém intercepte o app, ele não consegue se marcar como premium porque (a) o cliente não faz mais o UPDATE e (b) um trigger no Postgres reverte qualquer escrita em `is_premium` que não venha do service role.

### Arquitetura

```
RevenueCat (compra/renovação/expiração)
        │   POST + Authorization: <shared secret>
        ▼
Supabase Edge Function: rc-webhook
        │   service_role key (bypassa RLS + trigger)
        ▼
public.profiles.is_premium = true|false
        ▲
        │  SELECT only
Cliente (AuthProvider lê, nunca escreve)
```

### 6.1 Deploy da Edge Function

```bash
supabase functions deploy rc-webhook --no-verify-jwt
```

> ⚠️ `--no-verify-jwt` é obrigatório: o RC não manda JWT do Supabase. Nossa autenticação é via header `Authorization` com um segredo compartilhado.

### 6.2 Gerar e configurar o segredo

```bash
# Gera um token forte (32 bytes = 64 hex chars)
openssl rand -hex 32

# Salva no Supabase como secret da Edge Function
supabase secrets set RC_WEBHOOK_AUTH_TOKEN=<o-token-gerado>
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já estão disponíveis no runtime das Edge Functions — não precisa setar.

### 6.3 Aplicar o trigger anti-adulteração

O arquivo `supabase/migrations/004_premium_guard.sql` cria a função `guard_profile_is_premium()` + trigger BEFORE UPDATE que reverte qualquer escrita em `is_premium` feita por roles que não sejam `service_role`.

```bash
supabase db push
```

(Ou cola o conteúdo de `004_premium_guard.sql` no SQL Editor do Supabase se preferir aplicar manualmente.)

### 6.4 Configurar webhook no RevenueCat

1. **Project settings → Integrations → Webhooks → + Add Webhook**
2. **URL**: `https://<seu-project-ref>.supabase.co/functions/v1/rc-webhook`
   - Pega o `<seu-project-ref>` em **Supabase Dashboard → Project Settings → General → Reference ID**
3. **Authorization header value**: cola o **mesmo** segredo que você usou em `RC_WEBHOOK_AUTH_TOKEN`
4. **Event types**: deixa todos marcados (a função classifica internamente). Os relevantes são: `INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`, `UNCANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `TRANSFER`, `SUBSCRIBER_ALIAS`, `TEST`.
5. Salva.

### 6.5 Testar

1. No dashboard do RC, na página do webhook: **Send test event**
2. Abre os logs da função no Supabase: **Dashboard → Edge Functions → rc-webhook → Logs**
3. Deve aparecer: `[rc-webhook] TEST event received` e a resposta `200 OK`
4. Faça uma compra sandbox real → vai aparecer `INITIAL_PURCHASE` nos logs e `profiles.is_premium = true` pro `app_user_id` da compra.

### 6.6 O que muda no app (`src/providers/AuthProvider.tsx`)

- `refreshPremiumStatus()` agora **só lê** o status do RC e re-carrega o profile, com pequenas tentativas espaçadas (~1.5s) para dar tempo do webhook propagar. **Não escreve mais** `is_premium`.
- A UI continua snappy porque o RC SDK guarda o status em memória logo após a compra; o Supabase recebe o webhook em paralelo e atualiza o mirror em alguns segundos.

### 6.7 Backfill (opcional, pular pro MVP)

Se já houver usuários com `is_premium = true` setados pelo cliente antes desta mudança, dá pra fazer um cross-check contra a lista de assinantes ativos do RC (CSV export → loop SQL). Não é necessário pro MVP — usuários honestos continuam premium, e quem tentou tamperar terá `is_premium` resetado no próximo evento do RC.

### Mapeamento de eventos → estado

| Evento RC                | Tem entitlement `premium` | Ação no `is_premium` |
|--------------------------|---------------------------|----------------------|
| `INITIAL_PURCHASE`       | sim                       | `true`               |
| `NON_RENEWING_PURCHASE`  | sim                       | `true`               |
| `RENEWAL`                | sim                       | `true`               |
| `PRODUCT_CHANGE`         | sim                       | `true`               |
| `UNCANCELLATION`         | sim                       | `true`               |
| `TRANSFER`               | sim                       | `true`               |
| `EXPIRATION`             | sim                       | `false`              |
| `CANCELLATION`           | qualquer                  | nada (aguarda EXPIRATION) |
| `BILLING_ISSUE`          | qualquer                  | nada (aguarda EXPIRATION) |
| `SUBSCRIBER_ALIAS`       | qualquer                  | nada                 |
| `TEST`                   | qualquer                  | nada (200 OK)        |
| outros / desconhecidos   | qualquer                  | nada (200 OK)        |

Isso preserva o contrato "usuário cancelou mas paga até o fim do período" — o `is_premium` só vai a `false` quando o RC confirma a expiração.

---

## O que entregar pra mim

Quando completar as Fases 1-3:

- ✅ Product ID (deve ser `app.figurinhasbr.copa2026.premium_lifetime` se seguiu este doc)
- ✅ Entitlement ID `premium` no RC
- ✅ Offering `default` com pacote `lifetime`
- ✅ API keys (`appl_*` e `goog_*`)

Daí eu adiciono as keys no `eas.json`, integro paywall no UI, e a gente parte pro build de produção.

---

## Elite Cover Reference (one-time upload)

O Edge Function `generate-cover` precisa do `elite-cover-ref.png` no bucket `covers` em
`public/elite-cover-ref.png` pra usar como referência visual quando gerar a Capa Dourada Elite.

**Upload via CLI (uma vez):**

```bash
# Substitua $SUPABASE_URL e $SUPABASE_SERVICE_KEY pelos valores do projeto
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: image/png" \
  --data-binary "@assets/images/elite-cover-ref.png" \
  "$SUPABASE_URL/storage/v1/object/covers/public/elite-cover-ref.png"
```

**Ou pelo Dashboard:**

1. Supabase Dashboard → Storage → bucket `covers`
2. Cria pasta `public/`
3. Upload do arquivo local `assets/images/elite-cover-ref.png` dentro de `public/`
4. Caminho final: `covers/public/elite-cover-ref.png`

O bucket `covers` já é público (ver `002_user_cover.sql`), então o arquivo é acessível.
Se faltar, o Edge Function ainda gera a Elite — só sem a referência visual (prompt mais genérico).
