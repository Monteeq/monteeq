'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Share2,
  Send,
  Download,
  X,
  Crown,
  Lightbulb,
  LightbulbOff,
  UserPlus,
  UserCheck,
  Users,
  Bookmark,
  Flag,
} from 'lucide-react';
import VideoPlayerV2 from '@/components/player/VideoPlayerV2';
import CommentItem from '@/components/comments/CommentItem';
import AdSenseAd from '@/components/ads/AdSenseAd';
import VideoPreviewCard from '@/components/VideoPreviewCard';
import { useAuth } from '@/context/AuthContext';
import { useReport } from '@/context/ReportContext';
import { useWatchLaterToggle } from '@/hooks/useWatchLaterToggle';
import {
  likeVideo,
  shareVideo,
  postComment,
  updateComment,
  deleteComment,
  toggleFollow,
} from '@/lib/clientApi';

function DownloadModal({ video, onClose, user }) {
  const resolutions = [
    { label: '4K', value: '4k', src: video.url_4k, premium: true },
    { label: '2K', value: '2k', src: video.url_2k, premium: true },
    { label: '1080p', value: '1080p', src: video.url_1080p, premium: true },
    { label: '720p', value: '720p', src: video.url_720p, premium: false },
    { label: '480p', value: '480p', src: video.url_480p, premium: false },
  ].filter((r) => r.src);

  if (resolutions.length === 0 && video.video_url) {
    resolutions.push({ label: 'Original', value: 'original', src: video.video_url, premium: false });
  }

  const handleDownload = (res) => {
    if (res.premium && !user?.is_premium) {
      alert(`Downloading ${res.label} requires a Premium subscription.`);
      return;
    }
    const link = document.createElement('a');
    link.href = res.src;
    link.download = `${video.title}_${res.label}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="modal-content glass"
        style={{
          background: '#111',
          padding: '2rem',
          borderRadius: '2rem',
          width: '90%',
          maxWidth: '400px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Download Quality</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {resolutions.map((res) => (
            <button
              key={res.value}
              type="button"
              onClick={() => handleDownload(res)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.2rem',
                borderRadius: '1.2rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 700 }}>{res.label}</span>
              {res.premium && !user?.is_premium ? <Crown size={18} color="#ffd700" /> : <Download size={18} color="#ff3b30" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareModal({ video, onClose }) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = `Watch ${video.title} on Monteeq!`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  const socialPlatforms = [
    {
      name: 'WhatsApp',
      color: '#25D366',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`,
    },
    {
      name: 'X (Twitter)',
      color: '#fff',
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
    },
    {
      name: 'Facebook',
      color: '#1877F2',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Telegram',
      color: '#0088cc',
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
    },
    {
      name: 'Reddit',
      color: '#FF4500',
      url: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
    },
  ];

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="modal-content glass"
        style={{
          background: '#111',
          padding: '2.5rem 2rem 2rem',
          borderRadius: '2rem',
          width: '90%',
          maxWidth: '460px',
          border: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
          }}
        >
          <X size={24} />
        </button>
        <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.5rem', fontWeight: 900 }}>Share this video</h2>
        <p style={{ margin: '0 0 2rem', fontSize: '0.9rem', color: '#666' }}>Choose a platform to share this content</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.8rem', marginBottom: '2rem' }}>
          {socialPlatforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                color: platform.color,
                textDecoration: 'none',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {platform.name.charAt(0)}
              </span>
              {platform.name}
            </a>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '1.2rem',
            padding: '0.4rem 0.4rem 0.4rem 1.2rem',
            gap: '0.5rem',
          }}
        >
          <input
            type="text"
            readOnly
            value={shareUrl}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: '#ccc',
              fontSize: '0.85rem',
              outline: 'none',
            }}
            onClick={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: '#ff3b30',
              border: 'none',
              color: '#fff',
              borderRadius: '0.9rem',
              padding: '0.6rem 1.4rem',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive Watch shell — receives server-fetched video/comments/related as props.
 * No initial useEffect fetch for video data.
 */
export default function WatchView({
  video: initialVideo,
  comments: initialComments,
  relatedVideos = [],
  initialFollowersCount = 0,
  initialIsFollowing = false,
}) {
  const { token, user } = useAuth();
  const { openReportModal } = useReport();
  const router = useRouter();
  const [video, setVideo] = useState(initialVideo);
  const [comments, setComments] = useState(initialComments || []);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyComment, setReplyComment] = useState('');
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followLoading, setFollowLoading] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [navQueue, setNavQueue] = useState(() => relatedVideos || []);

  const {
    isSaved: isSavedToWatchLater,
    isPending: watchLaterPending,
    toggle: handleWatchLaterToggle,
  } = useWatchLaterToggle(video?.id);

  useEffect(() => {
    if (video?.title) {
      window.dispatchEvent(new CustomEvent('monteeq:update-title', { detail: video.title }));
    }
  }, [video?.title]);

  // Watch Later "Play all" (and similar) — Next has no location.state, so queue is handed off via sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('monteeq_watch_queue');
      if (!raw) return;
      sessionStorage.removeItem('monteeq_watch_queue');
      const parsed = JSON.parse(raw);
      const incoming = Array.isArray(parsed?.queue) ? parsed.queue : [];
      if (incoming.length === 0) return;

      setNavQueue((prev) => {
        const currentEntry = video
          ? {
              id: video.id,
              title: video.title,
              thumbnail_url: video.thumbnail_url,
              duration: video.duration,
              creator_name: video.owner?.username || video.creator_name,
            }
          : null;
        const incomingIds = new Set(incoming.map((v) => String(v.id)));
        const head =
          currentEntry && !incomingIds.has(String(currentEntry.id)) ? [currentEntry] : [];
        const merged = [...head, ...incoming];
        const extras = (prev || []).filter(
          (v) => !merged.some((m) => String(m.id) === String(v.id))
        );
        return [...merged, ...extras];
      });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read queue once on mount
  }, []);

  const related = (navQueue.length ? navQueue : relatedVideos).filter(
    (v) => String(v.id) !== String(video.id)
  );
  const navList = navQueue.length ? navQueue : relatedVideos;
  const currentIndex = navList.findIndex((v) => String(v.id) === String(video.id));
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < navList.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) router.push(`/watch/${navList[currentIndex - 1].id}`);
  };
  const goToNext = () => {
    if (hasNext) router.push(`/watch/${navList[currentIndex + 1].id}`);
  };

  const handleLike = async () => {
    if (!token) return;
    try {
      await likeVideo(video.id, token);
      setVideo((prev) => ({
        ...prev,
        liked_by_user: !prev.liked_by_user,
        likes_count: prev.liked_by_user ? prev.likes_count - 1 : prev.likes_count + 1,
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
    try {
      await shareVideo(video.id);
    } catch {
      /* non-critical */
    }
  };

  const handleFollow = async () => {
    if (!token || followLoading || !video.owner?.id) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount((c) => (wasFollowing ? Math.max(0, c - 1) : c + 1));
    try {
      const res = await toggleFollow(video.owner.id, token);
      setIsFollowing(res.is_following);
    } catch {
      setIsFollowing(wasFollowing);
      setFollowersCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !token) return;
    try {
      const added = await postComment({ videoId: video.id, content: newComment }, token);
      setComments([added, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditComment = async (commentId, content) => {
    try {
      const updated = await updateComment({ videoId: video.id, commentId, content }, token);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: updated.content } : c)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment({ videoId: video.id, commentId }, token);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReply = async (parentId) => {
    if (!replyComment.trim() || !token) return;
    try {
      const added = await postComment(
        { videoId: video.id, content: replyComment, parent_id: parentId },
        token
      );
      setComments((prev) =>
        prev.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies || []), added] } : c))
      );
      setReplyComment('');
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
    }
  };

  const isSelf = user?.id === video.owner?.id;

  const renderCreatorCard = (isMobileLayout) => (
    <div className={`creatorCard ${isMobileLayout ? 'mobileCreatorCard' : 'desktopCreatorCard'}`}>
      <Link href={`/profile/${video.owner?.username || ''}`} className="creatorHeader" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
        <div className="avatar">
          {video.owner?.profile_pic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.owner.profile_pic} alt="" loading="lazy" />
          ) : (
            <div className="avatarPlaceholder">{video.owner?.username?.charAt(0).toUpperCase()}</div>
          )}
        </div>
        <div className="creatorMeta">
          <h3>@{video.owner?.username}</h3>
          <p className="followersDisplay">
            <Users size={12} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />
            <span>{followersCount.toLocaleString()} followers</span>
          </p>
        </div>
      </Link>
      {!isSelf && (
        <button
          type="button"
          className={`followBtn ${isFollowing ? 'following' : ''}`}
          onClick={handleFollow}
          disabled={followLoading}
        >
          {isFollowing ? (
            <>
              <UserCheck size={15} />
              <span>Following</span>
            </>
          ) : (
            <>
              <UserPlus size={15} />
              <span>Follow</span>
            </>
          )}
        </button>
      )}
    </div>
  );

  return (
    <div className={`watchContainer ${isCinematic ? 'cinematic' : ''} ${isTheaterMode ? 'theaterMode' : ''}`}>
      <div className="dimOverlay" onClick={() => setIsCinematic(false)} />

      <div className="videoSection">
        <VideoPlayerV2
          src={video.video_url}
          videoId={video.id}
          title={video.title}
          creator={video.owner?.username}
          poster={video.thumbnail_url}
          autoPlay={true}
          isTheaterMode={isTheaterMode}
          isCinematic={isCinematic}
          toggleTheaterMode={() => setIsTheaterMode(!isTheaterMode)}
          toggleCinematic={() => setIsCinematic(!isCinematic)}
          onPrevious={goToPrevious}
          onNext={goToNext}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          url_480p={video.url_480p}
          url_720p={video.url_720p}
          url_1080p={video.url_1080p}
          url_2k={video.url_2k}
          url_4k={video.url_4k}
        />
      </div>

      <div className="mainColumn">
        <div className="titleRow">
          <h1 className="vTitle">{video.title}</h1>
          <button
            type="button"
            className="actionBtn"
            onClick={() => setIsCinematic(!isCinematic)}
            style={{ border: isCinematic ? '1px solid #ff3b30' : '' }}
          >
            {isCinematic ? <Lightbulb color="#ff3b30" size={20} /> : <LightbulbOff size={20} />}
            {isCinematic ? 'Lights On' : 'Cinematic Mode'}
          </button>
        </div>

        <div className="actionRow">
          <button type="button" className={`actionBtn ${video.liked_by_user ? 'active' : ''}`} onClick={handleLike}>
            <Heart size={20} fill={video.liked_by_user ? 'white' : 'none'} /> {video.likes_count}
          </button>
          <button
            type="button"
            className={`actionBtn ${isSavedToWatchLater ? 'active' : ''}`}
            onClick={handleWatchLaterToggle}
            disabled={watchLaterPending}
          >
            <Bookmark size={20} fill={isSavedToWatchLater ? 'white' : 'none'} />{' '}
            {isSavedToWatchLater ? 'Saved' : 'Watch Later'}
          </button>
          <button type="button" className="actionBtn" onClick={handleShare}>
            <Share2 size={20} /> Share
          </button>
          <button type="button" className="actionBtn" onClick={() => setShowDownloadModal(true)}>
            <Download size={20} /> Download
          </button>
          <button type="button" className="actionBtn" onClick={() => openReportModal('video', video.id)}>
            <Flag size={20} /> Report
          </button>
        </div>

        {renderCreatorCard(true)}

        <div style={{ marginTop: '3rem' }}>
          <div className="descriptionBox">
            <div className="videoMeta" style={{ marginBottom: '0.5rem', color: '#fff' }}>
              {video.views?.toLocaleString()} Views • {new Date(video.created_at).toLocaleDateString()}
            </div>
            <p>{video.description || 'No description provided.'}</p>
            {video.tags &&
              video.tags.split(',').map((tag, i) => (
                <span key={i} className="tagline">
                  #{tag.trim()}
                </span>
              ))}
          </div>

          {!user?.is_premium && (
            <div style={{ marginTop: '2rem' }}>
              <AdSenseAd
                client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
                slot={process.env.NEXT_PUBLIC_ADSENSE_MULTIPLEX_SLOT_ID}
                format="autorelaxed"
              />
            </div>
          )}

          <div style={{ marginTop: '4rem' }}>
            <h3 className="commentsHeading" style={{ marginBottom: '2rem' }}>
              Comments ({comments.length})
            </h3>
            <form onSubmit={handleCommentSubmit} className="commentForm">
              <div
                className="avatar"
                style={{
                  background: user?.profile_pic || user?.profile_picture ? 'transparent' : 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  color: '#fff',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {user?.profile_pic || user?.profile_picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profile_pic || user.profile_picture}
                    alt={user.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  user?.username?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div className="inputRow">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={token ? 'Add a comment...' : 'Sign in to comment'}
                  disabled={!token}
                />
                <button type="submit" disabled={!newComment.trim() || !token}>
                  <Send size={20} color="white" />
                </button>
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onReply={(commentId) => setReplyingTo(commentId)}
                  replyingTo={replyingTo}
                  replyComment={replyComment}
                  setReplyComment={setReplyComment}
                  onSubmitReply={handleSubmitReply}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sideColumn">
        {renderCreatorCard(false)}

        {related.length > 0 && (
          <div className="suggestedSection">
            <h4 className="suggestedTitle">Up Next</h4>
            <div className="suggestedList">
              {related.map((v) => (
                <VideoPreviewCard
                  key={v.id}
                  video={v}
                  variant="list"
                  onClick={() => router.push(`/watch/${v.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {showDownloadModal && <DownloadModal video={video} onClose={() => setShowDownloadModal(false)} user={user} />}
      {showShareModal && <ShareModal video={video} onClose={() => setShowShareModal(false)} />}
    </div>
  );
}
