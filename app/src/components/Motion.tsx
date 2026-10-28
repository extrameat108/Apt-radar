import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { C } from '@/lib/theme';
import { Txt } from './Txt';

/** 실시간 느낌의 맥박 점 */
export function PulseDot({ color = '#FF5A4E' }: { color?: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.8 }] }));
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: color }, ring]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

/** 끝없이 흐르는 가로 티커 */
export function Ticker({ items }: { items: { key: string; label: string; price: string }[] }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (w <= 0) return;
    x.value = 0;
    x.value = withRepeat(withTiming(-w, { duration: w * 28, easing: Easing.linear }), -1, false);
  }, [w, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  if (items.length === 0) return null;
  const row = (suffix: string) =>
    items.map((t) => (
      <View key={t.key + suffix} style={{ flexDirection: 'row', marginRight: 28 }}>
        <Txt size={13} color="#EDECE8">
          {t.label}{' '}
        </Txt>
        <Txt size={13} w="bold" color={C.upOnDark}>
          {t.price}
        </Txt>
      </View>
    ));
  return (
    <View style={{ overflow: 'hidden' }} accessible accessibilityLabel={`최근 신고가 ${items.map((i) => `${i.label} ${i.price}`).join(', ')}`}>
      <Animated.View style={[{ flexDirection: 'row' }, style]}>
        <View style={{ flexDirection: 'row' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {row('a')}
        </View>
        <View style={{ flexDirection: 'row' }}>{row('b')}</View>
      </Animated.View>
    </View>
  );
}

/** 왼쪽에서 자라나는 막대 */
export function GrowBar({ ratio, color, delay = 0, height = 14 }: { ratio: number; color: string; delay?: number; height?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withTiming(Math.max(0, Math.min(1, ratio)), { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [ratio, delay, p]);
  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={{ height, backgroundColor: C.soft, borderRadius: height / 2, overflow: 'hidden', flex: 1 }}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, style]} />
    </View>
  );
}

/** 숫자가 0부터 올라가는 카운터 */
export function CountUp({ value, size, color, suffix = '' }: { value: number; size: number; color: string; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = Date.now();
    const dur = 700;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <Txt w="black" size={size} color={color} num accessibilityLabel={`${value}${suffix}`}>
      {shown.toLocaleString('ko-KR')}
      {suffix}
    </Txt>
  );
}

/** 신고가 배지: 처음 나타날 때 톡 튀어나옴 */
export function RecordBadge({ small }: { small?: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSequence(withTiming(1.12, { duration: 260 }), withTiming(1, { duration: 160 }));
  }, [p]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: p.value }], opacity: Math.min(1, p.value * 1.5) }));
  return (
    <Animated.View style={[{ backgroundColor: C.upSoft, borderRadius: 8, paddingHorizontal: small ? 7 : 8, paddingVertical: 2 }, style]}>
      <Txt w="black" size={small ? 11 : 12} color={C.upText}>
        신고가
      </Txt>
    </Animated.View>
  );
}
