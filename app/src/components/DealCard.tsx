import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { Deal } from '@/lib/api';
import { ago, diff, md, won } from '@/lib/format';
import { C } from '@/lib/theme';
import { tap } from './Controls';
import { RecordBadge } from './Motion';
import { Txt } from './Txt';

export function DealCard({ deal, index }: { deal: Deal; index: number }) {
  const d = diff(deal.amount, deal.prevAmount);
  const when = deal.isNew ? ago(deal.seenAt) : `${md(deal.dealDate)} 계약`;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(420)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${deal.name} ${deal.areaKey}제곱미터 ${won(deal.amount)}${deal.isRecord ? ' 신고가' : ''}`}
        onPress={() => {
          tap();
          router.push({ pathname: '/complex/[aptSeq]', params: { aptSeq: deal.aptSeq, area: String(deal.areaKey) } });
        }}
        style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={s.row}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <View style={s.tag}>
              <Txt w="bold" size={12} color={C.muted}>
                {deal.gu} {deal.dong}
              </Txt>
            </View>
            {deal.isRecord && <RecordBadge />}
          </View>
          <Txt size={12} color={C.muted}>
            {when}
          </Txt>
        </View>
        <View style={[s.row, { alignItems: 'flex-end', gap: 12 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt w="bold" size={16} numberOfLines={1}>
              {deal.name}
            </Txt>
            <Txt size={13} color={C.muted}>
              {deal.areaKey}㎡{deal.floor !== null ? ` · ${deal.floor}층` : ''}
              {deal.dealingType === '직거래' ? ' · 직거래' : ''}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt w="black" size={22} num style={{ letterSpacing: -0.5 }}>
              {won(deal.amount)}
            </Txt>
            {d ? (
              <Txt w="bold" size={13} num color={d.up ? C.up : C.down}>
                {d.text} <Txt size={13} color={C.muted}>직전 대비</Txt>
              </Txt>
            ) : (
              <Txt size={13} color={C.muted}>
                {deal.prevAmount === null ? '첫 거래' : '직전과 동일'}
              </Txt>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { backgroundColor: C.soft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
});
