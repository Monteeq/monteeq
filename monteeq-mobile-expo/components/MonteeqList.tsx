import React from 'react';
import {
  FlatList,
  FlatListProps,
  ViewStyle,
  StyleProp,
} from 'react-native';

/**
 * MonteeqList: A drop-in replacement for FlashList.
 * This resolves the persistent Metro resolution issues with @shopify/flash-list
 * while maintaining the exact same API signature for easier future migrations.
 */
export interface MonteeqListProps<T> extends Omit<FlatListProps<T>, 'ref'> {
  estimatedItemSize?: number;
  estimatedListSize?: { height: number; width: number };
  overrideItemLayout?: (layout: any, item: T, index: number) => void;
  drawDistance?: number;
}

export function MonteeqList<T>({
  estimatedItemSize,
  estimatedListSize,
  overrideItemLayout,
  drawDistance,
  ...props
}: MonteeqListProps<T>) {
  return (
    <FlatList
      {...props}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={8}
    />
  );
}
