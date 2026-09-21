import React, { useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useLocalState } from '../LocalGlobelStats';
import { resolveItemImage, unwrapFeed } from '../Helper/valueSources';

function ImageAttempt({ urls, style, onError, ...props }) {
  const [index, setIndex] = useState(0);
  if (!urls[index]) return <View style={[style, { alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel="Image unavailable">
    <Icon name="image-outline" size={20} color="#8196A0" />
  </View>;
  return <Image {...props} style={style} source={{ uri: urls[index] }} onError={event => {
    setIndex(i => i + 1);
    if (index === urls.length - 1) onError?.(event);
  }} />;
}

export default function CatalogueImage({ item, source, ...props }) {
  const { localState } = useLocalState();
  const urls = useMemo(() => {
    const primary = source?.uri || resolveItemImage(item);
    const data = unwrapFeed(localState.data);
    const rows = data?.[item?.collection || item?.type] || [];
    const catalogue = item?.imageSource || item?.imageOriginalUrl ? item
      : rows.find(row => item?.itemId ? row.itemId === item.itemId : row.name === item?.name);
    const original = catalogue?.imageOriginalUrl;
    const file = catalogue?.imageSource;
    const fallback = /^https:\/\//.test(original || '') ? original
      : file?.startsWith('File:') ? 'https://fischipedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(file.slice(5)) : null;
    return [...new Set([primary, fallback].filter(Boolean))];
  }, [item, source?.uri, localState.data]);
  return <ImageAttempt key={urls.join('|')} urls={urls} {...props} />;
}
