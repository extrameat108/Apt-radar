import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Chips, Segmented, tap } from '@/components/Controls';
import { DealCard } from '@/components/DealCard';
import { Icon } from '@/components/Icon';
import { CountUp, PulseDot, Ticker } from '@/components/Motion';
import { Empty, ErrorBox, Footnote, Loading, Screen, SectionTitle } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { api } from '@/lib/api';
import { ago, won } from '@/lib/format';
import { C } from '@/lib/theme';

const FIRST = ['11680', '11650', '11710', '11170', '11200', '11440']; // 강남·서초·송파·용산·성동·마포 먼저

export default function FeedScreen() {
  const [sgg, setSgg] = useState('all');
  const [mode, setMode] = useState<'all' | 'records'>('all');
  const sggParam = sgg === 'all' ? undefined : sgg;

  const regions = useQuery({ queryKey: ['regions'], queryFn: api.regions, staleTime: Infinity });
  const summary = useQuery({ queryKey: ['summary', sggParam], queryFn: () => api.summary(sggParam), refetchInterval: 60_000 });
  const feed = useInfiniteQuery({
    queryKey: ['feed', sggParam, mode],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.feed({ sgg: sggParam, records: mode === 'records', offset: pageParam }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    refetchInterval: 60_000,
  });

  const chipOptions = useMemo(() => {
    const list = regions.data ?? [];
    const ordered = [...list].sort((a, b) => {
      const ia = FIRST.indexOf(a.code);
      const ib = FIRST.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name, 'ko');
    });
    return [{ value: 'all', label: '서울 전체' }, ...ordered.map((r) => ({ value: r.code, label: r.name }))];
  }, [regions.data]);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const now = new Date();
  const today = `${now.getMonth() + 1}월 ${now.getDate()}일`;

  return (
    <Screen
      refreshing={feed.isRefetching}
      onRefresh={() => {
        void feed.refetch();
        void summary.refetch();
      }}
      onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Txt w="medium" size={13} color={C.muted}>
            {today}
          </Txt>
          <Txt w="black" size={26} style={{ letterSpacing: -0.5 }} accessibilityRole="header">
            실거래 레이더
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="단지 검색"
          onPress={() => {
            tap();
            router.push('/search');
          }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="search" size={20} />
        </Pressable>
      </View>

      <Animated.View entering={ZoomIn.duration(500)} style={{ backgroundColor: C.ink, borderRadius: 24, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PulseDot />
          <Txt w="medium" size={13} color={C.onDark}>
            오늘 새로 신고된 거래{sggParam ? ` · ${chipOptions.find((o) => o.value === sgg)?.label}` : ' · 서울'}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <CountUp value={summary.data?.todayCount ?? 0} size={40} color="#FFFFFF" />
            <Txt w="bold" size={18} color="#FFFFFF">
              {' '}건
            </Txt>
          </View>
          <View>
            <Txt size={13} color={C.onDark}>
              그중 신고가
            </Txt>
            <CountUp value={summary.data?.todayRecords ?? 0} size={22} color={C.upOnDark} suffix="건" />
          </View>
        </View>
        {(summary.data?.ticker.length ?? 0) > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: C.darkLine, paddingTop: 12 }}>
            <Ticker
              items={summary.data!.ticker.map((t) => ({ key: t.id, label: `${t.name} ${t.areaKey}㎡`, price: won(t.amount) }))}
            />
          </View>
        )}
        {summary.data?.lastIngestAt && (
          <Txt size={11} color={C.onDark}>
            {ago(summary.data.lastIngestAt)} 업데이트
          </Txt>
        )}
      </Animated.View>

      <Chips options={chipOptions} value={sgg} onChange={setSgg} />

      <SectionTitle>
        {mode === 'records' ? '신고가 거래' : '최근 신고된 거래'}
      </SectionTitle>
      <Segmented
        options={[
          { value: 'all', label: '모든 거래' },
          { value: 'records', label: '신고가만' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {feed.isLoading ? (
        <Loading />
      ) : feed.error ? (
        <ErrorBox error={feed.error} onRetry={() => feed.refetch()} />
      ) : items.length === 0 ? (
        <Empty title="아직 거래가 없어요" body="서버가 첫 수집을 마치면 여기에 표시됩니다." />
      ) : (
        <Animated.View entering={FadeIn} style={{ gap: 10 }}>
          {items.map((d, i) => (
            <DealCard key={d.id} deal={d} index={i} />
          ))}
          {feed.isFetchingNextPage && <Loading />}
        </Animated.View>
      )}

      <Footnote>
        국토교통부 실거래가 공개 데이터 기준. 거래는 계약 후 30일 안에 신고되므로, 이 피드는 계약 시점이 아니라 신고되어
        공개된 시점 순서입니다.
      </Footnote>
    </Screen>
  );
}
