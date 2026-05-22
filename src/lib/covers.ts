// Store local das capas geradas por IA. As capas vivem no FileSystem do device
// (documentDirectory, que é persistente) e o índice fica no AsyncStorage. Nada
// vai pro Supabase Storage — a Edge Function `generate-cover` devolve a imagem
// em base64 e ela é salva aqui. Trade-off conhecido e consciente: ao trocar de
// celular o usuário perde as capas — o app é de vida curta (Copa) e isso não
// compensa a complexidade de manter na nuvem.

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export type CoverVariant = 'standard' | 'elite';

export type LocalCover = {
  id: string;
  uri: string;
  variant: CoverVariant;
  createdAt: number;
};

const COVERS_DIR = `${FileSystem.documentDirectory}covers/`;
const INDEX_KEY = 'figurinha.covers.v1';
const MAX_COVERS = 10;

type CoversIndex = {
  activeId: string | null;
  // Ordenado do mais novo pro mais antigo.
  items: LocalCover[];
};

const EMPTY: CoversIndex = { activeId: null, items: [] };

// Pub-sub simples pra que UserCover e CoverGallery reajam quando uma capa é
// criada / trocada / apagada em qualquer parte do app.
let listeners: (() => void)[] = [];
function notify() {
  for (const l of listeners) l();
}

async function readIndex(): Promise<CoversIndex> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as CoversIndex;
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY;
    return { activeId: parsed.activeId ?? null, items: parsed.items };
  } catch {
    return EMPTY;
  }
}

async function writeIndex(index: CoversIndex): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  notify();
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(COVERS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });
  }
}

function resolveActive(index: CoversIndex): LocalCover | null {
  return (
    index.items.find((c) => c.id === index.activeId) ?? index.items[0] ?? null
  );
}

export async function getCoversState(): Promise<{
  active: LocalCover | null;
  items: LocalCover[];
}> {
  const index = await readIndex();
  return { active: resolveActive(index), items: index.items };
}

// Salva uma capa nova (base64 PNG vindo da Edge Function), torna-a a capa ativa
// e devolve o registro criado. Respeita o cap de MAX_COVERS apagando as antigas.
export async function addCover(
  base64: string,
  variant: CoverVariant,
): Promise<LocalCover> {
  await ensureDir();
  const id = `cover-${Date.now()}`;
  const uri = `${COVERS_DIR}${id}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const index = await readIndex();
  const cover: LocalCover = { id, uri, variant, createdAt: Date.now() };
  let items = [cover, ...index.items];

  // FIFO: passando do limite, apaga o arquivo das capas mais antigas.
  if (items.length > MAX_COVERS) {
    const removed = items.slice(MAX_COVERS);
    items = items.slice(0, MAX_COVERS);
    for (const r of removed) {
      await FileSystem.deleteAsync(r.uri, { idempotent: true }).catch(() => {});
    }
  }

  await writeIndex({ activeId: id, items });
  return cover;
}

export async function setActiveCover(id: string): Promise<void> {
  const index = await readIndex();
  if (!index.items.some((c) => c.id === id)) return;
  await writeIndex({ ...index, activeId: id });
}

export async function deleteCover(id: string): Promise<void> {
  const index = await readIndex();
  const target = index.items.find((c) => c.id === id);
  if (!target) return;
  await FileSystem.deleteAsync(target.uri, { idempotent: true }).catch(() => {});
  const items = index.items.filter((c) => c.id !== id);
  const activeId =
    index.activeId === id ? (items[0]?.id ?? null) : index.activeId;
  await writeIndex({ activeId, items });
}

// Hook que lê o estado das capas e re-renderiza quando algo muda em qualquer
// parte do app (via pub-sub acima).
export function useCovers(): {
  active: LocalCover | null;
  items: LocalCover[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<{
    active: LocalCover | null;
    items: LocalCover[];
    loading: boolean;
  }>({ active: null, items: [], loading: true });

  const refresh = useCallback(async () => {
    const s = await getCoversState();
    setState({ active: s.active, items: s.items, loading: false });
  }, []);

  useEffect(() => {
    let alive = true;
    const onChange = () => {
      if (alive) void refresh();
    };
    onChange();
    listeners.push(onChange);
    return () => {
      alive = false;
      listeners = listeners.filter((l) => l !== onChange);
    };
  }, [refresh]);

  return { ...state, refresh };
}
