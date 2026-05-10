import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  ImageBackground,
  ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MonteeqList as FlashList } from '@/components/MonteeqList';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqAvatar } from '@/components/MonteeqAvatar';
import { VideoCardCompact } from '@/components/VideoCardCompact';
import { MonteeqButton } from '@/components/MonteeqButton';
import { useAuthStore } from '@/store/authStore';
import { useFeed } from '@/hooks/useFeed';
import { useProfile } from '@/hooks/useProfile';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const { username: paramsUsername } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'Edits' | 'Flash' | 'Liked'>('Edits');
  
  const isOwnProfile = !paramsUsername || paramsUsername === currentUser?.username;
  
  // Only fetch profile if it's NOT the current user's own tab when unauthenticated
  const targetUsername = paramsUsername || currentUser?.username;
  const { data: profileUser, isLoading: isProfileLoading } = useProfile(targetUsername);

  const user = profileUser || (isOwnProfile ? currentUser : null);
  
  const { data: userVideos, isLoading: isVideosLoading } = useFeed(activeTab === 'Flash' ? 'flash' : 'home'); 
  const videos = userVideos?.pages.flat().filter(v => v.owner_id === user?.id) || [];

  // Guest State: Accessing the Profile Tab without being logged in
  if (!isAuthenticated && isOwnProfile) {
    return (
      <View style={[styles.container, styles.centered, { paddingHorizontal: 40 }]}>
        <LinearGradient
          colors={['rgba(255, 59, 48, 0.1)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.guestIconContainer}>
          <Ionicons name="person-circle-outline" size={80} color={COLORS.ACCENT} />
        </View>
        <Text style={styles.guestTitle}>Your Profile</Text>
        <Text style={styles.guestMessage}>
          Sign in to track your edits, view your statistics, and manage your Monteeq creator identity.
        </Text>
        <MonteeqButton 
          label="SIGN IN TO MONTEEQ" 
          variant="filled"
          onPress={() => router.push('/auth')} 
          style={{ width: '100%', height: 54 }}
        />
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.guestLink}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isProfileLoading && !user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.ACCENT} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={60} color={COLORS.TEXT_MUTED} />
        <Text style={styles.errorText}>USER NOT FOUND</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 20 }}>
          <Text style={styles.guestLink}>GO TO FEED</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        {/* Profile Header Section */}
        <View style={styles.header}>
          <ImageBackground 
            source={{ uri: user.profile_pic || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' }} 
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
              uri={user.profile_pic} 
              size={110} 
              accentRing 
              isVerified={user.is_verified} 
            />
            <Text style={styles.displayName}>{user.full_name || user.username}</Text>
            <Text style={styles.username}>@{user.username.toUpperCase()}</Text>
            
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
                label={isOwnProfile ? "EDIT PROFILE" : "FOLLOW"} 
                variant={isOwnProfile ? "ghost" : "filled"} 
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
          {isVideosLoading ? (
            <ActivityIndicator color={COLORS.ACCENT} style={{ marginTop: 40 }} />
          ) : (
            <FlashList
              data={videos}
              renderItem={({ item }) => (
                <VideoCardCompact 
                  video={item} 
                  onPress={(v) => router.push({ pathname: '/watch', params: { id: v.id }})} 
                />
              )}
              keyExtractor={(item) => item.id.toString()}
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
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
    fontFamily: 'Outfit_700Bold',
    color: COLORS.WHITE,
    marginTop: 16,
    fontSize: 24,
  },
  username: {
    fontSize: 14,
    color: COLORS.ACCENT,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
    marginTop: 2,
  },
  bio: {
    fontFamily: 'Outfit_400Regular',
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
    fontSize: 14,
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
    fontFamily: 'Outfit_800ExtraBold',
    color: COLORS.WHITE,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
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
    borderColor: COLORS.ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
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
    fontFamily: 'Outfit_700Bold',
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
    fontFamily: 'Outfit_700Bold',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 1,
  },
  errorText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: COLORS.ACCENT,
    fontSize: 20,
    marginTop: 16,
  },
  guestIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  guestTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    color: COLORS.WHITE,
    marginBottom: 12,
  },
  guestMessage: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  guestLink: {
    fontFamily: 'Outfit_700Bold',
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    letterSpacing: 1,
  }
});
