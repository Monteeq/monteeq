'use client';

import React, { useState } from 'react';
import { Send, Edit2, Trash2, X, Flag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useReport } from '@/context/ReportContext';
import { likeComment } from '@/lib/clientApi';

/**
 * Port of frontend CommentItem.
 */
export default function CommentItem({
  comment,
  onReply,
  replyingTo,
  replyComment,
  setReplyComment,
  onSubmitReply,
  onEdit,
  onDelete,
  level = 0,
}) {
  const { user, token } = useAuth();
  const { openReportModal } = useReport();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [liked, setLiked] = useState(comment.is_liked || false);
  const [likeCount, setLikeCount] = useState(comment.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  React.useEffect(() => {
    if (comment.is_liked !== undefined) setLiked(comment.is_liked);
    if (comment.likes_count !== undefined) setLikeCount(comment.likes_count);
  }, [comment.is_liked, comment.likes_count]);

  const isReplying = replyingTo === comment.id;
  const isOwner = user?.id === comment.owner?.id;

  const handleLike = async () => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!authToken || isLiking) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setIsLiking(true);
    try {
      const data = await likeComment(comment.id, authToken);
      if (data) {
        setLiked(data.liked);
        setLikeCount(data.likes_count);
      }
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  const allReplies = comment.replies || [];
  const highInteractionReplies = allReplies.filter((r) => r.replies && r.replies.length > 0);
  const lowInteractionReplies = allReplies.filter((r) => !r.replies || r.replies.length === 0);
  const displayedReplies = showAllReplies ? allReplies : highInteractionReplies;
  const hiddenCount = lowInteractionReplies.length;

  return (
    <div className="comment-thread" style={{ marginLeft: level > 0 ? '1.5rem' : '0', marginTop: '1rem' }}>
      <div className="comment-item" style={{ display: 'flex', gap: '1rem' }}>
        <div
          className="avatar-placeholder"
          style={{
            width: level === 0 ? '36px' : '28px',
            height: level === 0 ? '36px' : '28px',
            borderRadius: '50%',
            flexShrink: 0,
            overflow: 'hidden',
            background: 'var(--bg-raised)',
          }}
        >
          {comment.owner?.profile_pic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comment.owner.profile_pic}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: level === 0 ? '0.9rem' : '0.7rem',
              }}
            >
              {comment.owner?.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ fontWeight: 600, fontSize: level === 0 ? '0.9rem' : '0.85rem' }}>
              @{comment.owner?.username || 'User'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : 'Just now'}
            </span>
          </div>

          {isEditing ? (
            <div style={{ marginTop: '0.4rem', marginBottom: '0.5rem' }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border-glass)',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.05)',
                  minHeight: '60px',
                  resize: 'none',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    onEdit(comment.id, editContent);
                    setIsEditing(false);
                  }}
                  disabled={!editContent.trim() || editContent === comment.content}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    background: 'var(--accent-primary)',
                    border: 'none',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    background: 'transparent',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              {comment.content}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem' }}>
            <button
              type="button"
              onClick={handleLike}
              style={{
                background: 'none',
                border: 'none',
                color: liked ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {liked ? 'Liked' : 'Like'} {likeCount > 0 ? `(${likeCount})` : ''}
            </button>
            {level === 0 && (
              <button
                type="button"
                onClick={() => onReply(comment.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
              >
                Reply
              </button>
            )}
            {user && !isOwner && (
              <button
                type="button"
                title="Report Comment"
                onClick={() => openReportModal('comment', comment.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Flag size={14} /> Report
              </button>
            )}
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  aria-label="Edit"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>

          {showDeleteConfirm && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Delete this comment?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete(comment.id);
                  setShowDeleteConfirm(false);
                }}
                style={{
                  background: 'var(--accent-primary)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {isReplying && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={replyComment}
                onChange={(e) => setReplyComment(e.target.value)}
                placeholder={`Reply to @${comment.owner?.username || 'user'}...`}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  color: '#fff',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => onSubmitReply(comment.id)}
                disabled={!replyComment.trim()}
                style={{
                  background: 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                }}
              >
                <Send size={16} color="white" />
              </button>
            </div>
          )}

          {displayedReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              replyingTo={replyingTo}
              replyComment={replyComment}
              setReplyComment={setReplyComment}
              onSubmitReply={onSubmitReply}
              onEdit={onEdit}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}

          {!showAllReplies && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllReplies(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginTop: '0.5rem',
              }}
            >
              View {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
