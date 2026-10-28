import { Tabs } from 'expo-router/js-tabs';

import { Icon, type IconName } from '@/components/Icon';
import { C, F } from '@/lib/theme';

const icon =
  (name: IconName) =>
  ({ color }: { color: unknown }) => <Icon name={name} color={typeof color === 'string' ? color : C.ink} />;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.faint,
        tabBarLabelStyle: { fontFamily: F.bold, fontSize: 11, lineHeight: 16 },
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: '피드', tabBarIcon: icon('feed') }} />
      <Tabs.Screen name="watch" options={{ title: '관심단지', tabBarIcon: icon('star') }} />
      <Tabs.Screen name="stats" options={{ title: '지역통계', tabBarIcon: icon('chart') }} />
      <Tabs.Screen name="alerts" options={{ title: '알림', tabBarIcon: icon('bell') }} />
    </Tabs>
  );
}
