import React, { useState } from 'react';
import { Send, Edit2, Trash2, X, Flag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';

const CommentItem = ({
    comment,
    onReply,
    replyingTo,
    replyComment,
    setReplyComment,
    onSubmitReply,
    onEdit,
    onDelete,
    isApproved = true,
    level = 0
}) => {
    const { user } = useAuth();
    const { openReportModal } = useReport();
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [showAllReplies, setShowAllReplies] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const isReplying = replyingTo === comment.id;

    // Smart visibility logic:
    // "High interaction" = has its own replies.
    // Display high interaction ones always, others only if showAllReplies is true.
    const allReplies = comment.replies || [];
    const highInteractionReplies = allReplies.filter(r => r.replies && r.replies.length > 0);
    const lowInteractionReplies = allReplies.filter(r => !r.replies || r.replies.length === 0);

    const displayedReplies = showAllReplies ? allReplies : highInteractionReplies;
    const hiddenCount = lowInteractionReplies.length;

    return (
        <div className="comment-thread" style={{ marginLeft: level > 0 ? '1.5rem' : '0', marginTop: '1rem' }}>
            <div className="comment-item" style={{ display: 'flex', gap: '1rem' }}>
                <div className="avatar-placeholder" style={{
                    width: level === 0 ? '36px' : '28px',
                    height: level === 0 ? '36px' : '28px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    overflow: 'hidden'
                }}>
                    {comment.owner?.profile_pic ? (
                        <img src={comment.owner.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: level === 0 ? '0.9rem' : '0.7rem' }}>
                            {comment.owner?.username?.[0].toUpperCase() || '?'}
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
                                className="glass"
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
                                    resize: 'none'
                                }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                                <button
                                    title="Save Edit"
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
                                        opacity: (!editContent.trim() || editContent === comment.content) ? 0.5 : 1
                                    }}
                                >
                                    Save
                                </button>
                                <button
                                    title="Cancel Edit"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditContent(comment.content);
                                    }}
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: '4px',
                                        background: 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.4', marginBottom: '0.5rem' }}>
                            {comment.content}
                        </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            title={isReplying ? "Cancel Reply" : "Reply to Comment"}
                            onClick={() => {
                                if (isApproved) onReply(isReplying ? null : comment.id);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: isApproved ? 'pointer' : 'not-allowed',
                                padding: '4px 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                opacity: isApproved ? 1 : 0.5
                            }}
                        >
                            {isReplying ? 'Cancel' : 'Reply'}
                        </button>

                        {user && user.id !== comment.owner_id && (
                            <button
                                title="Report Comment"
                                onClick={() => openReportModal('comment', comment.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    padding: '4px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Flag size={14} /> Report
                            </button>
                        )}

                        {!isEditing && user && user.id === comment.owner_id && !showDeleteConfirm && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <button
                                    title="Edit Comment"
                                    onClick={() => setIsEditing(true)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        padding: '4px 0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Edit2 size={16} /> Edit
                                </button>
                                <button
                                    title="Delete Comment"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#ff4d4d',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        padding: '4px 0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        )}

                        {showDeleteConfirm && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.2)', animation: 'fadeIn 0.2s ease-out' }}>
                                <span style={{ fontSize: '0.75rem', color: '#ff4d4d', fontWeight: 700 }}>Confirm delete?</span>
                                <button 
                                    onClick={() => onDelete(comment.id)} 
                                    style={{ background: '#ff4d4d', border: 'none', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s' }}
                                    className="hover-scale"
                                >
                                    Yes
                                </button>
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)} 
                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s' }}
                                    className="hover-scale"
                                >
                                    No
                                </button>
                            </div>
                        )}
                    </div>

                    {isReplying && (
                        <form onSubmit={(e) => { e.preventDefault(); onSubmitReply(comment.id); }} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', marginBottom: '1rem' }}>
                            <input
                                type="text"
                                value={replyComment}
                                onChange={(e) => setReplyComment(e.target.value)}
                                placeholder={`Reply to @${comment.owner?.username}...`}
                                className="glass"
                                autoFocus
                                style={{
                                    flex: 1,
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    border: '1px solid var(--border-glass)',
                                    outline: 'none',
                                    background: 'rgba(255,255,255,0.05)'
                                }}
                            />
                            <button
                                title="Send Reply"
                                type="submit"
                                disabled={!replyComment.trim()}
                                style={{
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    opacity: replyComment.trim() ? 1 : 0.5
                                }}
                            >
                                <Send size={20} color="white" />
                            </button>
                        </form>
                    )}

                    {/* Recursive Replies */}
                    {allReplies.length > 0 && (
                        <div className="replies-list" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '4px' }}>
                            {displayedReplies.map(reply => (
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
                                    isApproved={isApproved}
                                    level={level + 1}
                                />
                            ))}

                            {/* Toggles */}
                            {!showAllReplies && hiddenCount > 0 && (
                                <button
                                    title="Expand Replies"
                                    onClick={() => setShowAllReplies(true)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.4)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        padding: '8px 0',
                                        marginLeft: '1.5rem',
                                        display: 'block'
                                    }}
                                >
                                    Show {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}...
                                </button>
                            )}

                            {showAllReplies && lowInteractionReplies.length > 0 && (
                                <button
                                    title="Collapse Replies"
                                    onClick={() => setShowAllReplies(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.4)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        padding: '8px 0',
                                        marginLeft: '1.5rem',
                                        display: 'block'
                                    }}
                                >
                                    Hide replies
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommentItem;
