import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { api, type DeviceState, type Prefs, type Watch } from './api';

const KEY = 'apt-radar.installId';

async function getInstallId(): Promise<string> {
  const saved = await AsyncStorage.getItem(KEY);
  if (saved) return saved;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(KEY, id);
  return id;
}

export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** 알림 권한을 요청하고 Expo 푸시 토큰을 받아옵니다. 실기기 + 개발 빌드에서만 동작합니다. */
export async function obtainPushToken(ask: boolean): Promise<{ status: PushStatus; token: string | null }> {
  if (!Device.isDevice || Platform.OS === 'web') return { status: 'unsupported', token: null };
  if (Platform.OS === 'android') {
    // Android 13+는 채널이 있어야 권한 창이 뜹니다
    await Notifications.setNotificationChannelAsync('default', {
      name: '실거래 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#C62828',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { status: status === 'denied' ? 'denied' : 'undetermined', token: null };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('EAS projectId가 없어 푸시 토큰을 받을 수 없습니다. README의 "EAS 설정"을 참고하세요.');
    return { status: 'granted', token: null };
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  } catch (e) {
    console.warn('푸시 토큰 발급 실패', e);
    return { status: 'granted', token: null };
  }
}

interface DeviceCtx {
  installId: string | null;
  state: DeviceState | undefined;
  pushStatus: PushStatus;
  isWatching: (kind: Watch['kind'], target: string) => boolean;
  toggleWatch: (kind: Watch['kind'], target: string) => Promise<void>;
  setPrefs: (p: Partial<Prefs>) => Promise<void>;
  enablePush: () => Promise<PushStatus>;
}

const Ctx = createContext<DeviceCtx | null>(null);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [installId, setInstallId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>('undetermined');

  useEffect(() => {
    void getInstallId().then(setInstallId);
  }, []);

  // 앱을 열 때마다 등록(토큰이 바뀌었을 수 있음). 권한은 묻지 않고 이미 허용된 경우만 토큰을 보냅니다.
  const { data: state } = useQuery({
    queryKey: ['device', installId],
    enabled: !!installId,
    staleTime: 60_000,
    queryFn: async () => {
      const { status, token } = await obtainPushToken(false);
      setPushStatus(status);
      return api.registerDevice(installId!, token);
    },
  });

  const put = useCallback((s: DeviceState) => qc.setQueryData(['device', installId], s), [qc, installId]);

  const enablePush = useCallback(async () => {
    const { status, token } = await obtainPushToken(true);
    setPushStatus(status);
    if (installId && token) put(await api.registerDevice(installId, token));
    return status;
  }, [installId, put]);

  const watchMut = useMutation({
    mutationFn: async ({ kind, target, on }: { kind: Watch['kind']; target: string; on: boolean }) =>
      on ? api.addWatch(installId!, kind, target) : api.removeWatch(installId!, kind, target),
    onSuccess: put,
  });

  const isWatching = useCallback(
    (kind: Watch['kind'], target: string) => !!state?.watches.some((w) => w.kind === kind && w.target === target),
    [state],
  );

  const toggleWatch = useCallback(
    async (kind: Watch['kind'], target: string) => {
      if (!installId) return;
      const on = !isWatching(kind, target);
      await watchMut.mutateAsync({ kind, target, on });
      // 처음 관심 등록할 때 알림 권한을 묻습니다 (맥락이 있을 때 묻는 편이 허용률이 높습니다)
      if (on && pushStatus === 'undetermined') void enablePush();
    },
    [installId, isWatching, watchMut, pushStatus, enablePush],
  );

  const setPrefs = useCallback(
    async (p: Partial<Prefs>) => {
      if (!installId || !state) return;
      put({ ...state, prefs: { ...state.prefs, ...p } }); // 토글이 바로 반응하도록 먼저 반영
      put(await api.setPrefs(installId, p));
    },
    [installId, state, put],
  );

  return (
    <Ctx.Provider value={{ installId, state, pushStatus, isWatching, toggleWatch, setPrefs, enablePush }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDevice(): DeviceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('DeviceProvider missing');
  return v;
}
