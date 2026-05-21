# Regras de monetização

Última atualização: 2026-05-17

## Tier gratuito

| Recurso | Acesso |
|---|---|
| Coleção de figurinhas, marcação manual (+/-) | ✅ Ilimitado |
| Trocas / matching social por cidade | ✅ Ilimitado |
| Scan de figurinhas via Gemini OCR | ⚠️ **10 scans por dia** (reseta às 00:00 fuso local) |
| Capa Normal com IA | ❌ Bloqueado (Premium) |
| Capa Dourada Elite | 🏆 **Desbloqueia ao completar os 43 craques.** Free user tem **1 geração grátis** após assistir rewarded ad. Premium é ilimitado. |
| Galeria de capas (histórico) | ✅ Até 10 capas, FIFO |
| Anúncios (banner + intersticial + rewarded p/ Elite) | ⚠️ Exibidos |

## Tier Premium (R$ 14,90, one-time, vitalício)

| Recurso | Acesso |
|---|---|
| Tudo do free | ✅ |
| Scan via Gemini OCR | ✅ **Ilimitado** |
| Capa Normal com IA | ✅ Liberado |
| Capa Dourada Elite | 🏆 Precisa do achievement, **ilimitado e sem ad** |
| Anúncios | ❌ Sem ads |

## Capa Dourada Elite (achievement-gated + cota por tier)

- Desbloqueada **só** ao colecionar os 43 jogadores com GIF (ver `src/data/player-gifs.ts`).
- O Premium **não** desbloqueia a capa Elite — o achievement continua obrigatório.
- Premium continua necessário pra Capa Normal.
- **Free user com achievement** tem direito a **1 geração grátis**, gated por rewarded ad.
  A cota fica em `profiles.elite_covers_generated` (incrementada pelo Edge Function com
  SERVICE_ROLE após sucesso; deletar a capa da galeria **não** reduz o contador).
- **Premium** ignora a cota e o ad — pode gerar quantas quiser (cap geral da galeria de 10 ainda vale).
- Quando o achievement `elite_collector` é desbloqueado, dispara o `EliteUnlockedModal`
  com confete + a referência da capa dourada + CTA "Gerar minha capa dourada".
  Free user vê um hint mencionando o anúncio.
- O Edge Function `generate-cover` valida **achievement + cota** no servidor (anti-tampering):
  - sem achievement → `403 elite_locked`
  - free user com cota estourada → `402 elite_quota_exhausted` (client abre paywall)

## Galeria de capas

- Cada capa gerada via `generate-cover` é salva em `public.user_covers` (variant: `standard` | `elite`).
- Cap FIFO de **10 capas por usuário** garantido por trigger SQL (`cap_user_covers`).
- A "capa ativa" continua em `profiles.cover_url` por back-compat — a galeria é o histórico
  e o user pode escolher qualquer uma das 10 como capa atual.
- Excluir uma capa só remove a linha em `user_covers` (deixa o arquivo no Storage; com cap
  de 10 o desperdício é mínimo).

## Onde tá no código

| Regra | Arquivo |
|---|---|
| Quota diária de scan (10/dia, reseta 00:00) | `src/lib/scanQuota.ts` |
| Gate do scan no StickerScanner | `src/components/StickerScanner.tsx` (função `scan()`) |
| Gate da capa premium | `src/components/CoverCreator.tsx` (função `generate()`) |
| Status premium (source of truth) | `src/lib/purchases.ts` → entitlement `premium` no RevenueCat |
| Espelho no Supabase | `profiles.is_premium` (atualizado após compra/restore) |
| Achievement Elite (definição + unlock) | `src/lib/achievements.ts` |
| Modal de unlock Elite | `src/components/EliteUnlockedModal.tsx` |
| Galeria de capas (UI + FIFO server-side) | `src/components/CoverGallery.tsx` + `supabase/migrations/006_user_covers_gallery.sql` |
| Validação server da Elite (achievement + cota) | `supabase/functions/generate-cover/index.ts` → `checkEliteEligibility` |
| Contador de Capas Elite por usuário | `profiles.elite_covers_generated` (migration `008_elite_cover_counter.sql`) |
| Rewarded ad pra cota grátis | `src/components/CoverCreator.tsx` `generate()` → `showRewarded` |

## Storage da quota

A quota de scans diários é armazenada em **AsyncStorage** local (chave `scan_quota:v1`). Isso significa:
- ✅ Funciona offline
- ✅ Rápido (sem round-trip pro servidor)
- ⚠️ Pode ser burlado reinstalando o app ou limpando dados

Pro MVP é aceitável. Se virar problema (poucos % de usuários abusando), migrar pra uma tabela `daily_quotas` no Supabase com RLS.

## Histórico

- **2026-05-16**: capa com IA migrou de "rewarded ad → libera" para "Premium-only". Motivo: cobrar pelo benefício mais "wow" gera mais conversão do que esconder atrás de ad. Reward ad foi removido do fluxo (mas o wrapper em `src/lib/ads.ts` ainda existe pra uso futuro se quiser).
- **2026-05-17**: Capa Elite passou a ter cota por tier — free com achievement tem **1 geração grátis** após rewarded ad; Premium continua ilimitado. Motivo: gerar capas Elite custa Gemini calls e a coleção das 43 era a única gate; o rewarded ad compensa o custo da única geração grátis, e o cap empurra o usuário pra Premium se ele quiser variações.
