import { Text, type TextProps } from 'react-native';

import { C, F } from '@/lib/theme';

type Weight = 'regular' | 'medium' | 'bold' | 'black';

export function Txt({
  w = 'regular',
  size = 14,
  color = C.ink,
  num,
  style,
  ...rest
}: TextProps & { w?: Weight; size?: number; color?: string; num?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: F[w], fontSize: size, color, lineHeight: Math.round(size * 1.4) },
        num && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
