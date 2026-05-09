import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { height, width } = Dimensions.get('window');

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    video_url: string;
    thumbnail_url?: string;
    owner: {
      username: string;
      avatar_url?: string;
    };
    likes_count: number;
  };
}

export default function VideoCard({ video }: VideoCardProps) {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleVideoLoad = () => {
    setIsLoading(false);
  };

  const handleVideoError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  useEffect(() => {
    videoRef.current?.playAsync();
  }, []);

  return (
    <View style={styles.container}>
      {!hasError ? (
        <Video
          ref={videoRef}
          source={{ uri: video.video_url }}
          style={styles.video}
          rate={1.0}
          volume={1.0}
          isMuted={false}
          resizeMode="cover"
          useNativeControls={false}
          isLooping
          onLoad={handleVideoLoad}
          onError={handleVideoError}
        />
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load video</Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
        </View>
      )}

      {/* Bottom overlay with video info */}
      <View style={styles.infoOverlay}>
        <View style={styles.userInfo}>
          <Text style={styles.username}>@{video.owner.username}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart" size={32} color="#fff" />
            <Text style={styles.actionLabel}>{video.likes_count}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble" size={32} color="#fff" />
            <Text style={styles.actionLabel}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-social" size={32} color="#fff" />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height,
    width,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
  infoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingBottom: 80,
    paddingHorizontal: 16,
  },
  userInfo: {
    marginTop: 'auto',
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 16,
  },
  actions: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginVertical: 16,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});
