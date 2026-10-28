import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { C } from '@/lib/theme';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * 가격 추이 선 그래프. values가 바뀔 때마다 선이 다시 그려집니다.
 */
export function PriceChart({ values, height = 170, label }: { values: number[]; height?: number; label: string }) {
  const [width, setWidth] = useState(0);
  const pad = 8;
  const geo = useMemo(() => {
    if (width === 0 || values.length < 2) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const pts = values.map((v, i) => [
      pad + (i * (width - pad * 2)) / (values.length - 1),
      pad + (height - pad * 3) * (1 - (v - lo) / span),
    ]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]} ${height - pad} L${pts[0][0]} ${height - pad} Z`;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { line, area, len, end: pts[pts.length - 1] };
  }, [values, width, height]);

  const draw = useSharedValue(0);
  const ping = useSharedValue(0);
  useEffect(() => {
    if (!geo) return;
    draw.value = 0;
    draw.value = withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) });
    ping.value = 0;
    ping.value = withDelay(1000, withRepeat(withTiming(1, { duration: 1600 }), -1, false));
  }, [geo, draw, ping]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: (geo?.len ?? 0) * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: draw.value }));
  const pingProps = useAnimatedProps(() => ({ r: 5 + ping.value * 9, opacity: 1 - ping.value }));

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={label}>
      {geo && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.up} stopOpacity={0.18} />
              <Stop offset="1" stopColor={C.up} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={0} y1={height - pad} x2={width} y2={height - pad} stroke={C.line} strokeWidth={1} />
          <APath d={geo.area} fill="url(#fill)" animatedProps={areaProps} />
          <APath
            d={geo.line}
            fill="none"
            stroke={C.up}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[geo.len, geo.len]}
            animatedProps={lineProps}
          />
          <ACircle cx={geo.end[0]} cy={geo.end[1]} fill={C.up} animatedProps={pingProps} />
          <Circle cx={geo.end[0]} cy={geo.end[1]} r={5} fill={C.up} stroke="#FFFFFF" strokeWidth={2} />
        </Svg>
      )}
    </View>
  );
}
