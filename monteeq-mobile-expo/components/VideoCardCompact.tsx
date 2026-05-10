import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/colors';
import { RADIUS } from '@/constants/spacing';

interface Props {
  video: any;
  onPress: (video: any) => void;
}

export const VideoCardCompact = ({ video, onPress }: Props) => {
  const formatDuration = (seconds: number) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatViews = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onPress(video)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: video.thumbnail_url }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={300}
      />
      <BlurView intensity={30} tint="dark" style={styles.statsBadge}>
        <Text style={styles.statsText}>{formatViews(video.views)} views</Text>
      </BlurView>
      {video.duration > 0 && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    aspectRatio: 9 / 11, // Slightly vertical for better grid density
    margin: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.BG_SURFACE,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  statsBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statsText: {
    color: COLORS.WHITE,
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
  },
  durationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  durationText: {
    color: COLORS.WHITE,
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
  },
});
