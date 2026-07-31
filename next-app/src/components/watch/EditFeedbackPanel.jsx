'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { requestEditFeedback } from '@/lib/browserApi';
import { Sparkles, RefreshCw } from 'lucide-react';

function parseFeedback(text) {
  const lines = text.split('\n').filter(Boolean);
  let summary = '';
  const bullets = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      bullets.push(trimmed.replace(/^[-*]\s+/, ''));
    } else if (!summary) {
      summary = trimmed;
    }
  }

  return { summary, bullets };
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function EditFeedbackPanel({ video }) {
  const { user, token } = useAuth();
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isOwner = user?.id === video.owner?.id;
  if (!isOwner) return null;

  const handleGetFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestEditFeedback(video.id, token);
      setFeedback(result);
    } catch (err) {
      const status = err?.status || err?.statusCode;
      if (status === 409) {
        setError("Feedback isn't ready yet — analysis is still processing.");
      } else if (status === 429) {
        setError("You've hit your feedback request limit for this hour, try again later.");
      } else {
        console.error('Edit feedback error:', err);
        setError('Something went wrong, try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setFeedback(null);
    handleGetFeedback();
  };

  return (
    <div>
      {!feedback && !loading && !error && (
        <button
          onClick={handleGetFeedback}
          style={{
            background: 'rgba(147, 51, 234, 0.1)',
            color: '#a78bfa',
            border: '1px solid rgba(147, 51, 234, 0.2)',
            padding: '0.5rem',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: 700,
            fontSize: '0.75rem',
            width: '100%',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(147, 51, 234, 0.2)';
            e.currentTarget.style.color = '#c4b5fd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(147, 51, 234, 0.1)';
            e.currentTarget.style.color = '#a78bfa';
          }}
        >
          <Sparkles size={14} />
          Get Feedback
        </button>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            disabled
            style={{
              background: 'rgba(147, 51, 234, 0.1)',
              color: '#a78bfa',
              border: '1px solid rgba(147, 51, 234, 0.2)',
              padding: '0.5rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '0.75rem',
              width: '100%',
              opacity: 0.6,
              cursor: 'not-allowed',
            }}
          >
            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Analyzing your edit...
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '0.5rem' }}>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            margin: 0,
            lineHeight: '1.4',
            padding: '0.5rem',
            background: 'rgba(255, 59, 48, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 59, 48, 0.1)',
          }}>
            {error}
          </p>
        </div>
      )}

      {feedback && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)' }}>
          {/* Metrics row */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
          }}>
            {[
              { label: 'Avg Cut', value: feedback.metrics?.avg_cut_duration != null ? `${feedback.metrics.avg_cut_duration.toFixed(1)}s` : '—' },
              { label: 'Beat Sync', value: feedback.metrics?.beat_sync_score != null ? `${Math.round(feedback.metrics.beat_sync_score)}%` : '—' },
              { label: 'Total Cuts', value: feedback.metrics?.cut_count ?? '—' },
              { label: 'Duration', value: feedback.metrics?.total_duration_seconds != null ? formatDuration(feedback.metrics.total_duration_seconds) : '—' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '8px',
                padding: '0.4rem 0.6rem',
                textAlign: 'center',
                flex: '1 0 auto',
                minWidth: '60px',
                border: '1px solid var(--border-glass)',
              }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Parsed feedback text */}
          {(() => {
            const { summary, bullets } = parseFeedback(feedback.feedback_text || '');
            return (
              <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                {summary && <p style={{ margin: '0 0 0.5rem 0' }}>{summary}</p>}
                {bullets.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {bullets.map((b, i) => (
                      <li key={i} style={{ margin: 0 }}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            style={{
              background: 'transparent',
              color: '#a78bfa',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 600,
              marginTop: '0.5rem',
              padding: '0.25rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#c4b5fd'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a78bfa'; }}
          >
            <RefreshCw size={12} />
            Request new feedback
          </button>
        </div>
      )}
    </div>
  );
}
