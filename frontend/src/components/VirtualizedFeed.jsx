import React from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import VideoPreviewCard from './VideoPreviewCard';

const VirtualizedFeed = ({ videos, onVideoClick }) => {
    // We assume a grid layout. For a list layout, we'd need a different approach or multiple items per row.
    // In Monteeq, feeds are typically grids. react-window's FixedSizeGrid is better for grids.
    
    const columnCount = window.innerWidth > 1200 ? 4 : window.innerWidth > 768 ? 3 : window.innerWidth > 480 ? 2 : 1;
    const rowCount = Math.ceil(videos.length / columnCount);
    const itemHeight = 320; // Estimated height of a video card

    const Row = ({ index, style }) => {
        const items = [];
        const from = index * columnCount;
        const to = Math.min(from + columnCount, videos.length);

        for (let i = from; i < to; i++) {
            items.push(
                <div key={videos[i].id} style={{ flex: 1, padding: '0 10px' }}>
                    <VideoPreviewCard
                        video={videos[i]}
                        variant="grid"
                        onClick={() => onVideoClick(videos[i].id)}
                    />
                </div>
            );
        }

        return (
            <div style={{ ...style, display: 'flex', padding: '0 10px' }}>
                {items}
            </div>
        );
    };

    return (
        <div style={{ height: '80vh', width: '100%' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        height={height}
                        itemCount={rowCount}
                        itemSize={itemHeight}
                        width={width}
                    >
                        {Row}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
};

export default React.memo(VirtualizedFeed);
