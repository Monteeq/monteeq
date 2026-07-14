"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { getComments, postComment, updateComment, deleteComment } from '@/lib/clientApi';
import { useAuth } from '@/context/AuthContext';
import CommentItem from '@/components/comments/CommentItem';

const countComments = (list) =>
    list.reduce((acc, c) => acc + 1 + (c.replies ? countComments(c.replies) : 0), 0);

const CommentsDrawer = ({ videoId = null, postId = null, onClose, initialComments = null }) => {
    const { user, token } = useAuth();
    const [comments, setComments] = useState(initialComments ?? []);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(initialComments === null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyComment, setReplyComment] = useState('');
    const [posting, setPosting] = useState(false);
    const commentsBottomRef = useRef(null);

    const totalCount = countComments(comments);

    useEffect(() => {
        if (!videoId && !postId) return;

        const fetchComments = async () => {
            if (initialComments === null) setLoading(true);
            try {
                const data = await getComments({ videoId, postId, token });
                setComments(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed comments', err);
            } finally {
                setLoading(false);
            }
        };

        fetchComments();
    }, [videoId, postId]);

    useEffect(() => {
        // Auto-scroll to bottom on load/new comment
        if (commentsBottomRef.current && !replyingTo) {
            commentsBottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [comments, replyingTo]);

    const handlePost = async (e, parentId = null) => {
        if (e) e.preventDefault();
        const content = parentId ? replyComment : newComment;
        if (!content.trim() || !user || posting) return;

        setPosting(true);
        try {
            const addedComment = await postComment({
                videoId,
                postId,
                content,
                parent_id: parentId
            }, token);

            if (parentId) {
                const updateReplies = (list) => list.map(c => {
                    if (c.id === parentId) {
                        return { ...c, replies: [...(c.replies || []), addedComment] };
                    }
                    if (c.replies) return { ...c, replies: updateReplies(c.replies) };
                    return c;
                });
                setComments(updateReplies(comments));
                setReplyingTo(null);
                setReplyComment('');
            } else {
                setComments(prev => [...prev, addedComment]);
                setNewComment('');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setPosting(false);
        }
    };

    const handleEdit = async (commentId, content) => {
        try {
            await updateComment({ videoId, postId, commentId, content }, token);

            // Recursive update to handle top-level and nested replies
            const updateList = (list) => list.map(c => {
                if (c.id === commentId) return { ...c, content };
                if (c.replies) return { ...c, replies: updateList(c.replies) };
                return c;
            });
            setComments(updateList(comments));
        } catch (err) {
            console.error("Failed to edit comment", err);
        }
    };

    const handleDelete = async (commentId) => {
        try {
            await deleteComment({ videoId, postId, commentId }, token);

            // Recursive delete to handle top-level and nested replies
            const filterList = (list) => list.filter(c => c.id !== commentId).map(c => {
                if (c.replies) return { ...c, replies: filterList(c.replies) };
                return c;
            });
            setComments(filterList(comments));
        } catch (err) {
            console.error("Failed to delete comment", err);
        }
    };

    return (
        <div className="comments-drawer-overlay" onClick={onClose}>
            <div className="comments-drawer" onClick={e => e.stopPropagation()}>
                <div className="comments-header">
                    <h3>{totalCount} Comments</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={22} />
                    </button>
                </div>

                <div className="comments-list">
                    {loading ? (
                        <div className="loader-spinner" />
                    ) : comments.length === 0 ? (
                        <div className="empty-state">
                            <p>No comments yet. Say something nice!</p>
                        </div>
                    ) : (
                        comments.map(c => (
                            <CommentItem
                                key={c.id}
                                comment={c}
                                onReply={(id) => setReplyingTo(id)}
                                replyingTo={replyingTo}
                                replyComment={replyComment}
                                setReplyComment={setReplyComment}
                                onSubmitReply={(pid) => handlePost(null, pid)}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))
                    )}
                    <div ref={commentsBottomRef} />
                </div>

                <div className="comment-input-area">
                    {user ? (
                        <form onSubmit={handlePost} className="input-wrapper">
                            <input
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim() || posting}
                                className="send-btn"
                                title="Post comment"
                            >
                                {posting
                                    ? <Loader2 size={24} className="comment-spinner" />
                                    : <Send size={24} />
                                }
                                <span>{posting ? 'Posting...' : 'Post'}</span>
                            </button>
                        </form>
                    ) : (
                        <p className="login-prompt">Log in to comment</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommentsDrawer;
