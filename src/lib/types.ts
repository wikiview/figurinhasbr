export type StickerType = 'player' | 'team' | 'logo' | 'legend' | 'special';

export type Sticker = {
  id: string;
  number: string;
  team: string;
  team_code: string | null;
  player_name: string | null;
  type: StickerType;
  is_shiny: boolean;
  image_url: string | null;
  display_order: number | null;
};

export type Profile = {
  id: string;
  display_name: string;
  city: string;
  state: string;
  whatsapp: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  favorite_team_code: string | null;
  is_premium: boolean;
  elite_covers_generated: number;
  created_at: string;
  updated_at: string;
};

export type UserSticker = {
  user_id: string;
  sticker_id: string;
  qty: number;
  updated_at: string;
};

export type TradeStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type TradeRequest = {
  id: string;
  from_user: string;
  to_user: string;
  status: TradeStatus;
  offer_sticker_ids: string[];
  ask_sticker_ids: string[];
  created_at: string;
  updated_at: string;
};

export type TradeMatch = {
  partner_id: string;
  display_name: string;
  city: string;
  state: string;
  whatsapp: string | null;
  avatar_url: string | null;
  they_offer: string[];
  they_need: string[];
  match_score: number;
};

export type StickerStatus = 'missing' | 'have' | 'duplicate';

export function statusFromQty(qty: number): StickerStatus {
  if (qty <= 0) return 'missing';
  if (qty === 1) return 'have';
  return 'duplicate';
}
