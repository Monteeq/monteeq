import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqAvatar } from './MonteeqAvatar';

interface Props {
  video: any;
  onPress?: (video: any) => void;
  onProfilePress?: (userId: string) => void;
}

export const VideoCard = ({ video, onPress, onProfilePress }: Props) => {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress(video);
    } else {
      router.push({
        pathname: '/watch',
        params: { id: video.id }
      });
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatViews = (num: number) => {
    if (!num) return '0 views';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K views';
    return num + ' views';
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return "Just now";
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    if (diffInDays < 365) return Math.floor(diffInDays / 30) + 'mo ago';
    return Math.floor(diffInDays / 365) + 'y ago';
  };

  const isProcessing = video.status === 'pending' || video.status === 'processing';

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={handlePress}
      style={styles.container}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: video.thumbnail_url }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={500}
        />
        
        {/* Duration Badge */}
        {!isProcessing && video.duration > 0 && (
          <BlurView intensity={40} tint="dark" style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </BlurView>
        )}

        {/* Status Badges */}
        {!isProcessing && video.views > 10000 && (
          <View style={styles.trendingBadge}>
            <Ionicons name="flame" size={12} color={COLORS.WHITE} />
            <Text style={styles.trendingText}>TRENDING</Text>
          </View>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <BlurView intensity={40} tint="dark" style={styles.processingPill}>
              <View style={styles.processingDot} />
              <Text style={styles.processingText}>PROCESSING</Text>
            </BlurView>
          </View>
        )}
      </View>

      <View style={styles.infoRow}>
        <Pressable onPress={() => onProfilePress?.(video.owner_id)}>
          <MonteeqAvatar 
            uri={video.owner_avatar || video.owner?.profile_pic} 
            size={38} 
            accentRing={video.owner?.is_verified} 
          />
        </Pressable>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
          <Text style={styles.metadata}>
            {video.owner?.username || video.owner_name} • {formatViews(video.views)} • {formatTimeAgo(video.created_at)}
          </Text>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.TEXT_MUTED} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.BG_SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  durationText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: COLORS.WHITE,
  },
  trendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  trendingText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 9,
    color: COLORS.WHITE,
    letterSpacing: 0.5,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  processingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.ACCENT,
  },
  processingText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    color: COLORS.WHITE,
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'flex-start',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 20,
  },
  metadata: {
    fontFamily: 'Outfit_400Regular',
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  moreButton: {
    padding: 4,
  },
});
