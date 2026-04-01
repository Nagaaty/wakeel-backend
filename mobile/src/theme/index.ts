import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

// Exact copy from el-adl-app-43.html
export const DARK_C = {
  bg:'#070809', surface:'#0F1117', card:'#161920', card2:'#1C2029',
  border:'#232733', gold:'#C8A84B', goldL:'#E5C96A', goldD:'#8B6914',
  accent:'#3B82F6', green:'#22C55E', red:'#EF4444', warn:'#F59E0B',
  text:'#EEE9DF', muted:'#6B7280', dim:'#374151',
};
export const LIGHT_C = {
  bg:'#F5F2EC', surface:'#FFFFFF', card:'#EDE9E0', card2:'#E2DDD3',
  border:'#C8C0B0', gold:'#9A6F2A', goldL:'#B8892E', goldD:'#7A5520',
  accent:'#2563EB', green:'#16A34A', red:'#DC2626', warn:'#D97706',
  text:'#1C1611', muted:'#6B5E4E', dim:'#9E9080',
};

export type Theme = typeof LIGHT_C;
export const DARK = DARK_C;
export const LIGHT = LIGHT_C;

let _theme: Theme = LIGHT_C;
let _listeners: Array<(t: Theme) => void> = [];

export async function initTheme() {
  try {
    const saved = await AsyncStorage.getItem('wakeel_theme');
    _theme = saved === 'dark' ? DARK_C : LIGHT_C;
    _listeners.forEach(l => l(_theme));
  } catch {}
}

export function toggleTheme() {
  _theme = _theme === LIGHT_C ? DARK_C : LIGHT_C;
  AsyncStorage.setItem('wakeel_theme', _theme === DARK_C ? 'dark' : 'light').catch(() => {});
  _listeners.forEach(l => l(_theme));
}

export function isDark() { return _theme === DARK_C; }

export function useTheme(): Theme {
  const [t, setT] = useState<Theme>(_theme);
  useEffect(() => {
    _listeners.push(setT);
    return () => { _listeners = _listeners.filter(l => l !== setT); };
  }, []);
  return t;
}
