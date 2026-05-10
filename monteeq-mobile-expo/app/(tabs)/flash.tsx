import React, { useState, useCallback, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  useWindowDimensions, 
  StatusBar,
  Platform
} from 'react-native';
import { MonteeqList as FlashList } from '@/components/MonteeqList';
import { useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '@/constants/colors';
import { FlashItem } from '@/components/FlashItem';
import { useFeed } from '@/hooks/useFeed';
import { useVideo } from '@/hooks/useVideo';
import { useAuthGate } from '@/hooks/useAuthGate';
import { AuthPromptSheet } from '@/components/AuthPromptSheet';

export default function FlashScreen() {
  const { height } = useWindowDimensions();
  const navigation = useNavigation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const { requireAuth, isPromptVisible, closePrompt } = useAuthGate();

  const { 
    data, 
    fetchNextPage, 
    hasNextPage 
  } = useFeed('flash');

  const flashes = data?.pages ? data.pages.flat() : [];
  const { toggleLike } = useVideo();

  // Hide tab bar on focus, show on blur
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' },
      });
      return () => {
        setIsFocused(false);
        navigation.getParent()?.setOptions({
          tabBarStyle: undefined,
        });
      };
    }, [navigation])
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const handleLike = (videoId: number) => {
    requireAuth(() => toggleLike(videoId));
  };

  const handleComment = (videoId: number) => {
    requireAuth(() => console.log('Comment', videoId));
  };

  return (
    <View style={[styles.container, { height }]}>
      <StatusBar hidden={isFocused} barStyle="light-content" />
      
      <FlashList
        data={flashes}
        renderItem={({ item, index }) => (
          <FlashItem 
            video={item} 
            isActive={isFocused && activeIndex === index}
            onLike={handleLike}
            onCommentPress={(v) => handleComment(v.id)}
            onSharePress={(v) => console.log('Share', v.id)}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        estimatedItemSize={height}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={2}
      />

      <AuthPromptSheet 
        isVisible={isPromptVisible} 
        onClose={closePrompt} 
        message="Sign in to like and comment on your favorite Flash clips."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.BLACK,
  },
});
