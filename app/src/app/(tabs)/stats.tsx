import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Chips, tap } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { CountUp, GrowBar } from '@/components/Motion';
import { ErrorBox, Footnote, Loading, Screen, SectionTitle } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { api } from '@/lib/api';
import { useDevice } from '@/lib/device';
import { won } from '@/lib/format';
import { C } from '@/lib/theme';

const ORDER = ['11680', '11650', '11710', '11170', '11200', '11440'];

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={{ backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, gap: 14 }}>
      {children}
    </Animated.View>
  );
}

function Breakdown({ title, rows, delay }: { title: string; rows: { label: string; count: number }[]; delay: number }) {
  const total = rows.reduce((a, r) => a + r.count, 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card delay={delay}>
      <Txt w="black" size={16} accessibilityRole="header">
        {title}
      </Txt>
      {rows.length === 0 ? (
        <Txt size={13} color={C.muted}>
          자료 없음
        </Txt>
      ) : (
        rows.map((r, i) => (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityLabel={`${r.label} ${r.count}건`}>
            <Txt size={13} color={C.muted} style={{ width: 72 }}>
              {r.label}
            </Txt>
            <GrowBar ratio={r.count / max} color={i === 0 ? C.up : C.ink} delay={100 + i * 70} />
            <Txt w="bold" size={13} num style={{ width: 64, textAlign: 'right' }}>
              {Math.round((r.count / total) * 100)}% · {r.count}
            </Txt>
          </View>
        ))
      )}
    </Card>
  );
}

export default function StatsScreen() {
  const [sgg, setSgg] = useState('11650');
  const regions = useQuery({ queryKey: ['regions'], queryFn: api.regions, staleTime: Infinity });
  const q = useQuery({ queryKey: ['stats', sgg], queryFn: () => api.stats(sgg) });
  const { isWatching, toggleWatch } = useDevice();
  const watching = isWatching('sgg', sgg);
  const s = q.data;

  const options = [...(regions.data ?? [])]
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.code);
      const ib = ORDER.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name, 'ko');
    })
    .map((r) => ({ value: r.code, label: r.name }));
  const change = s && s.prevTotal ? Math.round(((s.total - s.prevTotal) / s.prevTotal) * 100) : null;
  const maxVol = Math.max(1, ...(s?.volume.map((v) => v.count) ?? [1]));

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View>
        <Txt w="medium" size={13} color={C.muted}>
          {s ? `${s.ym.replace('-', '년 ')}월 · 계약일 기준 월간 집계` : '월간 집계'}
        </Txt>
        <Txt w="black" size={26} style={{ letterSpacing: -0.5 }} accessibilityRole="header">
          지역 통계
        </Txt>
      </View>

      <Chips options={options} value={sgg} onChange={setSgg} />

      {q.isLoading ? (
        <Loading />
      ) : q.error || !s ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Animated.View entering={FadeInDown.duration(400)} style={{ flex: 1, backgroundColor: C.ink, borderRadius: 20, padding: 16, gap: 4 }}>
              <Txt size={12} color={C.onDark}>
                아파트 매매
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <CountUp value={s.total} size={28} color="#FFFFFF" />
                <Txt w="bold" color="#FFFFFF">
                  {' '}건
                </Txt>
              </View>
              {change !== null && (
                <Txt w="bold" size={12} color={change >= 0 ? C.upOnDark : '#9DB5F5'}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% 전월 대비
                </Txt>
              )}
            </Animated.View>
            <Animated.View
              entering={FadeInDown.delay(60).duration(400)}
              style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16, gap: 4 }}>
              <Txt size={12} color={C.muted}>
                신고가
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <CountUp value={s.records} size={28} color={C.up} />
                <Txt w="bold"> 건</Txt>
              </View>
              <Txt size={12} color={C.muted}>
                중위 {s.median ? won(s.median) : '—'} · 해제 {s.cancelled}건
              </Txt>
            </Animated.View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: watching }}
            onPress={() => {
              tap();
              void toggleWatch('sgg', sgg);
            }}
            style={{ minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: watching ? C.ink : C.chipLine, backgroundColor: watching ? C.ink : C.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="bell" size={18} color={watching ? '#FFFFFF' : C.ink} />
            <Txt w="bold" color={watching ? '#FFFFFF' : C.ink}>
              {watching ? `${s.gu} 신고가 알림 받는 중` : `${s.gu} 신고가 알림 받기`}
            </Txt>
          </Pressable>

          <Card delay={120}>
            <Txt w="black" size={16} accessibilityRole="header">
              최근 12개월 거래량
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 }} accessible accessibilityLabel={s.volume.map((v) => `${v.ym} ${v.count}건`).join(', ')}>
              {s.volume.map((v, i) => (
                <View key={v.ym} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <Animated.View
                    entering={FadeInDown.delay(150 + i * 40)}
                    style={{ width: '100%', height: `${Math.max(4, (v.count / maxVol) * 86)}%`, backgroundColor: i === s.volume.length - 1 ? C.up : C.ink, borderRadius: 4 }}
                  />
                  <Txt size={10} color={C.muted}>
                    {Number(v.ym.slice(5))}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>

          <Breakdown title="매수자 유형" rows={s.buyerTypes} delay={180} />
          <Breakdown title="거래 유형" rows={s.dealingTypes} delay={240} />

          <SectionTitle>{s.gu} 최고가 거래</SectionTitle>
          <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
            {s.top.map((d) => (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/complex/[aptSeq]', params: { aptSeq: d.aptSeq, area: String(d.areaKey) } })}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: C.soft }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt w="bold" numberOfLines={1}>
                    {d.name}
                  </Txt>
                  <Txt size={12} color={C.muted}>
                    {d.dong} · {d.areaKey}㎡
                  </Txt>
                </View>
                <Txt w="black" size={16} num>
                  {won(d.amount)}
                </Txt>
              </Pressable>
            ))}
          </View>

          <Footnote>
            국토교통부 실거래가 공개 데이터를 계약일 기준으로 집계했습니다. 매수자 유형은 국토부가 공개하는 구분(개인·법인 등)이며
            개인을 식별하는 정보는 포함하지 않습니다. 이번 달 자료는 신고 기한(30일) 때문에 아직 적게 잡힙니다.
          </Footnote>
        </>
      )}
    </Screen>
  );
}
