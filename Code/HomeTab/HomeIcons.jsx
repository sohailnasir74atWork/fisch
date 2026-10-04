import React, { memo } from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

// Original 32-unit drawings. No bitmap assets, downloads or extra icon font.
const drawings = {
  values: <>
    <Path d="M5 8h12l9 9-9 9L5 14Z" fill="currentColor" fillOpacity={0.12} />
    <Path d="M5 8h12l9 9-9 9L5 14Z" />
    <Circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <Path d="m14 16 2-2m1 5 3-3" />
    <Path d="m20 5 7 7" opacity={0.5} />
  </>,
  rod: <>
    <Path d="m5 27 4-4" strokeWidth={4} />
    <Path d="M9 23 23 5c2 3 3 7 3 12v5a3 3 0 0 1-6 0v-2" />
    <Path d="m20 20 2 2M13 17l3 2" />
    <Circle cx="13" cy="21" r="3" fill="currentColor" fillOpacity={0.16} />
    <Path d="M4 30h10m8 0h5" opacity={0.4} />
  </>,
  fish: <>
    <Path d="M5 16c4-7 13-9 19-1l4-4v10l-4-4c-6 8-15 6-19-1Z" fill="currentColor" fillOpacity={0.12} />
    <Path d="M5 16c4-7 13-9 19-1l4-4v10l-4-4c-6 8-15 6-19-1Z" />
    <Path d="M14 10c3 4 3 8 0 12m-4-11 3-5 5 4" />
    <Circle cx="10" cy="15" r="1" fill="currentColor" stroke="none" />
    <Path d="M7 28h18m-14-2v2m5-2v2m5-2v2" opacity={0.55} />
  </>,
  timer: <>
    <Circle cx="16" cy="18" r="10" fill="currentColor" fillOpacity={0.12} />
    <Circle cx="16" cy="18" r="10" />
    <Path d="M12 3h8m-4 0v5m8 1 2-2M16 12v6l4 2" />
    <Path d="M6 8 4 6" opacity={0.5} />
  </>,
  inventory: <>
    <Rect x="5" y="11" width="22" height="16" rx="3" fill="currentColor" fillOpacity={0.12} />
    <Rect x="5" y="11" width="22" height="16" rx="3" />
    <Path d="M11 11V8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3M5 17h22m-13-2v5h4v-5" />
  </>,
  friends: <>
    <Circle cx="12" cy="11" r="4" fill="currentColor" fillOpacity={0.12} />
    <Circle cx="12" cy="11" r="4" />
    <Path d="M4 26v-3a8 8 0 0 1 16 0v3M23 7a4 4 0 0 1 0 8m2 4a7 7 0 0 1 3 6" />
  </>,
  star: <>
    <Path d="m16 4 4 8 9 1-6.5 6 1.5 9-8-4-8 4 1.5-9L3 13l9-1Z" fill="currentColor" fillOpacity={0.13} />
    <Path d="m16 4 4 8 9 1-6.5 6 1.5 9-8-4-8 4 1.5-9L3 13l9-1Z" />
  </>,
  trophy: <>
    <Path d="M10 5h12v9a6 6 0 0 1-12 0Z" fill="currentColor" fillOpacity={0.14} />
    <Path d="M10 5h12v9a6 6 0 0 1-12 0ZM10 8H5v3a5 5 0 0 0 5 5m12-8h5v3a5 5 0 0 1-5 5m-6 4v6m-5 2h10" />
  </>,
  gift: <>
    <Rect x="6" y="14" width="20" height="14" rx="2" fill="currentColor" fillOpacity={0.13} />
    <Path d="M6 14v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V14M16 10v18" />
    <Rect x="4" y="9" width="24" height="6" rx="1.5" />
    <Path d="M16 9c-10 0-9-7-5-6 3 1 5 6 5 6Zm0 0c10 0 9-7 5-6-3 1-5 6-5 6Z" />
  </>,
  shield: <>
    <Path d="m16 3 11 4v9c0 6-7 11-11 13C12 27 5 22 5 16V7Z" fill="currentColor" fillOpacity={0.12} />
    <Path d="m16 3 11 4v9c0 6-7 11-11 13C12 27 5 22 5 16V7Z" />
    <Path d="m11 16 3 3 7-7" />
  </>,
  egg: <>
    <Path d="M26 20c0 6-4 9-10 9S6 26 6 20 11 3 16 3s10 11 10 17Z" fill="currentColor" fillOpacity={0.12} />
    <Path d="M26 20c0 6-4 9-10 9S6 26 6 20 11 3 16 3s10 11 10 17Z" />
    <Path d="m7 19 5-3 4 4 4-4 5 3" opacity={0.6} />
  </>,
  cosmetics: <>
    <Path d="m10 5 6 4 6-4 7 7-5 5-2-2v13H10V15l-2 2-5-5Z" fill="currentColor" fillOpacity={0.12} />
    <Path d="m10 5 6 4 6-4 7 7-5 5-2-2v13H10V15l-2 2-5-5Z" />
    <Path d="m16 15 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
  </>,
  settings: <>
    <Circle cx="16" cy="16" r="8" fill="currentColor" fillOpacity={0.12} />
    <Circle cx="16" cy="16" r="8" />
    <Circle cx="16" cy="16" r="3" />
    <Path d="M16 4v4m0 16v4M4 16h4m16 0h4M7.5 7.5l2.8 2.8m11.4 11.4 2.8 2.8M7.5 24.5l2.8-2.8m11.4-11.4 2.8-2.8" strokeWidth={3} />
  </>,
  calculator: <>
    <Rect x="7" y="3" width="18" height="26" rx="3" fill="currentColor" fillOpacity={0.12} />
    <Rect x="7" y="3" width="18" height="26" rx="3" />
    <Rect x="10.5" y="6.5" width="11" height="5" rx="1" />
    <Path d="M11 16h2m3 0h2m3 0h2M11 20h2m3 0h2m3 0h2M11 24h2m3 0h2m3 0h2" />
  </>,
};

function HomeIcon({ name, size = 24, color = '#0E7C94' }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" color={color} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {drawings[name] || drawings.values}
    </G>
  </Svg>;
}
export default memo(HomeIcon);
