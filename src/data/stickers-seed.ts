import type { StickerType } from '@/src/lib/types';
import { PLAYERS } from './players';

/**
 * Catálogo do álbum de coleção — 998 figurinhas.
 *
 * Estrutura:
 *   - Verso usa `<COD> <N>` (ex: "KOR 18", "FWC 14", "CC 7")
 *   - Por seleção: 1 = escudo, 13 = foto da seleção, demais = jogadores
 *   - 48 seleções × 20 = 960
 *
 * Estrutura completa:
 *   - 1 figurinha "Somos 26" (id 00, page 0)
 *   - FWC1-FWC8 (Especiais introdutórios, pages 1-3)
 *   - 48 seleções × 20 = 960 (pages 8-105)
 *   - FWC9-FWC19 (História da Copa, pages 106-109)
 *   - REGU, BRON, PRAT, OURO (Extra Stickers, page 110)
 *   - CC1-CC14 (Extras CC, page 111)
 *
 * Total: 1 + 8 + 960 + 11 + 4 + 14 = 998
 *
 * Ordem dos países segue a ordem do álbum (não alfabética).
 */

export type SeedSticker = {
  id: string;
  number: string;
  team: string;
  team_code: string | null;
  player_name: string | null;
  type: StickerType;
  is_shiny: boolean;
  display_order: number;
};

const TEAMS: { code: string; name: string }[] = [
  { code: 'MEX', name: 'México' },
  { code: 'RSA', name: 'África do Sul' },
  { code: 'KOR', name: 'Coreia do Sul' },
  { code: 'CZE', name: 'República Tcheca' },
  { code: 'CAN', name: 'Canadá' },
  { code: 'BIH', name: 'Bósnia e Herzegovina' },
  { code: 'QAT', name: 'Catar' },
  { code: 'SUI', name: 'Suíça' },
  { code: 'BRA', name: 'Brasil' },
  { code: 'MAR', name: 'Marrocos' },
  { code: 'HAI', name: 'Haiti' },
  { code: 'SCO', name: 'Escócia' },
  { code: 'USA', name: 'Estados Unidos' },
  { code: 'PAR', name: 'Paraguai' },
  { code: 'AUS', name: 'Austrália' },
  { code: 'TUR', name: 'Turquia' },
  { code: 'GER', name: 'Alemanha' },
  { code: 'CUW', name: 'Curaçao' },
  { code: 'CIV', name: 'Costa do Marfim' },
  { code: 'ECU', name: 'Equador' },
  { code: 'NED', name: 'Holanda' },
  { code: 'JPN', name: 'Japão' },
  { code: 'SWE', name: 'Suécia' },
  { code: 'TUN', name: 'Tunísia' },
  { code: 'BEL', name: 'Bélgica' },
  { code: 'EGY', name: 'Egito' },
  { code: 'IRN', name: 'Irã' },
  { code: 'NZL', name: 'Nova Zelândia' },
  { code: 'ESP', name: 'Espanha' },
  { code: 'CPV', name: 'Cabo Verde' },
  { code: 'KSA', name: 'Arábia Saudita' },
  { code: 'URU', name: 'Uruguai' },
  { code: 'FRA', name: 'França' },
  { code: 'SEN', name: 'Senegal' },
  { code: 'IRQ', name: 'Iraque' },
  { code: 'NOR', name: 'Noruega' },
  { code: 'ARG', name: 'Argentina' },
  { code: 'ALG', name: 'Argélia' },
  { code: 'AUT', name: 'Áustria' },
  { code: 'JOR', name: 'Jordânia' },
  { code: 'POR', name: 'Portugal' },
  { code: 'COD', name: 'Rep. Dem. do Congo' },
  { code: 'UZB', name: 'Uzbequistão' },
  { code: 'COL', name: 'Colômbia' },
  { code: 'ENG', name: 'Inglaterra' },
  { code: 'CRO', name: 'Croácia' },
  { code: 'GHA', name: 'Gana' },
  { code: 'PAN', name: 'Panamá' },
];

