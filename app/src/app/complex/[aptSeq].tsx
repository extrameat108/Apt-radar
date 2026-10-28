import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Chips, Segmented, tap } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { RecordBadge } from '@/components/Motion';
import { PriceChart } from '@/components/PriceChart';
import { Empty, ErrorBox, Footnote, Loading, Screen, SectionTitle } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { api, type Deal } from '@/lib/api';
import { useDevice } from '@/lib/device';
import { diff, dotDate, pyeong, won } from '@/lib/format';
import { C } from '@/lib/theme';

function WatchButton({ aptSeq }: { aptSeq: string }) {
  const { isWatching, toggleWatch } = useDevice();
  const on = isWatching('complex', aptSeq);
  const [busy, setBusy] = useState(false);
  const scale = useSharedValue(1);
  const star = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, busy }}
      accessibilityLabel={on ? '관심단지 해제' : '관심단지 등록'}
      disabled={busy}
      onPress={async () => {
        tap();
        scale.value = withSequence(withTiming(1.35, { duration: 140 }), withSpring(1, { damping: 8 }));
        setBusy(true);
        try {
          await toggleWatch('complex', aptSeq);
        } finally {
          setBusy(false);
        }
      }}
      style={{
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: on ? C.ink : C.chipLine,
        backgroundColor: on ? C.ink : C.card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}>
      <Animated.View style={star}>
        <Icon name="star" size={18} color={on ? '#FFFFFF' : C.ink} fill={on ? '#FFFFFF' : 'none'} />
      </Animated.View>
      <Txt w="bold" color={on ? '#FFFFFF' : C.ink}>
        {on ? '관심단지' : '관심 등록'}
      </Txt>
    </Pressable>
  );
}

function DealRow({ d, i }: { d: Deal; i: number }) {
  const tag = d.cancelled
    ? { label: '계약해제', fg: C.muted, bg: C.soft }
    : d.isRecord
      ? null
      : d.dealingType === '직거래'
        ? { label: '직거래', fg: '#1A47B8', bg: C.downSoft }
        : null;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(i, 10) * 40)}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.soft }}>
      <View>
        <Txt w="bold" num>
          {dotDate(d.dealDate)}
        </Txt>
        <Txt size={12} color={C.muted}>
          {d.floor !== null ? `${d.floor}층 · ` : ''}
          {d.dealingType || '거래유형 미공개'}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {d.isRecord && !d.cancelled && <RecordBadge small />}
        {tag && (
          <View style={{ backgroundColor: tag.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Txt w="bold" size={11} color={tag.fg}>
              {tag.label}
            </Txt>
          </View>
        )}
        <Txt w="black" size={16} num color={d.cancelled ? C.muted : C.ink} style={d.cancelled ? { textDecorationLine: 'line-through' } : undefined}>
          {won(d.amount)}
        </Txt>
      </View>
    </Animated.View>
  );
}

export default function ComplexScreen() {
  const params = useLocalSearchParams<{ aptSeq: string; area?: string }>();
  const [area, setArea] = useState<number | undefined>(params.area ? Number(params.area) : undefined);
  const [years, setYears] = useState<1 | 3 | 5>(1);

  const q = useQuery({ queryKey: ['complex', params.aptSeq, area], queryFn: () => api.complex(params.aptSeq, area) });
  const c = q.data;

  useEffect(() => {
    if (area === undefined && c?.areaKey) setArea(c.areaKey);
  }, [c?.areaKey, area]);

  const series = useMemo(() => {
    if (!c) return [];
    const now = new Date();
    const cutoff = `${now.getFullYear() - years}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return c.monthly.filter((m) => m.ym > cutoff);
  }, [c, years]);
  const values = series.map((m) => m.max);
  const latest = c?.deals.find((d) => !d.cancelled);
  const change = latest ? diff(latest.amount, latest.prevAmount) : null;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()} topPad={8}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={20} />
        </Pressable>
        <WatchButton aptSeq={params.aptSeq} />
      </View>

      {q.isLoading ? (
        <Loading />
      ) : q.error || !c ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(400)}>
            <Txt w="medium" size={13} color={C.muted}>
              {c.gu} {c.dong}
              {c.buildYear ? ` · ${c.buildYear}년 준공` : ''}
            </Txt>
            <Txt w="black" size={26} style={{ letterSpacing: -0.5 }} accessibilityRole="header">
              {c.name}
            </Txt>
          </Animated.View>

          {c.areas.length > 0 && (
            <Chips
              options={c.areas.map((a) => ({ value: String(a.areaKey), label: `${a.areaKey}㎡ · ${pyeong(a.areaKey)}평` }))}
              value={String(area ?? c.areaKey)}
              onChange={(v) => setArea(Number(v))}
            />
          )}

          <Animated.View
            entering={FadeInDown.delay(80).duration(400)}
            style={{ backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Txt size={13} color={C.muted}>
                  최근 실거래가 (전용 {c.areaKey}㎡)
                </Txt>
                <Txt w="black" size={34} num style={{ letterSpacing: -1 }}>
                  {latest ? won(latest.amount) : '—'}
                </Txt>
                {change && (
                  <Txt w="bold" size={13} color={change.up ? C.up : C.down}>
                    {change.text} · 직전 거래 대비
                  </Txt>
                )}
              </View>
              {latest?.isRecord && <RecordBadge />}
            </View>

            {values.length >= 2 ? (
              <>
                <PriceChart values={values} label={`최근 ${years}년 월별 최고 거래가 추이, 최저 ${won(Math.min(...values))}, 최고 ${won(Math.max(...values))}`} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt size={12} color={C.muted} num>
                    {series[0].ym.replace('-', '.')} · 최저 {won(Math.min(...values))}
                  </Txt>
                  <Txt size={12} color={C.muted} num>
                    최고 {won(Math.max(...values))}
                  </Txt>
                </View>
              </>
            ) : (
              <Empty title="그래프를 그릴 거래가 부족해요" body="기간을 늘리거나 다른 면적을 선택해 보세요." />
            )}
            <Segmented
              options={[
                { value: 1, label: '1년' },
                { value: 3, label: '3년' },
                { value: 5, label: '5년' },
              ]}
              value={years}
              onChange={setYears}
            />
            <Footnote>월별 최고 거래가 기준</Footnote>
          </Animated.View>

          <SectionTitle right={<Txt size={12} color={C.muted}>{c.deals.length}건</Txt>}>실거래 내역</SectionTitle>
          <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
            {c.deals.length === 0 ? (
              <Empty title="거래 내역이 없어요" />
            ) : (
              c.deals.map((d, i) => <DealRow key={d.id} d={d} i={i} />)
            )}
          </View>
          <Footnote>
            계약일, 층, 거래금액, 거래유형(중개·직거래), 해제 여부 등 국토교통부가 공개하는 항목만 표시합니다. 매수·매도인의
            개인정보는 다루지 않습니다.
          </Footnote>
        </>
      )}
    </Screen>
  );
}
