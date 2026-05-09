import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  ImageBackground
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MonteeqList as FlashList } from '@/components/MonteeqList';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqAvatar } from '@/components/MonteeqAvatar';
import { VideoCardCompact } from '@/components/VideoCardCompact';
import { MonteeqButton } from '@/components/MonteeqButton';
import { useAuthStore } from '@/store/authStore';
import { useFeed } from '@/hooks/useFeed';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const { userId: paramsUserId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'Edits' | 'Flash' | 'Liked'>('Edits');
  
  // Use current user if no userId provided
  const user = currentUser; 
  const { data: userVideos } = useFeed('home'); // Simplified feed mapping
  const videos = userVideos?.pages.flatMap(p => p.items) || [];

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        {/* Profile Header Section */}
        <View style={styles.header}>
          <ImageBackground 
            source={{ uri: user.profile_pic || user.avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' }} 
            style={styles.banner}
          >
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient 
               colors={['transparent', COLORS.BG_PRIMARY]} 
               style={styles.bannerGradient} 
            />
          </ImageBackground>

          <View style={styles.profileInfo}>
            <MonteeqAvatar 
              uri={user.profile_pic || user.avatar_url} 
              size={110} 
              accentRing 
              isVerified={user.is_verified} 
            />
            <Text style={styles.displayName}>{user.full_name || user.username}</Text>
            <Text style={styles.username}>@{user.username}</Text>
            
            <Text style={styles.bio}>
              {user.bio || "Cinematic editor pushing the boundaries of visual art on Monteeq."}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{user.home_uploads || 0}</Text>
                <Text style={styles.statLabel}>EDITS</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{user.followers_count || 0}</Text>
                <Text style={styles.statLabel}>FOLLOWERS</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{user.following_count || 0}</Text>
                <Text style={styles.statLabel}>FOLLOWING</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <MonteeqButton 
                label="EDIT PROFILE" 
                variant="ghost" 
                size="sm" 
                onPress={() => {}}
                style={{ flex: 1 }}
              />
              <TouchableOpacity style={styles.shareBtn}>
                <Ionicons name="share-outline" size={20} color={COLORS.ACCENT} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Sticky Tabs Navigation */}
        <View style={styles.tabsContainer}>
          <BlurView intensity={20} tint="dark" style={styles.tabsBlur}>
            {(['Edits', 'Flash', 'Liked'] as const).map(tab => (
              <TouchableOpacity 
                key={tab} 
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </BlurView>
        </View>

        {/* Content Grid */}
        <View style={styles.gridContainer}>
          <FlashList
            data={videos}
            renderItem={({ item }) => (
              <VideoCardCompact 
                video={item} 
                onPress={(v) => router.push(`/screens/VideoPlayerScreen?videoId=${v.id}`)} 
              />
            )}
            keyExtractor={(item) => item.id}
            numColumns={2}
            estimatedItemSize={180}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="film-outline" size={48} color={COLORS.TEXT_MUTED} />
                <Text style={styles.emptyText}>No {activeTab.toLowerCase()} yet</Text>
              </View>
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

// Add LinearGradient import if needed
import { LinearGradient } from 'expo-linear-gradient';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  header: {
    paddingBottom: SPACING.xl,
  },
  banner: {
    height: 180,
    width: '100%',
  },
  bannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: -55,
    paddingHorizontal: 24,
  },
  displayName: {
    ...TYPOGRAPHY.h1,
    color: COLORS.WHITE,
    marginTop: 16,
    fontSize: 24,
  },
  username: {
    fontSize: 14,
    color: COLORS.ACCENT,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  bio: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 32,
    paddingVertical: 20,
    backgroundColor: COLORS.BG_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.WHITE,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  shareBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER_ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 62, 62, 0.05)',
  },
  tabsContainer: {
    backgroundColor: COLORS.BG_PRIMARY,
  },
  tabsBlur: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_SUBTLE,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ACCENT,
  },
  tabText: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    fontWeight: '900',
    letterSpacing: 1,
  },
  activeTabText: {
    color: COLORS.ACCENT,
  },
  gridContainer: {
    padding: 4,
    minHeight: 500,
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_MUTED,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
