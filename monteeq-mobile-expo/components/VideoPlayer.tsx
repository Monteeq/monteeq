import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { 
  Gesture, 
  GestureDetector, 
  GestureHandlerRootView 
} from 'react-native-gesture-handler';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';

const { width } = Dimensions.get('window');

interface Props {
  videoUrl: string;
  posterUrl?: string;
}

export const VideoPlayer = ({ videoUrl, posterUrl }: Props) => {
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const controlsOpacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.play();
  });

  // Handle zoom gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleControls = () => {
    const nextState = !showControls;
    setShowControls(nextState);
    controlsOpacity.value = withTiming(nextState ? 1 : 0);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={pinchGesture}>
        <View style={styles.playerContainer}>
          <Pressable onPress={toggleControls} style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.videoWrapper, animatedStyle]}>
              <VideoView 
                player={player} 
                style={styles.video} 
                contentFit="contain"
                nativeControls={false}
              />
            </Animated.View>
          </Pressable>

          {showControls && (
            <Animated.View 
              entering={FadeIn} 
              exiting={FadeOut} 
              style={styles.controlsOverlay}
            >
              {/* Play/Pause Center */}
              <TouchableOpacity 
                onPress={() => { player.playing ? player.pause() : player.play(); setIsPlaying(!isPlaying); }}
                style={styles.centerButton}
              >
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={48} 
                  color={COLORS.WHITE} 
                />
              </TouchableOpacity>

              {/* Bottom Bar */}
              <View style={styles.bottomBar}>
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(player.currentTime)}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={player.duration}
                    value={player.currentTime}
                    minimumTrackTintColor={COLORS.GOLD}
                    maximumTrackTintColor="rgba(255,255,255,0.3)"
                    thumbTintColor={COLORS.GOLD}
                    onSlidingComplete={(value) => player.seekTo(value)}
                  />
                  <Text style={styles.timeText}>{formatTime(player.duration)}</Text>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

// Simplified Pressable for the player
const Pressable = ({ children, onPress, style }: any) => (
  <TouchableOpacity activeOpacity={1} onPress={onPress} style={style}>
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: COLORS.BLACK,
  },
  playerContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  videoWrapper: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  timeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.WHITE,
    width: 40,
    textAlign: 'center',
  },
});
