import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { tap } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { RecordBadge } from '@/components/Motion';
import { Empty, Footnote, Loading, Screen, SectionTitle } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { api } from '@/lib/api';
import { useDevice } from '@/lib/device';
import { diff, dotDate, won } from '@/lib/format';
import { C } from '@/lib/theme';

export default function WatchScreen() {
  const { state, toggleWatch } = useDevice();
  const complexes = state?.watches.filter((w) => w.kind === 'complex') ?? [];
  const sggs = state?.watches.filter((w) => w.kind === 'sgg') ?? [];
  const details = useQueries({
    queries: complexes.map((w) => ({ queryKey: ['complex', w.target, undefined], queryFn: () => api.complex(w.target) })),
  });

  return (
    <Screen refreshing={details.some((d) => d.isRefetching)} onRefresh={() => details.forEach((d) => d.refetch())}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt w="black" size={26} style={{ letterSpacing: -0.5 }} accessibilityRole="header">
          관심단지
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            router.push('/search');
          }}
          style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={18} color="#FFFFFF" />
          <Txt w="bold" color="#FFFFFF">
            단지 추가
          </Txt>
        </Pressable>
      </View>

      {!state ? (
        <Loading />
      ) : complexes.length === 0 ? (
        <Empty title="관심 단지가 없어요" body={'단지를 검색해 별표를 누르면\n새 거래와 신고가를 바로 알려드려요.'} />
      ) : (
        <View style={{ gap: 10 }}>
          {complexes.map((w, i) => {
            const c = details[i]?.data;
            const latest = c?.deals.find((d) => !d.cancelled);
            const ch = latest ? diff(latest.amount, latest.prevAmount) : null;
            return (
              <Animated.View key={w.target} entering={FadeInDown.delay(i * 60)} layout={LinearTransition}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    router.push({ pathname: '/complex/[aptSeq]', params: { aptSeq: w.target } });
                  }}
                  style={({ pressed }) => [
                    { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, gap: 8 },
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Txt w="bold" size={16} numberOfLines={1} style={{ flex: 1 }}>
                      {w.label}
                    </Txt>
                    {latest?.isRecord && <RecordBadge small />}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <Txt size={13} color={C.muted}>
                      {latest ? `${latest.areaKey}㎡ · ${dotDate(latest.dealDate)} 계약` : c ? '거래 없음' : '불러오는 중'}
                    </Txt>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Txt w="black" size={20} num>
                        {latest ? won(latest.amount) : ''}
                      </Txt>
                      {ch && (
                        <Txt w="bold" size={12} color={ch.up ? C.up : C.down}>
                          {ch.text}
                        </Txt>
                      )}
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      <SectionTitle>관심 지역</SectionTitle>
      <Txt size={13} color={C.muted}>
        관심 지역은 신고가가 나올 때 알려드려요. 지역통계 탭에서 추가할 수 있어요.
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {sggs.length === 0 && (
          <Txt size={13} color={C.muted}>
            아직 없어요
          </Txt>
        )}
        {sggs.map((w) => (
          <Pressable
            key={w.target}
            accessibilityRole="button"
            accessibilityLabel={`${w.label} 관심 해제`}
            onPress={() => {
              tap();
              void toggleWatch('sgg', w.target);
            }}
            style={{ minHeight: 40, paddingLeft: 14, paddingRight: 10, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.chipLine, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt w="bold">{w.label}</Txt>
            <Icon name="close" size={16} color={C.muted} />
          </Pressable>
        ))}
      </View>
      <Footnote>관심 단지는 최대 50곳까지 등록할 수 있어요.</Footnote>
    </Screen>
  );
}
