import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CardMode = 'modal' | 'inline';
export type ThemePref = 'light' | 'dark' | 'system';
export type ViewMode = 'cards' | 'list';

const CARD_KEY = 'figurinha:cardMode';
const THEME_KEY = 'figurinha:theme';
const VIEW_KEY = 'figurinha:viewMode';

type Ctx = {
  cardMode: CardMode;
  setCardMode: (m: CardMode) => void;
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
};

const PrefsContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [cardMode, setCardModeState] = useState<CardMode>('modal');
  const [themePref, setThemePrefState] = useState<ThemePref>('system');
  const [viewMode, setViewModeState] = useState<ViewMode>('cards');

  useEffect(() => {
    AsyncStorage.getItem(CARD_KEY).then((v) => {
      if (v === 'inline' || v === 'modal') setCardModeState(v);
    });
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setThemePrefState(v);
    });
    AsyncStorage.getItem(VIEW_KEY).then((v) => {
      if (v === 'cards' || v === 'list') setViewModeState(v);
    });
  }, []);

  const setCardMode = (m: CardMode) => {
    setCardModeState(m);
    AsyncStorage.setItem(CARD_KEY, m).catch(() => {});
  };
  const setThemePref = (t: ThemePref) => {
    setThemePrefState(t);
    AsyncStorage.setItem(THEME_KEY, t).catch(() => {});
  };
  const setViewMode = (v: ViewMode) => {
    setViewModeState(v);
    AsyncStorage.setItem(VIEW_KEY, v).catch(() => {});
  };

  return (
    <PrefsContext.Provider
      value={{
        cardMode,
        setCardMode,
        themePref,
        setThemePref,
        viewMode,
        setViewMode,
      }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefsContext(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefsContext must be inside PreferencesProvider');
  return ctx;
}
