import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '@/lib/theme';
import { Txt } from './Txt';

export function Screen({
  children,
  refreshing,
  onRefresh,
  onEndReached,
  topPad = 16,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  topPad?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + topPad, paddingHorizontal: 20, paddingBottom: 32, gap: 18 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}
      scrollEventThrottle={200}
      onScroll={
        onEndReached
          ? (e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) onEndReached();
            }
          : undefined
      }>
      {children}
    </ScrollView>
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={C.ink} />
    </View>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, gap: 12, alignItems: 'flex-start' }}>
      <Txt w="bold" size={15}>
        불러오지 못했어요
      </Txt>
      <Txt size={13} color={C.muted}>
        {error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'}
      </Txt>
      {onRetry && (
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.ink, justifyContent: 'center' }}>
          <Txt w="bold" color="#FFFFFF">
            다시 시도
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ paddingVertical: 36, alignItems: 'center', gap: 6 }}>
      <Txt w="bold" size={15}>
        {title}
      </Txt>
      {body && (
        <Txt size={13} color={C.muted} style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      )}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Txt w="black" size={18} accessibilityRole="header">
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function Footnote({ children }: { children: ReactNode }) {
  return (
    <Txt size={12} color={C.muted} style={{ lineHeight: 19 }}>
      {children}
    </Txt>
  );
}
