import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  useWindowDimensions, 
  TouchableOpacity,
  Pressable 
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence, 
  withTiming,
  runOnJS,
  FadeIn
} from 'react-native-reanimated';
import { TapGestureHandler, State, Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqAvatar } from './MonteeqAvatar';
import { Video } from '@/types/api';

interface Props {
  video: Video;
  isActive: boolean;
  onLike: (videoId: number) => void;
  onCommentPress: (video: Video) => void;
  onSharePress: (video: Video) => void;
}

export const FlashItem = ({ 
  video, 
  isActive, 
  onLike, 
  onCommentPress, 
  onSharePress 
}: Props) => {
  const { width, height } = useWindowDimensions();
  const [isLiked, setIsLiked] = useState(video.liked_by_user);
  const [progress, setProgress] = useState(0);
  
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartX = useSharedValue(0);
  const heartY = useSharedValue(0);

  const player = useVideoPlayer(video.video_url, (player) => {
    player.loop = true;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Handle double tap to like
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart((event) => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(setIsLiked)(true);
      runOnJS(onLike)(video.id);
      
      heartX.value = event.x;
      heartY.value = event.y;
      
      heartScale.value = withSequence(
        withSpring(1.5),
        withSpring(1),
        withTiming(0, { duration: 500 })
      );
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 500 })
      );
    });

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
    position: 'absolute',
    left: heartX.value - 50,
    top: heartY.value - 50,
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${(player.currentTime / player.duration) * 100}%`,
  }), [player.currentTime, player.duration]);

  return (
    <View style={[styles.container, { width, height }]}>
      <VideoView 
        player={player} 
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      <GestureDetector gesture={doubleTap}>
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.6)']}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Central Heart Animation */}
          <Animated.View style={animatedHeartStyle}>
            <Ionicons name="heart" size={100} color={COLORS.ACCENT} />
          </Animated.View>

          {/* Right Action Column */}
          <View style={styles.rightActions}>
            <TouchableOpacity 
              onPress={() => { 
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsLiked(!isLiked); 
                onLike(video.id); 
              }} 
              style={styles.actionItem}
            >
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={34} 
                color={isLiked ? COLORS.ACCENT : COLORS.WHITE} 
              />
              <Text style={styles.actionText}>{video.likes_count}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onCommentPress(video)} style={styles.actionItem}>
              <Ionicons name="chatbubble" size={30} color={COLORS.WHITE} />
              <Text style={styles.actionText}>{video.comments_count}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onSharePress(video)} style={styles.actionItem}>
              <Ionicons name="share-social" size={30} color={COLORS.WHITE} />
              <Text style={styles.actionText}>{video.shares_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <Ionicons name="bookmark" size={28} color={COLORS.WHITE} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.WHITE} />
            </TouchableOpacity>
          </View>

          {/* Bottom Left Overlay */}
          <View style={styles.bottomOverlay}>
            <View style={styles.uploaderRow}>
              <MonteeqAvatar 
                uri={video.owner?.profile_pic} 
                size={48} 
                goldRing={video.owner?.is_verified} 
              />
              <View style={styles.uploaderInfo}>
                <Text style={styles.username}>@{video.owner?.username || 'user'}</Text>
                {!video.owner_followed && (
                  <TouchableOpacity 
                    onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
                    style={styles.followBadge}
                  >
                    <Ionicons name="add" size={14} color={COLORS.BG_PRIMARY} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={styles.caption} numberOfLines={2}>
              {video.title} {video.tags ? `#${video.tags}` : ''}
            </Text>

            <View style={styles.audioRow}>
              <Ionicons name="musical-notes" size={14} color={COLORS.WHITE} />
              <Text style={styles.audioText} numberOfLines={1}>
                Original Audio - {video.owner?.username || 'user'}
              </Text>
            </View>
          </View>
        </View>
      </GestureDetector>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <Animated.View style={[styles.progressBar, animatedProgressStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.BLACK,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 80,
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 80,
    bottom: 30,
  },
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploaderInfo: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    ...TYPOGRAPHY.h3,
    color: COLORS.WHITE,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  followBadge: {
    backgroundColor: COLORS.ACCENT,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  caption: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.WHITE,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioText: {
    fontSize: 13,
    color: COLORS.WHITE,
    fontWeight: '500',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.ACCENT,
  },
});
