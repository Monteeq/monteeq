import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqAvatar } from './MonteeqAvatar';
import { Video } from '@/types/api';

interface Props {
  video: Video;
  onPress: (video: Video) => void;
  onProfilePress?: (userId: string) => void;
}

export const VideoCard = ({ video, onPress, onProfilePress }: Props) => {
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
      onPress={() => onPress(video)}
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
          <BlurView intensity={30} tint="dark" style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </BlurView>
        )}

        {/* Quality Badge */}
        {!isProcessing && (
          <View style={styles.qualityBadge}>
            <Text style={styles.qualityText}>4K</Text>
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

        {video.status === 'failed' && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle" size={32} color={COLORS.ERROR} />
            <Text style={styles.errorText}>UPLOAD FAILED</Text>
          </View>
        )}
      </View>

      <View style={styles.infoRow}>
        <Pressable onPress={() => onProfilePress?.(video.owner_id)}>
          <MonteeqAvatar 
            uri={video.owner_avatar} 
            size={36} 
            goldRing={video.is_verified} 
          />
        </Pressable>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
          <Text style={styles.metadata}>
            {video.owner_name} • {formatViews(video.views)} • {formatTimeAgo(video.created_at)}
          </Text>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.BG_SURFACE,
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
    ...TYPOGRAPHY.caption,
    color: COLORS.WHITE,
    fontWeight: '700',
  },
  qualityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  qualityText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.WHITE,
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
    backgroundColor: COLORS.NEON,
  },
  processingText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.WHITE,
    letterSpacing: 1,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.ERROR,
    fontWeight: '900',
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  textContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '600',
    lineHeight: 20,
  },
  metadata: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
  moreButton: {
    padding: SPACING.xs,
  },
});
