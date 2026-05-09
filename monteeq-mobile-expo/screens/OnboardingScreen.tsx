import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  useWindowDimensions, 
  TouchableOpacity,
  ScrollView,
  Platform
} from 'react-native';
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
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * width, animated: true });
    } else {
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={[styles.slide, { width, height }]}>
            <OnboardingVideo uri={slide.video} />
            
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.4)', COLORS.BG_PRIMARY]}
              style={styles.gradient}
            />

            <View style={styles.content}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

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
          label={activeIndex === SLIDES.length - 1 ? "GET STARTED" : "NEXT"}
          onPress={handleNext}
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
    height: '70%',
  },
  content: {
    position: 'absolute',
    bottom: 220,
    paddingHorizontal: SPACING.xl,
    width: '100%',
  },
  title: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 42,
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 48,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 24,
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
    gap: 10,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activeDot: {
    backgroundColor: COLORS.ACCENT,
    width: 24,
  },
  button: {
    width: '100%',
  },
});
