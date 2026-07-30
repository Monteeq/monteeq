'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, API_BASE_URL } from '@/lib/browserApi';

const RECS_PAGE_SIZE = 20;

function mapRecommendation(item) {
  return {
    id: item.video_id,
    title: item.title,
    thumbnail_url: item.thumbnail_url,
    cover_url: item.cover_url,
    owner: { username: item.creator_username },
    similarity_score: item.similarity_score,
  };
}

export function useRecommendations(userId, { limit = RECS_PAGE_SIZE, enabled = true } = {}) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  useEffect(() => {
    if (!userId || !enabled) return;

    let cancelled = false;

    const fetchInitial = async () => {
      setIsLoading(true);
      setError(null);
      setData([]);
      setOffset(0);
      setHasNextPage(false);

      try {
        const res = await apiFetch(
          `${API_BASE_URL}/users/${userId}/recommendations?limit=${limit}&offset=0`
        );
        if (cancelled) return;
        const mapped = (Array.isArray(res) ? res : []).map(mapRecommendation);
        setData(mapped);
        setOffset(mapped.length);
        setHasNextPage(mapped.length >= limit);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchInitial();

    return () => {
      cancelled = true;
    };
  }, [userId, limit, enabled]);

  const fetchNextPage = useCallback(async () => {
    if (isFetchingNextPage || !hasNextPage || !userId) return;
    setIsFetchingNextPage(true);
    try {
      const res = await apiFetch(
        `${API_BASE_URL}/users/${userId}/recommendations?limit=${limit}&offset=${offset}`
      );
      const mapped = (Array.isArray(res) ? res : []).map(mapRecommendation);
      setData((prev) => [...prev, ...mapped]);
      setOffset((s) => s + mapped.length);
      setHasNextPage(mapped.length >= limit);
    } catch (_) {
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [userId, limit, offset, hasNextPage, isFetchingNextPage]);

  return { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage };
}
