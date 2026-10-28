import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { C } from '@/lib/theme';
import { Txt } from './Txt';

export const tap = () => {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
};

/** 가로 스크롤 칩 목록 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={({ pressed }) => [
              s.chip,
              { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.chipLine },
              pressed && { transform: [{ scale: 0.96 }] },
            ]}>
            <Txt w="bold" size={14} color={on ? '#FFFFFF' : C.ink}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 균등 분할 세그먼트 (선택 표시가 미끄러지듯 이동) */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  tone = 'soft',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  tone?: 'soft' | 'darker';
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const width = useSharedValue(0);
  const pos = useSharedValue(idx);
  useEffect(() => {
    pos.value = withSpring(idx, { damping: 18, stiffness: 220 });
  }, [idx, pos]);
  const pill = useAnimatedStyle(() => {
    const w = (width.value - 8) / options.length;
    return { width: w, transform: [{ translateX: pos.value * w }] };
  });
  return (
    <View
      onLayout={(e) => (width.value = e.nativeEvent.layout.width)}
      style={[s.seg, { backgroundColor: tone === 'soft' ? C.soft : '#E9E7E0' }]}>
      <Animated.View style={[s.segPill, pill]} />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={s.segBtn}>
            <Txt w={on ? 'black' : 'medium'} size={14}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 애니메이션 스위치 */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: 220 });
  }, [value, p]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [C.toggleOff, C.ink]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * 20 }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        tap();
        onChange(!value);
      }}>
      <Animated.View style={[s.track, track]}>
        <Animated.View style={[s.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 10, backgroundColor: '#FFFFFF' },
  segBtn: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  track: { width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center' },
  knob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
