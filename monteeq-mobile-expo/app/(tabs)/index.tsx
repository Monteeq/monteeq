import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Dimensions,
  ImageBackground,
  Platform
} from 'react-native';
import { MonteeqList as FlashList } from '@/components/MonteeqList';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS, LAYOUT } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { VideoCard } from '@/components/VideoCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { MonteeqAvatar } from '@/components/MonteeqAvatar';
import { useFeed } from '@/hooks/useFeed';
import { useAuthStore } from '@/store/authStore';
import { useAuthGate } from '@/hooks/useAuthGate';
import { AuthPromptSheet } from '@/components/AuthPromptSheet';

const { width } = Dimensions.get('window');
const CATEGORIES = ["All", "Gaming", "Music", "Live", "Comedy", "Vlogs", "Recently uploaded", "News", "Sports", "Learning"];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { requireAuth, isPromptVisible, closePrompt } = useAuthGate();
  const [activeCategory, setActiveCategory] = useState('All');
  
  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch,
    isRefetching
  } = useFeed('home');

  const { data: flashData } = useFeed('flash');

  // Flatten video pages
  const videos = data?.pages ? data.pages.flat() : [];
  const flashVideos = flashData?.pages ? flashData.pages.flat().slice(0, 8) : [];

  const handleVideoPress = (video: any) => {
    router.push({
      pathname: '/watch',
      params: { id: video.id }
    });
  };

  const renderVideoCard = ({ item }: { item: any }) => (
    <View style={styles.gridItem}>
      <VideoCard 
        video={item} 
        onPress={() => handleVideoPress(item)} 
        onProfilePress={(userId) => router.push(`/screens/UserProfileScreen?userId=${userId}`)}
      />
    </View>
  );

  const HomeHeader = useMemo(() => (
    <View style={styles.contentContainer}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <ImageBackground 
          source={{ uri: videos[0]?.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=60' }}
          style={styles.heroImage}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', COLORS.BG_PRIMARY]}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.featuredBadge}>
                <Ionicons name="sparkles" size={12} color={COLORS.WHITE} />
                <Text style={styles.featuredText}>FEATURED</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {videos[0]?.title || 'Welcome to Monteeq'}
              </Text>
              <TouchableOpacity 
                style={styles.heroButton}
                onPress={() => videos[0] && handleVideoPress(videos[0])}
              >
                <Ionicons name="play" size={20} color={COLORS.WHITE} />
                <Text style={styles.heroButtonText}>Watch Now</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>

      {/* Category Chips */}
      <View style={styles.categoriesSection}>
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

      {/* Flash Shelf */}
      {flashVideos.length > 0 && (
        <View style={styles.flashSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="flash" size={20} color={COLORS.ACCENT} />
              <Text style={styles.sectionTitle}>Flash</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/flash')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flashScroll}>
            {flashVideos.map((v) => (
              <TouchableOpacity 
                key={v.id} 
                style={styles.flashCard}
                onPress={() => router.push('/(tabs)/flash')}
              >
                <ImageBackground 
                  source={{ uri: v.thumbnail_url }} 
                  style={styles.flashThumb}
                  imageStyle={{ borderRadius: RADIUS.md }}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                    style={styles.flashGradient}
                  >
                    <Text style={styles.flashTitle} numberOfLines={1}>{v.title}</Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recommended</Text>
      </View>
    </View>
  ), [videos, flashVideos, activeCategory]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Sticky Top Bar */}
      <BlurView intensity={80} tint="dark" style={styles.topBar}>
        <SafeAreaView style={styles.topBarContent}>
          <Text style={styles.wordmark}>Monteeq</Text>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.searchButton}>
              <Ionicons name="search" size={24} color={COLORS.TEXT_PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <MonteeqAvatar uri={user?.profile_pic} size={32} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </BlurView>

      <FlashList
        data={isLoading ? [1, 2, 3, 4] : videos.slice(1)}
        renderItem={isLoading ? () => <SkeletonCard /> : renderVideoCard}
        keyExtractor={(item, index) => isLoading ? `skeleton-${index}` : item.id.toString()}
        estimatedItemSize={300}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={HomeHeader}
        contentContainerStyle={styles.listContent}
        numColumns={1}
      />

      <AuthPromptSheet 
        isVisible={isPromptVisible} 
        onClose={closePrompt} 
        message="Sign in to interact with the best cinematic content and join the Monteeq community."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_SUBTLE,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: Platform.OS === 'ios' ? 100 : 70,
    paddingTop: Platform.OS === 'ios' ? 40 : 25,
  },
  wordmark: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 24,
    color: COLORS.ACCENT,
    letterSpacing: -0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  searchButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 100,
  },
  contentContainer: {
    marginTop: Platform.OS === 'ios' ? 100 : 70,
  },
  heroSection: {
    width: '100%',
    height: 450,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: SPACING.lg,
  },
  heroContent: {
    gap: SPACING.sm,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  featuredText: {
    color: COLORS.WHITE,
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 32,
    color: COLORS.WHITE,
    lineHeight: 38,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ACCENT,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: SPACING.sm,
  },
  heroButtonText: {
    color: COLORS.WHITE,
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  categoriesSection: {
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  categoriesScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
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
    fontFamily: 'Outfit_600SemiBold',
  },
  activeChipText: {
    color: COLORS.BG_PRIMARY,
  },
  flashSection: {
    paddingVertical: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: COLORS.WHITE,
  },
  seeAllText: {
    color: COLORS.ACCENT,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  flashScroll: {
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  flashCard: {
    width: 140,
    height: 200,
  },
  flashThumb: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  flashGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
  },
  flashTitle: {
    color: COLORS.WHITE,
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  gridItem: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
});
