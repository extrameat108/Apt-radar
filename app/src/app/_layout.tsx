import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_700Bold,
  NotoSansKR_900Black,
  useFonts,
} from '@expo-google-fonts/noto-sans-kr';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { DeviceProvider } from '@/lib/device';
import { C } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/** 알림을 누르면 해당 단지(또는 알림 탭)로 이동 */
function openFromNotification(data: Record<string, unknown> | undefined) {
  if (typeof data?.aptSeq === 'string') {
    router.push({ pathname: '/complex/[aptSeq]', params: { aptSeq: data.aptSeq } });
  } else if (data?.screen === 'alerts') {
    router.push('/alerts');
  }
}

function useNotificationTaps() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      openFromNotification(last.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openFromNotification(r.notification.request.content.data),
    );
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  const [loaded] = useFonts({ NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold, NotoSansKR_900Black });
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);
  useNotificationTaps();
  if (!loaded) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <DeviceProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="complex/[aptSeq]" />
          <Stack.Screen name="search" options={{ presentation: 'modal' }} />
        </Stack>
      </DeviceProvider>
    </QueryClientProvider>
  );
}
