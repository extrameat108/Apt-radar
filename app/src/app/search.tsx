import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Empty, ErrorBox, Loading } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { api } from '@/lib/api';
import { useDevice } from '@/lib/device';
import { won } from '@/lib/format';
import { C, F } from '@/lib/theme';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const { isWatching, toggleWatch } = useDevice();

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const res = useQuery({ queryKey: ['search', q], enabled: q.length > 0, queryFn: () => api.search(q) });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, minHeight: 48 }}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="단지명 또는 동 이름 (예: 반포동)"
            placeholderTextColor={C.faint}
            accessibilityLabel="단지 검색"
            returnKeyType="search"
            style={{ flex: 1, minWidth: 0, fontFamily: F.medium, fontSize: 16, color: C.ink, paddingVertical: 10 }}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Txt w="bold">닫기</Txt>
        </Pressable>
      </View>

      {q.length === 0 ? (
        <Empty title="관심 있는 단지를 찾아보세요" body="별표를 누르면 새 거래·신고가 알림을 받아요." />
      ) : res.isLoading ? (
        <Loading />
      ) : res.error ? (
        <ErrorBox error={res.error} onRetry={() => res.refetch()} />
      ) : (res.data?.length ?? 0) === 0 ? (
        <Empty title="검색 결과가 없어요" body="최근 5년 안에 거래가 있었던 서울 아파트만 검색돼요." />
      ) : (
        <Animated.FlatList
          data={res.data}
          keyExtractor={(h) => h.aptSeq}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item: h, index }) => {
            const on = isWatching('complex', h.aptSeq);
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/complex/[aptSeq]', params: { aptSeq: h.aptSeq } })}
                  style={{ flex: 1, padding: 14 }}>
                  <Txt w="bold" numberOfLines={1}>
                    {h.name}
                  </Txt>
                  <Txt size={12} color={C.muted}>
                    {h.gu} {h.dong}
                    {h.buildYear ? ` · ${h.buildYear}년` : ''}
                    {h.lastAmount ? ` · 최근 ${won(h.lastAmount)}` : ''}
                  </Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={on ? `${h.name} 관심 해제` : `${h.name} 관심 등록`}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    tap();
                    void toggleWatch('complex', h.aptSeq);
                  }}
                  style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="star" size={22} color={on ? C.up : C.faint} fill={on ? C.up : 'none'} />
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}
