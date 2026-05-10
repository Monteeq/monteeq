import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { SPACING, RADIUS } from '@/constants/spacing';
import { TYPOGRAPHY } from '@/constants/typography';
import { VideoCardCompact } from '@/components/VideoCardCompact';
import { MonteeqAvatar } from '@/components/MonteeqAvatar';
import { MonteeqList } from '@/components/MonteeqList';
import { useFeed } from '@/hooks/useFeed';
import axios from 'axios';
import { EXPO_PUBLIC_API_URL } from '@/constants/env';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'Videos' | 'Creators'>('Videos');
  const [trending, setTrending] = useState<string[]>([]);
  
  // Use 'home' feed as a placeholder for search results until dedicated search API is integrated
  const { data: searchResults, isLoading } = useFeed('home'); 
  const videos = searchResults?.pages ? searchResults.pages.flat() : [];

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      const resp = await axios.get(`${EXPO_PUBLIC_API_URL}/api/v1/videos/trending-suggestions`);
      setTrending(resp.data);
    } catch (e) {
      console.warn("Failed to fetch trending suggestions");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.TEXT_MUTED} style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Explore cinematic edits..."
            placeholderTextColor={COLORS.TEXT_MUTED}
            value={query}
            onChangeText={setQuery}
            selectionColor={COLORS.ACCENT}
            autoFocus={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.TEXT_MUTED} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabToggle}>
          {(['Videos', 'Creators'] as const).map(type => (
            <TouchableOpacity 
              key={type}
              onPress={() => setSearchType(type)}
              style={[styles.typeBtn, searchType === type && styles.activeTypeBtn]}
            >
              <Text style={[styles.typeBtnText, searchType === type && styles.activeTypeBtnText]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!query ? (
        <ScrollView style={styles.noQueryContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>TRENDING SEARCHES</Text>
          <View style={styles.tagCloud}>
            {trending.length > 0 ? trending.map(tag => (
              <TouchableOpacity 
                key={tag} 
                onPress={() => setQuery(tag.startsWith('@') ? tag.slice(1) : tag)}
                style={styles.tag}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </TouchableOpacity>
            )) : (
              <ActivityIndicator color={COLORS.ACCENT} style={{ marginLeft: SPACING.md }} />
            )}
          </View>
          
          <Text style={[styles.sectionTitle, { marginTop: 48 }]}>FEATURED CREATORS</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[1, 2, 3, 4]}
            keyExtractor={(item) => item.toString()}
            renderItem={() => (
              <TouchableOpacity style={styles.creatorCard}>
                <MonteeqAvatar size={72} accentRing />
                <Text style={styles.creatorName}>Elite_Edits</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ gap: 24, paddingHorizontal: SPACING.md }}
          />
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <MonteeqList
          key={searchType} // CRITICAL: Force re-render when changing numColumns
          data={videos}
          renderItem={({ item }) => (
            searchType === 'Videos' ? (
              <VideoCardCompact 
                video={item} 
                onPress={(v) => router.push({ pathname: '/watch', params: { id: v.id }})} 
              />
            ) : (
              <TouchableOpacity 
                onPress={() => router.push(`/screens/UserProfileScreen?userId=${item.owner_id}`)}
                style={styles.userListItem}
              >
                <MonteeqAvatar size={52} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.owner_name}</Text>
                  <Text style={styles.userStats}>12.4K followers</Text>
                </View>
                <TouchableOpacity style={styles.miniFollowBtn}>
                  <Text style={styles.miniFollowBtnText}>Follow</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )
          )}
          numColumns={searchType === 'Videos' ? 2 : 1}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listPadding}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  searchHeader: {
    padding: SPACING.md,
    gap: 16,
    marginTop: Platform.OS === 'android' ? 25 : 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BG_SURFACE,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.BG_SURFACE,
    borderRadius: 30,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 26,
  },
  activeTypeBtn: {
    backgroundColor: COLORS.ACCENT,
  },
  typeBtnText: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  activeTypeBtnText: {
    color: COLORS.WHITE,
  },
  noQueryContainer: {
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
    color: COLORS.TEXT_MUTED,
    paddingHorizontal: SPACING.md,
    marginBottom: 20,
    letterSpacing: 2,
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: 10,
  },
  tag: {
    backgroundColor: COLORS.BG_ELEVATED,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  tagText: {
    fontSize: 13,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: 'Outfit_600SemiBold',
  },
  creatorCard: {
    alignItems: 'center',
    gap: 12,
  },
  creatorName: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontFamily: 'Outfit_700Bold',
  },
  listPadding: {
    padding: 8,
  },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.BG_SURFACE,
    borderRadius: RADIUS.lg,
    marginBottom: 10,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SUBTLE,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  userStats: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    marginTop: 2,
    fontFamily: 'Outfit_400Regular',
  },
  miniFollowBtn: {
    backgroundColor: COLORS.ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  miniFollowBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
    color: COLORS.WHITE,
  },
});