export function buildSeed(): SeedSticker[] {
  const out: SeedSticker[] = [];
  let order = 0;

  // ===== Página 0: Somos 26 =====
  out.push({
    id: 'FWC-00',
    number: '00',
    team: 'Especiais',
    team_code: 'FWC',
    player_name: 'Somos 26',
    type: 'special',
    is_shiny: true,
    display_order: order++,
  });

  // ===== FWC 1-4: Copa 2026 (page 1) =====
  const FWC_INTRO = [
    { n: 1, name: 'Emblema 1', shiny: true,  type: 'logo' as const },
    { n: 2, name: 'Emblema 2', shiny: true,  type: 'logo' as const },
    { n: 3, name: 'Mascotes',  shiny: false, type: 'special' as const },
    { n: 4, name: 'Slogan',    shiny: false, type: 'special' as const },
  ];
  for (const f of FWC_INTRO) {
    out.push({
      id: `FWC-${f.n}`, number: String(f.n),
      team: 'Especiais', team_code: 'FWC',
      player_name: f.name, type: f.type, is_shiny: f.shiny,
      display_order: order++,
    });
  }

  // ===== FWC 5-8: Bola + Sedes dos 3 anfitriões (pages 2-3) =====
  const FWC_HOSTS = [
    { n: 5, name: 'Bola da Copa',     shiny: true  },
    { n: 6, name: 'Sedes - Canadá',   shiny: false },
    { n: 7, name: 'Sedes - México',   shiny: false },
    { n: 8, name: 'Sedes - EUA',      shiny: false },
  ];
  for (const f of FWC_HOSTS) {
    out.push({
      id: `FWC-${f.n}`, number: String(f.n),
      team: 'Especiais', team_code: 'FWC',
      player_name: f.name, type: 'special', is_shiny: f.shiny,
      display_order: order++,
    });
  }

  // ===== 48 seleções × 20 (pages 8-105)
  // Estrutura: 1 = escudo (foil), 13 = foto da seleção, resto = jogadores
  for (const t of TEAMS) {
    const teamPlayers = PLAYERS[t.code] ?? {};
    for (let i = 1; i <= 20; i++) {
      let name: string;
      let type: StickerType;
      let shiny = false;

      if (i === 1) {
        name = 'Escudo';
        type = 'team';
        shiny = true;
      } else if (i === 13) {
        name = 'Foto da seleção';
        type = 'team';
      } else {
        name = teamPlayers[String(i)] ?? `Jogador ${i < 13 ? i - 1 : i - 2}`;
        type = 'player';
        shiny = i === 2; // goleiro/cap geralmente foil
      }

      out.push({
        id: `${t.code}-${i}`,
        number: String(i),
        team: t.name,
        team_code: t.code,
        player_name: name,
        type,
        is_shiny: shiny,
        display_order: order++,
      });
    }
  }

  // ===== FWC 9-19: História da Copa (pages 106-109) =====
  const MUSEUM = [
    { n: 9,  name: 'Itália 1934' },
    { n: 10, name: 'Uruguai 1950' },
    { n: 11, name: 'Alemanha Ocidental 1954' },
    { n: 12, name: 'Brasil 1962' },
    { n: 13, name: 'Alemanha Ocidental 1974' },
    { n: 14, name: 'Argentina 1986' },
    { n: 15, name: 'Brasil 1994' },
    { n: 16, name: 'Brasil 2002' },
    { n: 17, name: 'Itália 2006' },
    { n: 18, name: 'Alemanha 2014' },
    { n: 19, name: 'Argentina 2022' },
  ];
  for (const m of MUSEUM) {
    out.push({
      id: `FWC-${m.n}`, number: String(m.n),
      team: 'Especiais', team_code: 'FWC',
      player_name: `História: ${m.name}`,
      type: 'special', is_shiny: false,
      display_order: order++,
    });
  }

  // ===== Extras esmaltados (page 110) =====
  const EXTRAS = [
    { id: 'REGU', name: 'Regular',  shiny: false },
    { id: 'BRON', name: 'Bronze',   shiny: true  },
    { id: 'PRAT', name: 'Prata',    shiny: true  },
    { id: 'OURO', name: 'Ouro',     shiny: true  },
  ];
  for (const e of EXTRAS) {
    out.push({
      id: `EXTRA-${e.id}`,
      number: e.id,
      team: 'Esmaltadas',
      team_code: 'EXTRA',
      player_name: e.name,
      type: 'legend',
      is_shiny: e.shiny,
      display_order: order++,
    });
  }

  // ===== CC 1-14: Extras (page 111) =====
  for (let i = 1; i <= 14; i++) {
    out.push({
      id: `CC-${i}`, number: String(i),
      team: 'CC', team_code: 'CC',
      player_name: `CC ${i}`,
      type: 'special', is_shiny: true,
      display_order: order++,
    });
  }

  return out;
}

export const SEED_STICKERS = buildSeed();
