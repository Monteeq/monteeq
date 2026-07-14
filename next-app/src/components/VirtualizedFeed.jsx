'use client';

import React from 'react';
import VideoPreviewCard from './VideoPreviewCard';

const VirtualizedFeed = ({ videos, onVideoClick }) => {
    return (
        <div className="video-grid">
            {videos.map(video => (
                <VideoPreviewCard
                    key={video.id}
                    video={video}
                    variant="grid"
                    onClick={() => onVideoClick(video.id)}
                />
            ))}
        </div>
    );
};

export default React.memo(VirtualizedFeed);
