import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  useWindowDimensions, 
  TouchableOpacity 
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqButton } from '@/components/MonteeqButton';

const SLIDES = [
  {
    id: 1,
    title: 'Discover Edits',
    subtitle: 'Taste the finest cinematic video edits from the world’s top creators.',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4',
  },
  {
    id: 2,
    title: 'Upload Your Craft',
    subtitle: 'Niche, taste-driven community. Showcase your best work in 4K.',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-11601-large.mp4',
  },
  {
    id: 3,
    title: 'Join The Community',
    subtitle: 'Connect with fellow editors and push the boundaries of video art.',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-the-forest-530-large.mp4',
  },
];

export const OnboardingScreen = ({ onFinish }: { onFinish: () => void }) => {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View style={styles.container}>
      <PagerView 
        style={styles.pager} 
        initialPage={0}
        onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <OnboardingVideo uri={slide.video} />
            
            <LinearGradient
              colors={['transparent', 'rgba(8, 8, 13, 0.8)', COLORS.BG_PRIMARY]}
              style={styles.gradient}
            />

            <View style={styles.content}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          </View>
        ))}
      </PagerView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                activeIndex === i && styles.activeDot
              ]} 
            />
          ))}
        </View>

        <MonteeqButton 
          label={activeIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          onPress={onFinish}
          style={styles.button}
        />
      </View>
    </View>
  );
};

const OnboardingVideo = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.play();
    player.muted = true;
  });

  return (
    <VideoView 
      player={player} 
      style={StyleSheet.absoluteFill} 
      contentFit="cover"
      nativeControls={false}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  content: {
    position: 'absolute',
    bottom: 180,
    paddingHorizontal: SPACING.xl,
    width: '100%',
  },
  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.BG_ELEVATED,
  },
  activeDot: {
    backgroundColor: COLORS.GOLD,
    width: 24,
  },
  button: {
    width: '100%',
  },
});
