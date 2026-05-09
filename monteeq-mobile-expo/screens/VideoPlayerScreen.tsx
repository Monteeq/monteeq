import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  Share
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { VideoPlayer } from '@/components/VideoPlayer';
import { MonteeqAvatar } from '@/components/MonteeqAvatar';
import { MonteeqButton } from '@/components/MonteeqButton';
import { useVideo } from '@/hooks/useVideo';
import { useFollow } from '@/hooks/useFollow';

export default function VideoPlayerScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const router = useRouter();
  const { video, isLoading, toggleLike } = useVideo(videoId);
  const { mutate: followMutation } = useFollow();
  const [showMore, setShowMore] = useState(false);

  if (isLoading || !video) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingDot} />
        <Text style={styles.loadingText}>CINEMATIC LOADING</Text>
      </View>
    );
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this edit on Monteeq: ${video.title}`,
        url: video.video_url,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const onLikePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLike(video.is_liked || false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-down" size={30} color={COLORS.WHITE} />
        </TouchableOpacity>
      </SafeAreaView>

      <VideoPlayer 
        videoUrl={video.video_url} 
        posterUrl={video.thumbnail_url} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainInfo}>
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.metaText}>
            {video.views.toLocaleString()} views · {new Date(video.created_at).toLocaleDateString()}
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={onLikePress} style={styles.actionButton}>
              <Ionicons 
                name={video.is_liked ? "heart" : "heart-outline"} 
                size={26} 
                color={video.is_liked ? COLORS.ACCENT : COLORS.TEXT_PRIMARY} 
              />
              <Text style={[styles.actionLabel, video.is_liked && { color: COLORS.ACCENT }]}>
                {video.likes_count}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="bookmark-outline" size={24} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.actionLabel}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <Ionicons name="share-outline" size={24} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="cloud-download-outline" size={24} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.actionLabel}>Download</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.uploaderSection}>
          <TouchableOpacity 
            onPress={() => router.push(`/screens/UserProfileScreen?userId=${video.owner_id}`)}
            style={styles.uploaderLeft}
          >
            <MonteeqAvatar 
              uri={video.owner_avatar} 
              size={48} 
              accentRing={video.is_verified} 
            />
            <View style={styles.uploaderText}>
              <Text style={styles.ownerName}>{video.owner_name}</Text>
              <Text style={styles.subCount}>12.4K subscribers</Text>
            </View>
          </TouchableOpacity>
          
          <MonteeqButton 
            label={video.is_following ? "Following" : "Follow"} 
            variant={video.is_following ? "ghost" : "filled"}
            size="sm"
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              followMutation({ userId: video.owner_id, isFollowing: !!video.is_following });
            }}
            style={styles.followBtn}
          />
        </View>

        <View style={styles.descriptionSection}>
          <TouchableOpacity onPress={() => setShowMore(!showMore)}>
            <Text style={styles.description} numberOfLines={showMore ? undefined : 3}>
              {video.description || "No description provided for this cinematic edit."}
            </Text>
            <Text style={styles.showMoreText}>{showMore ? "Show less" : "Read more"}</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
            {video.tags?.map(tag => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.commentPreview}>
          <Text style={styles.sectionTitle}>Comments {video.comments_count}</Text>
          <TouchableOpacity style={styles.commentInputBox}>
            <MonteeqAvatar size={24} />
            <Text style={styles.commentPlaceholder}>Add a comment...</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: COLORS.ACCENT,
    borderTopColor: 'transparent',
  },
  loadingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.ACCENT,
    fontWeight: '900',
    letterSpacing: 2,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    padding: SPACING.md,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  mainInfo: {
    padding: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  metaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.lg,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER_SUBTLE,
    marginVertical: 4,
  },
  uploaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  uploaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploaderText: {
    gap: 2,
  },
  ownerName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.TEXT_PRIMARY,
  },
  subCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_SECONDARY,
  },
  followBtn: {
    minWidth: 110,
  },
  descriptionSection: {
    paddingHorizontal: SPACING.md,
    marginTop: 8,
  },
  description: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
  },
  showMoreText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '800',
    marginTop: 8,
  },
  tagsScroll: {
    marginTop: 16,
  },
  tagChip: {
    backgroundColor: COLORS.BG_ELEVATED,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    marginRight: 10,
  },
  tagText: {
    fontSize: 13,
    color: COLORS.ACCENT,
    fontWeight: '700',
  },
  commentPreview: {
    marginTop: 32,
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
  },
  commentInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.BG_SURFACE,
    padding: 12,
    borderRadius: RADIUS.md,
  },
  commentPlaceholder: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_MUTED,
  },
});
