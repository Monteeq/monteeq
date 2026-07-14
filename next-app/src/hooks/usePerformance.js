'use client';

import { useQuery } from '@tanstack/react-query';
import { 
    getUserPerformance, 
    getUserInsights, 
    getContentAnalytics, 
    getAudienceSplit, 
    getGrowthIntelligence 
} from '@/lib/browserApi';

export const useUserPerformance = (token, metric, days) => {
    return useQuery({
        queryKey: ['performance', 'timeline', metric, days],
        queryFn: () => getUserPerformance(token, metric, days),
        enabled: !!token,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useUserInsights = (token) => {
    return useQuery({
        queryKey: ['performance', 'insights'],
        queryFn: () => getUserInsights(token),
        enabled: !!token,
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
};

export const useContentAnalytics = (token, limit) => {
    return useQuery({
        queryKey: ['performance', 'content', limit],
        queryFn: () => getContentAnalytics(token, limit),
        enabled: !!token,
        staleTime: 1000 * 60 * 15, // 15 minutes
    });
};

export const useAudienceSplit = (token, days) => {
    return useQuery({
        queryKey: ['performance', 'audience', days],
        queryFn: () => getAudienceSplit(token, days),
        enabled: !!token,
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};

export const useGrowthIntelligence = (token) => {
    return useQuery({
        queryKey: ['performance', 'growth-intel'],
        queryFn: () => getGrowthIntelligence(token),
        enabled: !!token,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};
