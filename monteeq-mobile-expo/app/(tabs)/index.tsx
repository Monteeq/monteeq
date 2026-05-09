import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { MonteeqList as FlashList } from '@/components/MonteeqList';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS, LAYOUT } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { VideoCard } from '@/components/VideoCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { MonteeqAvatar } from '@/components/MonteeqAvatar';
import { useFeed } from '@/hooks/useFeed';
import { useAuthStore } from '@/store/authStore';

const CATEGORIES = ['For You', 'Trending', 'AMVs', 'Cinematic', 'Gaming', 'Music', 'Sports'];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeCategory, setActiveCategory] = useState('For You');
  
  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch 
  } = useFeed('home');

  const videos = data?.pages.flatMap(page => page.items) || [];

  const handleVideoPress = (video: any) => {
    router.push({
      pathname: '/screens/VideoPlayerScreen',
      params: { videoId: video.id }
    });
  };

  const handleProfilePress = (userId: string) => {
    router.push(`/screens/UserProfileScreen?userId=${userId}`);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Sticky Header */}
      <BlurView intensity={30} tint="dark" style={styles.header}>
        <SafeAreaView style={styles.headerContent}>
          <Text style={styles.wordmark}>Monteeq</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.TEXT_PRIMARY} />
              <View style={styles.unreadDot} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <MonteeqAvatar uri={user?.profile_pic || user?.avatar_url} size={34} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </BlurView>

      <FlashList
        data={isLoading ? [1, 2, 3] : videos}
        renderItem={({ item }) => (
          isLoading ? <SkeletonCard /> : (
            <VideoCard 
              video={item} 
              onPress={handleVideoPress} 
              onProfilePress={handleProfilePress}
            />
          )
        )}
        keyExtractor={(item, index) => isLoading ? `skeleton-${index}` : item.id}
        estimatedItemSize={300}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshing={isLoading}
        onRefresh={refetch}
        ListHeaderComponent={
          <View style={styles.categoriesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity 
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[
                    styles.chip,
                    activeCategory === cat && styles.activeChip
                  ]}
                >
                  <Text style={[
                    styles.chipText,
                    activeCategory === cat && styles.activeChipText
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <SkeletonCard />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    height: LAYOUT.HEADER_HEIGHT_MOBILE + 20, // Adjust for SafeArea
  },
  wordmark: {
    ...TYPOGRAPHY.h1,
    color: COLORS.ACCENT,
    fontSize: 22,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconButton: {
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.ACCENT,
    borderWidth: 2,
    borderColor: COLORS.BG_PRIMARY,
  },
  categoriesContainer: {
    marginTop: 110, // Increased offset for header
    marginBottom: SPACING.md,
  },
  categoriesScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.sm, // Matching web's 8px/12px
    backgroundColor: COLORS.BG_ELEVATED,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  activeChip: {
    backgroundColor: COLORS.WHITE,
    borderColor: COLORS.WHITE,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '600',
  },
  activeChipText: {
    color: COLORS.BG_PRIMARY,
  },
  listContent: {
    paddingBottom: 100,
  },
  footerLoader: {
    paddingVertical: SPACING.md,
  },
});
