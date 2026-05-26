# ⚽ Figurinha — Copa 2026

App fan-made pra ajudar colecionadores a organizar as ~984 figurinhas do álbum
da Copa 2026 e achar gente perto pra trocar.

- Coleção: marca tenho / repetidas / faltam
- Trocas: matching automático por cidade (quem tem repetida do que você precisa)
- Contato: deep link pro WhatsApp
- Premium R$ 7,90: sem anúncios + scan automático via Gemini Vision (em breve)

## Stack

- **Expo SDK 54** + **Expo Router** (file-based) + TypeScript
- **Supabase** (auth + Postgres + RLS)
- AsyncStorage pra sessão persistente
- iOS, Android e Web a partir do mesmo código

## Setup local

### 1. Clone e instale

```bash
npm install
```

### 2. Crie o projeto Supabase

1. https://supabase.com → New project (free tier serve)
2. **SQL Editor** → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e rode
   - Cria tabelas, RLS, trigger de profile e a RPC `find_trade_matches`
3. **Settings → API** → copie:
   - Project URL → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (só pra seed; **nunca** expor no app)
4. **Authentication → Providers → Email** → desabilita "Confirm email" enquanto desenvolve (re-habilita em prod)

### 3. Variáveis de ambiente

```bash
cp .env.example .env
# preencha as 3 chaves Supabase
```

### 4. Popule o catálogo (980 figurinhas)

```bash
npm run seed:stickers
```

Vai criar um placeholder das ~984 figurinhas (24 especiais + 48 seleções × 20).
Quando a lista completa for divulgada, edita `src/data/stickers-seed.ts` e roda de novo (é UPSERT idempotente).

### 5. Rodando o app

```bash
npm start
```

Escaneie o QR com o **Expo Go** (Android/iOS) ou abra `w` pra browser.

## Estrutura

```
app/                          # rotas (Expo Router)
  _layout.tsx                 # raiz: AuthProvider + redirect auth
  index.tsx                   # gate: redireciona logado/deslogado
  (auth)/                     # grupo: login + signup
  (tabs)/                     # grupo: app autenticado
    index.tsx                 # Coleção (grid 4 colunas)
    trades.tsx                # Matching de trocas
    profile.tsx               # Editar perfil + premium + sair

src/
  lib/
    supabase.ts               # client Supabase (com AsyncStorage)
    types.ts                  # tipos compartilhados
  providers/AuthProvider.tsx  # context de session + profile
  components/StickerCard.tsx  # célula da grid
  data/stickers-seed.ts       # 984 figurinhas placeholder

supabase/schema.sql           # roda 1x no SQL Editor
scripts/seed-stickers.ts      # importa o seed pro banco
```

## Modelo de dados

| Tabela          | Pra que serve                                                |
|-----------------|--------------------------------------------------------------|
| `profiles`      | Estende `auth.users` com cidade/UF/WhatsApp (criado no signup) |
| `stickers`      | Catálogo mestre das ~984 figurinhas (id no formato `KOR-18`)  |
| `user_stickers` | Coleção de cada usuário (`qty=0` falta, `1` tem, `2+` repetida) |
| `trade_requests`| Propostas formais (v1)                                        |
| `trade_messages`| Chat in-app (v1)                                              |
| `user_ratings`  | Avaliação pós-troca                                           |

A RPC `find_trade_matches(my_id)` faz o matching: pra cada usuário na sua
cidade, lista as figurinhas que ele tem repetidas e você precisa, e vice-versa.

## OCR de figurinha (premium R$ 7,90)

Estratégia: usuário fotografa o **verso** da figurinha (ou um pacote inteiro
de 7 versos lado a lado). O verso tem `KOR 18` impresso — Gemini Vision lê e
devolve a lista de IDs.

- Custo aproximado: **R$ 0,0002 por foto** (Gemini 2.0 Flash)
- Coleção inteira (~140 fotos pra cobrir 984): **~R$ 0,03**
- Margem absurda em cima do R$ 7,90 mensal/único

Implementação:
```
expo-camera → tira foto → Gemini Vision (multimodal)
→ retorno JSON estruturado com array de IDs
→ upsert em user_stickers (+1 em qty)
```

Sem suposições: o ID é exatamente o que tá no verso (`KOR-18`, `BRA-3`,
`FWC-2`). Os shinies/legends seguem o mesmo padrão.

## Próximos passos

- [ ] Substituir nomes placeholder por jogadores reais (quando lista pública for divulgada)
- [ ] AdMob (banner + intersticial) — `react-native-google-mobile-ads`
- [ ] RevenueCat para IAP do premium R$ 7,90
- [ ] Câmera + Gemini Vision pro scan automático
- [ ] Chat in-app (substituir WhatsApp link na v2)
- [ ] Sistema de avaliação pós-troca
- [ ] Push notification quando aparece match novo
- [ ] Build com EAS e submit nas lojas

## Deploy nas lojas

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all   # gera .aab e .ipa na cloud
eas submit --platform all  # manda pra Google Play e App Store
```

iOS exige conta paga ($99/ano). Android é R$ 130 vitalício.

## Segurança / privacidade

- Cidade/UF é exposta entre usuários (necessário pro matching), endereço nunca
- WhatsApp é opcional e o usuário escolhe se quer expor
- Trocas presenciais: app sempre sugere local público. Avaliação 1-5★ pós-troca
- RLS no Supabase impede usuário A de ler/editar coleção de B
