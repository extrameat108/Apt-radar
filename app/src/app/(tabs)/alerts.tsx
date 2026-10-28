import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { tap, Toggle } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Empty, Footnote, Loading, Screen, SectionTitle } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { api, type InboxItem, type Prefs } from '@/lib/api';
import { useDevice } from '@/lib/device';
import { ago } from '@/lib/format';
import { C } from '@/lib/theme';

const ROWS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: 'record', label: '신고가 즉시 알림', desc: '관심 단지·지역에서 최고가가 갱신되면' },
  { key: 'complexAll', label: '관심 단지 모든 거래', desc: '신고되는 거래를 바로 받기' },
  { key: 'cancel', label: '관심 단지 거래 해제', desc: '계약이 해제 신고되면' },
  { key: 'weekly', label: '주간 지역 요약', desc: '월요일 오전, 관심 지역 거래량·신고가' },
  { key: 'quiet', label: '방해 금지 22:00–07:00', desc: '밤사이 알림은 아침에 모아서' },
];

const DOT: Record<InboxItem['kind'], string> = { record: C.up, new: C.ink, cancel: C.grey, weekly: C.grey };

function PushBanner() {
  const { pushStatus, enablePush } = useDevice();
  if (pushStatus === 'granted') return null;
  const text =
    pushStatus === 'unsupported'
      ? '이 기기에서는 푸시 알림을 받을 수 없어요. 아래 알림함에서 확인할 수 있어요.'
      : pushStatus === 'denied'
        ? '알림이 꺼져 있어요. 설정에서 실거래 레이더 알림을 허용해 주세요.'
        : '알림을 켜면 관심 단지 신고가를 바로 받아볼 수 있어요.';
  return (
    <Animated.View entering={FadeInUp.duration(500)} style={{ backgroundColor: C.ink, borderRadius: 20, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#24272C', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="trend" size={20} color={C.upOnDark} strokeWidth={2.4} />
        </View>
        <Txt size={14} color="#FFFFFF" style={{ flex: 1 }}>
          {text}
        </Txt>
      </View>
      {pushStatus !== 'unsupported' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            if (pushStatus === 'denied') void Linking.openSettings();
            else void enablePush();
          }}
          style={{ minHeight: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Txt w="bold">{pushStatus === 'denied' ? '설정 열기' : '알림 켜기'}</Txt>
        </Pressable>
      )}
    </Animated.View>
  );
}

export default function AlertsScreen() {
  const { installId, state, setPrefs } = useDevice();
  const inbox = useQuery({
    queryKey: ['inbox', installId],
    enabled: !!installId,
    queryFn: () => api.inbox(installId!),
    refetchInterval: 60_000,
  });

  return (
    <Screen refreshing={inbox.isRefetching} onRefresh={() => inbox.refetch()}>
      <Txt w="black" size={26} style={{ letterSpacing: -0.5 }} accessibilityRole="header">
        알림
      </Txt>

      <PushBanner />

      <SectionTitle>받을 알림</SectionTitle>
      {!state ? (
        <Loading />
      ) : (
        <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
          {ROWS.map((r) => (
            <View
              key={r.key}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.soft }}>
              <View style={{ flex: 1 }}>
                <Txt w="bold" size={15}>
                  {r.label}
                </Txt>
                <Txt size={12} color={C.muted}>
                  {r.desc}
                </Txt>
              </View>
              <Toggle label={r.label} value={state.prefs[r.key]} onChange={(v) => void setPrefs({ [r.key]: v })} />
            </View>
          ))}
        </View>
      )}

      <SectionTitle>최근 알림</SectionTitle>
      {inbox.isLoading ? (
        <Loading />
      ) : (inbox.data?.length ?? 0) === 0 ? (
        <Empty title="아직 받은 알림이 없어요" body="관심 단지나 지역을 등록하면 여기에 쌓여요." />
      ) : (
        <View style={{ gap: 8 }}>
          {inbox.data!.map((n, i) => (
            <Animated.View key={n.id} entering={FadeInDown.delay(Math.min(i, 8) * 50)}>
              <Pressable
                accessibilityRole="button"
                disabled={!n.aptSeq}
                onPress={() => {
                  tap();
                  if (n.aptSeq) router.push({ pathname: '/complex/[aptSeq]', params: { aptSeq: n.aptSeq } });
                }}
                style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DOT[n.kind] }} />
                <View style={{ flex: 1 }}>
                  <Txt w="bold">{n.title}</Txt>
                  <Txt size={12} color={C.muted}>
                    {n.body}
                  </Txt>
                </View>
                <Txt size={12} color={C.muted}>
                  {ago(n.createdAt)}
                </Txt>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
      <Footnote>알림이 한꺼번에 여러 건 생기면 하나로 묶어서 보내드려요.</Footnote>
    </Screen>
  );
}
