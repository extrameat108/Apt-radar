import { Platform } from 'react-native';

/** 한국 관례: 상승 빨강, 하락 파랑. 색만으로 구분하지 않도록 ▲▼도 함께 씁니다. */
export const C = {
  bg: '#F5F4EF',
  card: '#FFFFFF',
  ink: '#121417',
  muted: '#5F5E5A',
  faint: '#6B6A66',
  line: '#E4E2DC',
  soft: '#F0EEE8',
  chipLine: '#DAD8D2',
  up: '#C62828',
  upText: '#B71C1C',
  upSoft: '#FCE8E6',
  upOnDark: '#FF8A80',
  down: '#1F4FC9',
  downSoft: '#E7EEFD',
  grey: '#9C9A93',
  toggleOff: '#CFCCC4',
  onDark: '#D9D8D3',
  darkLine: '#2E3035',
};

export const F = {
  regular: 'NotoSansKR_400Regular',
  medium: 'NotoSansKR_500Medium',
  bold: 'NotoSansKR_700Bold',
  black: 'NotoSansKR_900Black',
};

export const R = { card: 20, big: 24, chip: 20 };

export const tabular = Platform.select({ default: { fontVariant: ['tabular-nums' as const] } });
