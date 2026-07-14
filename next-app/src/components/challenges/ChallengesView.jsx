'use client';

import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Users,
  Award,
  Calendar,
  ChevronRight,
  Play,
  CheckCircle,
  Crown,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
  enterChallenge,
  checkChallengeEntry,
  getChallengeLeaderboard,
} from '@/lib/clientApi';

/** Local icon alias — same as Vite Challenges.jsx */
const TrendingUp = ({ size }) => <Trophy size={size} />;

/**
 * Interactive Challenges UI — list/leaderboards come from SSR props.
 * Entry status (auth), filter, entry modal, and leaderboard refresh are client-side.
 */
export default function ChallengesView({
  initialChallenges = [],
  initialLeaderboard = {},
}) {
  const { token, user } = useAuth();
  const [challenges, setChallenges] = useState(initialChallenges);
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [filter, setFilter] = useState('all');
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entering, setEntering] = useState(false);
  const [message, setMessage] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');

  // Enrich with hasEntered when logged in; refresh leaderboards periodically
  useEffect(() => {
    let cancelled = false;

    const enrich = async () => {
      if (!token || challenges.length === 0) return;
      try {
        const statuses = await Promise.all(
          challenges.map((c) => checkChallengeEntry(c.id, token).catch(() => null))
        );
        if (cancelled) return;
        setChallenges((prev) =>
          prev.map((c, idx) => ({
            ...c,
            hasEntered: !!statuses[idx],
          }))
        );
      } catch (err) {
        console.error(err);
      }
    };

    enrich();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!challenges.length) return;
    let cancelled = false;

    const refreshLb = async () => {
      const entries = await Promise.all(
        challenges.map(async (c) => {
          try {
            const lb = await getChallengeLeaderboard(c.id);
            return [c.id, lb];
          } catch {
            return [c.id, leaderboard[c.id] || []];
          }
        })
      );
      if (cancelled) return;
      setLeaderboard((prev) => {
        const next = { ...prev };
        entries.forEach(([id, lb]) => {
          next[id] = lb;
        });
        return next;
      });
    };

    const id = setInterval(refreshLb, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges.map((c) => c.id).join(',')]);

  const handleEnterPress = (challenge) => {
    if (!token) {
      setMessage({ type: 'error', text: 'You must be logged in to enter challenges.' });
      return;
    }
    setSelectedChallenge(challenge);
    setUploadTitle(`${challenge.title} Entry`);
    setUploadFile(null);
    setUploadDescription('');
    setShowEntryModal(true);
  };

  const submitEntry = async (e) => {
    if (e) e.preventDefault();
    if (!uploadFile) {
      setMessage({ type: 'error', text: 'Please select a video file.' });
      return;
    }
    setEntering(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle);
      formData.append('description', uploadDescription);

      const result = await enterChallenge(selectedChallenge.id, formData, token);

      if (result.id) {
        setMessage({ type: 'success', text: 'Successfully uploaded your entry! Processing started.' });
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === selectedChallenge.id
              ? { ...c, hasEntered: true, entry_count: (c.entry_count || 0) + 1 }
              : c
          )
        );
        setShowEntryModal(false);
      } else {
        setMessage({ type: 'error', text: result.detail || 'Failed to enter challenge.' });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err?.message || 'An unexpected error occurred during upload.',
      });
    } finally {
      setEntering(false);
    }
  };

  const filteredChallenges = challenges.filter((c) => {
    if (filter === 'open') return c.is_open;
    if (filter === 'closed') return !c.is_open;
    return true;
  });

  return (
    <div className="page-container" style={{ paddingBottom: '5rem' }}>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'fixed',
            top: '90px',
            right: '2rem',
            zIndex: 1000,
            padding: '1rem 2rem',
            borderRadius: '12px',
            background: message.type === 'success' ? '#22c55e' : '#ff3e3e',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          {message.text}
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{
              marginLeft: '1rem',
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </motion.div>
      )}

      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <div className="hero-badge" style={{ margin: 0 }}>
            <Trophy size={14} /> Weekly Competitions
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            • Win elite recognition and spotlights
          </span>
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem' }}>Challenges</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: '1.6' }}>
          Showcase your talent by participating in our themed video challenges. Compete for elite
          prizes, massive exposure, and recognition from industry leaders.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}
      >
        {[
          { id: 'all', label: 'All Challenges' },
          { id: 'open', label: 'Open' },
          { id: 'closed', label: 'Ended' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`glass ${filter === f.id ? 'active' : ''}`}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: '50px',
              border:
                filter === f.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
              background: filter === f.id ? 'rgba(255, 62, 62, 0.1)' : '',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              color: '#ff3e3e',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="challenges-grid">
        {filteredChallenges.length > 0 ? (
          filteredChallenges.map((challenge) => (
            <motion.div
              key={challenge.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="challenge-card glass"
            >
              <div className={`challenge-badge ${challenge.is_open ? 'badge-open' : 'badge-closed'}`}>
                {challenge.is_open ? 'Open' : 'Closed'}
              </div>

              <div className="challenge-content">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <div className="challenge-prize">
                    <Award size={18} /> {challenge.prize || 'Elite Prize'}
                  </div>
                  {challenge.is_gold && (
                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: 'linear-gradient(90deg, #ffd700, #b8860b)',
                        color: 'black',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Crown size={12} /> GOLD
                    </div>
                  )}
                </div>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>
                  {challenge.title}
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    marginBottom: '2rem',
                    fontSize: '0.95rem',
                    lineHeight: '1.6',
                  }}
                >
                  {challenge.description}
                </p>

                <div className="challenge-stats">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={16} /> {challenge.entry_count} Entries
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} /> Ends{' '}
                    {challenge.end_date
                      ? new Date(challenge.end_date).toLocaleDateString()
                      : 'TBA'}
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem' }}>
                {challenge.is_open ? (
                  <button
                    type="button"
                    className="btn-active"
                    onClick={() => handleEnterPress(challenge)}
                    disabled={
                      challenge.hasEntered || (challenge.is_gold && !user?.is_premium)
                    }
                    style={{
                      flex: 1,
                      padding: '1rem',
                      borderRadius: '12px',
                      background: challenge.hasEntered
                        ? 'rgba(34, 197, 94, 0.1)'
                        : challenge.is_gold && !user?.is_premium
                          ? 'rgba(255,255,255,0.05)'
                          : 'var(--accent-primary)',
                      color: challenge.hasEntered
                        ? '#22c55e'
                        : challenge.is_gold && !user?.is_premium
                          ? 'var(--text-muted)'
                          : 'white',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor:
                        challenge.hasEntered || (challenge.is_gold && !user?.is_premium)
                          ? 'default'
                          : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {challenge.hasEntered ? (
                      <>
                        <CheckCircle size={20} /> Entered
                      </>
                    ) : challenge.is_gold && !user?.is_premium ? (
                      <>
                        <Lock size={18} /> Pro Only
                      </>
                    ) : (
                      <>
                        Enter Challenge <ChevronRight size={20} />
                      </>
                    )}
                  </button>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    Challenge Ended
                  </div>
                )}
              </div>

              {leaderboard[challenge.id]?.length > 0 && (
                <div style={{ padding: '0 1.5rem 2rem 1.5rem' }}>
                  <div
                    style={{
                      height: '1px',
                      background: 'var(--border-glass)',
                      marginBottom: '1.5rem',
                    }}
                  />
                  <h4
                    style={{
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--text-muted)',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <TrendingUp size={14} /> Current Leaderboard
                  </h4>
                  <div className="leaderboard-container">
                    {leaderboard[challenge.id].slice(0, 3).map((entry, idx) => (
                      <div key={idx} className="leaderboard-item">
                        <span className="leaderboard-rank">{idx + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,0.1)',
                              overflow: 'hidden',
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                entry.profile_pic ||
                                `https://ui-avatars.com/api/?name=${entry.username}&background=random`
                              }
                              alt={entry.username}
                              style={{ width: '100%', height: '100%' }}
                            />
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            {entry.username}
                          </span>
                        </div>
                        <span className="leaderboard-score">{entry.score} Views</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '5rem 2rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '32px',
              border: '1px dashed var(--border-glass)',
            }}
          >
            <Trophy size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              No Challenges Found
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              There are no challenges matching your current filter. Check back soon!
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEntryModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(10px)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass"
              style={{
                maxWidth: '600px',
                width: '100%',
                borderRadius: '32px',
                overflow: 'hidden',
                border: '1px solid var(--border-glass)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  padding: '2rem',
                  borderBottom: '1px solid var(--border-glass)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Enter Challenge</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Upload your best work for: {selectedChallenge?.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={submitEntry} style={{ padding: '2rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Entry Title
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="glass"
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border-glass)',
                      background: 'rgba(255,255,255,0.02)',
                      color: 'white',
                    }}
                    placeholder="Give your entry a title"
                    required
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="glass"
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border-glass)',
                      background: 'rgba(255,255,255,0.02)',
                      color: 'white',
                      minHeight: '80px',
                      resize: 'vertical',
                    }}
                    placeholder="Tell us about your edit..."
                  />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Video File
                  </label>
                  <div
                    onClick={() => document.getElementById('entry-file')?.click()}
                    onKeyDown={() => {}}
                    role="button"
                    tabIndex={0}
                    style={{
                      border: '2px dashed var(--border-glass)',
                      borderRadius: '20px',
                      padding: '3rem 1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: uploadFile
                        ? 'rgba(34, 197, 94, 0.05)'
                        : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <input
                      id="entry-file"
                      type="file"
                      accept="video/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                    />
                    {uploadFile ? (
                      <div>
                        <CheckCircle size={40} color="#22c55e" style={{ marginBottom: '1rem' }} />
                        <p style={{ fontWeight: 'bold' }}>{uploadFile.name}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <Play size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p style={{ fontWeight: 'bold' }}>Click to select video</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          MP4, MOV or WEBM preferred
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={entering || !uploadFile}
                  className="auth-button"
                  style={{ width: '100%', padding: '1rem', opacity: entering || !uploadFile ? 0.5 : 1 }}
                >
                  {entering ? 'Uploading Entry...' : 'Submit Participation'}
                </button>

                {user && !user.is_premium && (
                  <p
                    style={{
                      marginTop: '1rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                    }}
                  >
                    Note: As a free user, this will be your only allowed challenge entry.
                  </p>
                )}
              </form>

              {entering && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                  }}
                >
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                      <Trophy size={32} color="var(--accent-primary)" />
                    </motion.div>
                    <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>Submitting Entry...</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
