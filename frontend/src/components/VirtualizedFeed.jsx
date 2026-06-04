import React, { useRef } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import VideoPreviewCard from './VideoPreviewCard';
import useWindowWidth from '../hooks/useWindowWidth';

const Row = React.memo(({ index, style, videos, columnCount, columnWidth, onVideoClick }) => {
    const from = index * columnCount;
    const to = Math.min(from + columnCount, videos.length);
    const rowItems = videos.slice(from, to);

    return (
        <div style={{ ...style, display: 'flex' }}>
            {rowItems.map(video => (
                <div key={video.id} style={{ width: columnWidth, padding: '0 12px 12px' }}>
                    <VideoPreviewCard
                        video={video}
                        variant="grid"
                        onClick={() => onVideoClick(video.id)}
                    />
                </div>
            ))}
        </div>
    );
});

Row.displayName = 'Row';

const VirtualizedFeed = ({ videos, onVideoClick }) => {
    const listRef = useRef(null);
    const windowWidth = useWindowWidth();

    return (
        <div style={{ height: '80vh', width: '100%' }}>
            <AutoSizer renderProp={({ height, width }) => {
                if (height <= 0 || width <= 0) {
                    return null;
                }

                const columnCount = windowWidth >= 1200 ? 3 : windowWidth >= 768 ? 2 : 1;
                const rowCount = Math.ceil(videos.length / columnCount);
                const columnWidth = width / columnCount;
                const thumbnailHeight = columnWidth * (9 / 16);
                const rowHeight = thumbnailHeight + 120;

                return (
                    <List
                        key={`${width}_${rowHeight}`}
                        listRef={listRef}
                        height={height}
                        width={width}
                        style={{ height, width }}
                        rowCount={rowCount}
                        rowHeight={rowHeight}
                        rowComponent={Row}
                        rowProps={{
                            videos,
                            columnCount,
                            columnWidth,
                            onVideoClick
                        }}
                        overscanCount={2}
                    />
                );
            }} />
        </div>
    );
};

export default React.memo(VirtualizedFeed);
