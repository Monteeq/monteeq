'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, postComment, likeComment } from '@/lib/browserApi';

export const useComments = (videoId, token) => {
    return useInfiniteQuery({
        queryKey: ['comments', videoId],
        queryFn: ({ pageParam = 0 }) => getComments(videoId, null, token),
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 20 ? allPages.length * 20 : undefined;
        },
        enabled: !!videoId,
    });
};

export const useAddComment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ videoId, content, token }) => postComment(videoId, content, token),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['comments', variables.videoId] });
        }
    });
};

export const useLikeComment = () => {
    return useMutation({
        mutationFn: ({ commentId, token }) => likeComment(commentId, token),
    });
};
