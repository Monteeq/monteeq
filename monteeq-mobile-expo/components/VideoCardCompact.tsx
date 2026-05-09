import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { Video } from '@/types/api';

interface Props {
  video: Video;
  onPress: (video: Video) => void;
}

export const VideoCardCompact = ({ video, onPress }: Props) => {
  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={() => onPress(video)}
      style={styles.container}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: video.thumbnail_url }}
          style={styles.thumbnail}
          contentFit="cover"
        />
        <View style={styles.viewBadge}>
          <Text style={styles.viewText}>{video.views} views</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>{video.title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 4,
  },
  thumbnailContainer: {
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.BG_SURFACE,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  viewBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  viewText: {
    fontSize: 10,
    color: COLORS.WHITE,
  },
  title: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '600',
    marginTop: 4,
  },
});
