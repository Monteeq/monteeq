import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  Share,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqAvatar } from '@/components/MonteeqAvatar';
import { useAuthStore } from '@/store/authStore';
import { useAuthGate } from '@/hooks/useAuthGate';
import { AuthPromptSheet } from '@/components/AuthPromptSheet';
import { videoApi } from '@/lib/api/videos';

const { width } = Dimensions.get('window');

export default function WatchScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { requireAuth, isPromptVisible, closePrompt } = useAuthGate();
  
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Fetch Video Data
  useEffect(() => {
    const fetchVideo = async () => {
      if (!id) return;
      try {
        const videoId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
        if (isNaN(videoId)) {
          console.error("Invalid video ID:", id);
          setLoading(false);
          return;
        }
        const data = await videoApi.getVideo(videoId);
        setVideo(data);
      } catch (err) {
        console.error("Failed to fetch video:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVideo();
  }, [id]);

  const player = useVideoPlayer(video?.video_url || '', (player) => {
    player.loop = false;
    player.play();
  });

  const handleLike = () => {
    requireAuth(async () => {
      if (!video) return;
      try {
        const result = await videoApi.likeVideo(video.id);
        setVideo((prev: any) => ({
          ...prev,
          liked_by_user: result.liked,
          likes_count: result.likes_count
        }));
      } catch (err) {
        console.error("Like failed:", err);
      }
    });
  };

  const handleShare = async () => {
    if (!video) return;
    try {
      await Share.share({
        message: `Check out ${video.title} on Monteeq!`,
        url: `https://monteeq.com/watch/${video.id}`
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownload = () => {
    requireAuth(() => {
      // Implement download logic or show quality selector
      console.log("Download triggered");
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.ACCENT} size="large" />
      </View>
    );
  }

  if (!video) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Video not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
        />
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={() => router.back()}
        >
          <BlurView intensity={30} tint="dark" style={styles.closeBlur}>
            <Ionicons name="chevron-down" size={28} color={COLORS.WHITE} />
          </BlurView>
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title & Stats */}
        <View style={styles.metaSection}>
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.stats}>
            {video.views?.toLocaleString()} views • {new Date(video.created_at).toLocaleDateString()}
          </Text>
        </View>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Ionicons 
              name={video.liked_by_user ? "heart" : "heart-outline"} 
              size={24} 
              color={video.liked_by_user ? COLORS.ACCENT : COLORS.TEXT_PRIMARY} 
            />
            <Text style={[styles.actionText, video.liked_by_user && { color: COLORS.ACCENT }]}>
              {video.likes_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={24} color={COLORS.TEXT_PRIMARY} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleDownload}>
            <Ionicons name="download-outline" size={24} color={COLORS.TEXT_PRIMARY} />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
        </View>

        {/* Creator Info */}
        <View style={styles.creatorSection}>
          <TouchableOpacity 
            style={styles.creatorLeft}
            onPress={() => router.push(`/screens/UserProfileScreen?userId=${video.owner_id}`)}
          >
            <MonteeqAvatar uri={video.owner?.profile_pic} size={44} />
            <View>
              <Text style={styles.username}>{video.owner?.username}</Text>
              <Text style={styles.followers}>{video.owner?.followers_count || 0} followers</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.subscribeBtn}
            onPress={() => requireAuth(() => console.log("Follow triggered"))}
          >
            <Text style={styles.subscribeText}>FOLLOW</Text>
          </TouchableOpacity>
        </View>

        {/* Description Box */}
        <TouchableOpacity 
          style={styles.descriptionBox}
          onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
        >
          <Text 
            style={styles.descriptionText}
            numberOfLines={isDescriptionExpanded ? undefined : 3}
          >
            {video.description || "No description provided."}
          </Text>
          {video.tags && (
            <View style={styles.tagContainer}>
              {video.tags.split(',').map((tag: string, i: number) => (
                <Text key={i} style={styles.tag}>#{tag.trim()}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* Comments Preview */}
        <View style={styles.commentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Comments</Text>
            <Text style={styles.commentCount}>{video.comments_count || 0}</Text>
          </View>
          <TouchableOpacity 
            style={styles.commentInputPlaceholder}
            onPress={() => requireAuth(() => console.log("Comment triggered"))}
          >
            <MonteeqAvatar uri={user?.profile_pic} size={28} />
            <Text style={styles.placeholderText}>Add a comment...</Text>
          </TouchableOpacity>
        </View>

        {/* Suggested Placeholder */}
        <View style={styles.suggestedSection}>
          <Text style={styles.sectionTitle}>Up Next</Text>
          <View style={styles.placeholderCard}>
            <ActivityIndicator color={COLORS.BG_ELEVATED} />
          </View>
        </View>
      </ScrollView>

      <AuthPromptSheet 
        isVisible={isPromptVisible} 
        onClose={closePrompt} 
        message="Sign in to like, comment, and follow your favorite cinematic creators."
      />
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
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 20,
    zIndex: 10,
  },
  closeBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  metaSection: {
    padding: SPACING.md,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: COLORS.WHITE,
    marginBottom: 4,
  },
  stats: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: COLORS.TEXT_MUTED,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: 12,
    marginBottom: SPACING.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.BG_ELEVATED,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  actionText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  creatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  username: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: COLORS.WHITE,
  },
  followers: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
  },
  subscribeBtn: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  subscribeText: {
    color: COLORS.BG_PRIMARY,
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },
  descriptionBox: {
    padding: SPACING.md,
    backgroundColor: COLORS.BG_ELEVATED,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
  },
  descriptionText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    color: COLORS.ACCENT,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  commentsSection: {
    padding: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: COLORS.WHITE,
  },
  commentCount: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    color: COLORS.TEXT_MUTED,
  },
  commentInputPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.BG_ELEVATED,
    padding: 10,
    borderRadius: RADIUS.md,
  },
  placeholderText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
  },
  suggestedSection: {
    padding: SPACING.md,
  },
  placeholderCard: {
    height: 100,
    backgroundColor: COLORS.BG_ELEVATED,
    borderRadius: RADIUS.md,
    marginTop: 10,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  errorText: {
    color: COLORS.WHITE,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    color: COLORS.WHITE,
    fontFamily: 'Outfit_700Bold',
  }
});
