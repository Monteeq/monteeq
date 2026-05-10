import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Alert,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { MonteeqButton } from '@/components/MonteeqButton';
import { MonteeqInput } from '@/components/MonteeqInput';
import { ProcessingBadge } from '@/components/ProcessingBadge';
import { useUpload } from '@/hooks/useUpload';

const { width } = Dimensions.get('window');

export default function UploadScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [videoType, setVideoType] = useState<'home' | 'flash' | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  
  const { upload, isUploading, uploadProgress, processingStatus, pollStatus } = useUpload();

  const handlePickVideo = async (type: 'home' | 'flash') => {
    setVideoType(type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedVideo(result.assets[0]);
      setStep(2);
    }
  };

  const handleUpload = async () => {
    if (!selectedVideo || !title || !videoType) return;

    try {
      const data = await upload(
        {
          uri: selectedVideo.uri,
          name: 'upload.mp4',
          type: 'video/mp4',
        },
        {
          title,
          description: '',
          tags,
          video_type: videoType,
        }
      );
      setStep(3); // Moving to processing step
      if (data.processing_key) {
        pollStatus(data.processing_key);
      }
    } catch (err) {
      Alert.alert('Upload Failed', 'There was an error uploading your edit.');
    }
  };

  if (step === 3) {
    const isReady = processingStatus === 'completed';
    const isFailed = processingStatus === 'failed' || processingStatus === 'error';

    return (
      <View style={styles.processingContainer}>
        <View style={styles.processingIconWrapper}>
          <Ionicons 
            name={isReady ? "checkmark-circle" : isFailed ? "alert-circle" : "cloud-upload"} 
            size={80} 
            color={isReady ? COLORS.SUCCESS : isFailed ? COLORS.ERROR : COLORS.ACCENT} 
          />
        </View>
        <Text style={styles.processingTitle}>
          {isReady ? 'CINEMATIC READY' : isFailed ? 'UPLOAD FAILED' : 'CRAFTING YOUR EDIT'}
        </Text>
        <Text style={styles.processingSubtitle}>
          {isReady 
            ? 'Your masterpiece is now live for the Monteeq community.'
            : isFailed
            ? 'Something went wrong during transcoding. Please try again.'
            : 'Monteeq is optimizing your edit for high-fidelity playback.'}
        </Text>
        
        {!isReady && !isFailed && <ProcessingBadge />}

        <MonteeqButton 
          label={isReady ? "View Upload" : isFailed ? "Try Again" : "Go to Feed"}
          variant={isFailed ? "danger" : "filled"}
          onPress={() => {
            if (isFailed) setStep(2);
            else router.replace('/');
          }}
          style={styles.doneButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color={COLORS.WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Edit</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <View style={styles.step1}>
            <Text style={styles.sectionTitle}>Select Format</Text>
            <TouchableOpacity 
              onPress={() => handlePickVideo('home')}
              style={styles.formatCard}
            >
              <View style={styles.formatIcon}>
                <Ionicons name="desktop-outline" size={32} color={COLORS.ACCENT} />
              </View>
              <View style={styles.formatText}>
                <Text style={styles.formatTitle}>Home Feed Edit</Text>
                <Text style={styles.formatDesc}>Cinematic 16:9 widescreen edits</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => handlePickVideo('flash')}
              style={styles.formatCard}
            >
              <View style={[styles.formatIcon, { backgroundColor: 'rgba(0, 229, 255, 0.1)' }]}>
                <Ionicons name="flash" size={32} color={COLORS.NEON} />
              </View>
              <View style={styles.formatText}>
                <Text style={styles.formatTitle}>Flash Edit</Text>
                <Text style={styles.formatDesc}>Vertical 9:16 short-form clips</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.step2}>
            {selectedVideo && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: selectedVideo.uri }} style={styles.videoPreview} />
                <View style={styles.previewOverlay}>
                  <Ionicons name="play" size={44} color={COLORS.WHITE} />
                </View>
              </View>
            )}

            <MonteeqInput 
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Neon Glitch 2026"
            />

            <MonteeqInput 
              label="Tags"
              value={tags}
              onChangeText={setTags}
              placeholder="cinematic, glitch, amv"
            />

            {isUploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressLabel}>Uploading Assets</Text>
                  <Text style={styles.progressText}>{uploadProgress}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                </View>
              </View>
            )}

            <MonteeqButton 
              label="PUBLISH"
              onPress={handleUpload}
              isLoading={isUploading}
              disabled={!title || isUploading}
              style={styles.publishBtn}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.WHITE,
    fontWeight: '800',
    letterSpacing: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.WHITE,
    marginBottom: 40,
    fontSize: 32,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BG_SURFACE,
    padding: 24,
    borderRadius: RADIUS.lg,
    marginBottom: 16,
    gap: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  formatIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 62, 62, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatText: {
    flex: 1,
  },
  formatTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.WHITE,
    marginBottom: 4,
  },
  formatDesc: {
    fontSize: 13,
    color: COLORS.TEXT_MUTED,
  },
  step2: {
    gap: 20,
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.BG_SURFACE,
    marginBottom: 12,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishBtn: {
    marginTop: 32,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ACCENT,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.BG_ELEVATED,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.ACCENT,
  },
  processingContainer: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  processingIconWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.BG_SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  processingTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.WHITE,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '900',
  },
  processingSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 48,
    lineHeight: 22,
  },
  doneButton: {
    width: '100%',
  },
});
