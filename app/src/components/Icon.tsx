import Svg, { Path } from 'react-native-svg';

const PATHS = {
  feed: ['M3 12h4l3-8 4 16 3-8h4'],
  star: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  back: ['M15 18l-6-6 6-6'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M21 21l-4.3-4.3'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  chevron: ['M9 18l6-6-6-6'],
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  color = '#121417',
  fill = 'none',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
