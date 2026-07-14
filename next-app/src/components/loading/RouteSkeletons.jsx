/**
 * Server-safe route skeletons for App Router `loading.js`.
 * Uses global `.skeleton` styles from globals.css — no client JS required.
 */

export function WatchRouteSkeleton() {
  return (
    <div className="watchContainer" aria-busy="true" aria-label="Loading video">
      <div className="videoSection" style={{ aspectRatio: '16 / 9', width: '100%', height: 'auto' }}>
        <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
      </div>
      <div className="mainColumn">
        <div className="titleRow">
          <div className="skeleton skeleton-text" style={{ width: '70%', height: '2rem', borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 50 }} />
        </div>
        <div className="actionRow" style={{ marginBottom: '2rem', display: 'flex', gap: '0.75rem' }}>
          <div className="skeleton" style={{ width: 90, height: 40, borderRadius: 50 }} />
          <div className="skeleton" style={{ width: 90, height: 40, borderRadius: 50 }} />
          <div className="skeleton" style={{ width: 120, height: 40, borderRadius: 50 }} />
        </div>
        <div className="descriptionBox" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div className="skeleton skeleton-text" style={{ width: '30%', height: '1rem' }} />
          <div className="skeleton skeleton-text" style={{ width: '100%', height: '1.2rem' }} />
          <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.2rem' }} />
        </div>
      </div>
      <div className="sideColumn">
        <div className="skeleton" style={{ height: 80, borderRadius: '1.25rem', marginBottom: '1.5rem' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="skeleton" style={{ width: 180, height: 101, borderRadius: 12, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div className="skeleton skeleton-text" style={{ width: '90%', height: '1.1rem' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%', height: '0.8rem' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeRouteSkeleton() {
  return (
    <div className="page-container" aria-busy="true" aria-label="Loading feed" style={{ paddingTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', overflow: 'hidden' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton" style={{ width: 88, height: 36, borderRadius: 50, flexShrink: 0 }} />
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i}>
            <div
              className="skeleton skeleton-thumbnail"
              style={{ marginBottom: '0.8rem', borderRadius: 12, aspectRatio: '16 / 9', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '90%', height: '1.1rem', marginBottom: 8, borderRadius: 4 }} />
                <div className="skeleton skeleton-text" style={{ width: '55%', height: '0.85rem', borderRadius: 4 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FlashRouteSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading flash"
      style={{
        height: '100dvh',
        width: '100%',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="skeleton"
        style={{
          width: 'min(420px, 92vw)',
          height: 'min(85dvh, 740px)',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.06)',
        }}
      />
    </div>
  );
}

export function ProfileRouteSkeleton() {
  return (
    <div className="page-container" aria-busy="true" aria-label="Loading profile" style={{ paddingTop: '2rem' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div className="skeleton" style={{ width: 120, height: 120, borderRadius: '50%' }} />
        <div className="skeleton skeleton-text" style={{ width: 200, height: '1.8rem', borderRadius: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: 140, height: '1rem', borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="skeleton" style={{ width: 120, height: 44, borderRadius: 50 }} />
          <div className="skeleton" style={{ width: 120, height: 44, borderRadius: 50 }} />
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton skeleton-thumbnail" style={{ borderRadius: 12, aspectRatio: '16 / 9' }} />
        ))}
      </div>
    </div>
  );
}

export function PostsRouteSkeleton() {
  return (
    <div className="page-container" aria-busy="true" aria-label="Loading posts" style={{ maxWidth: 680, margin: '0 auto' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="glass"
          style={{ padding: '1.5rem', borderRadius: 24, marginBottom: '1.25rem' }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text" style={{ width: '40%', height: '1rem', marginBottom: 6 }} />
              <div className="skeleton skeleton-text" style={{ width: '25%', height: '0.8rem' }} />
            </div>
          </div>
          <div className="skeleton skeleton-text" style={{ width: '100%', height: '1rem', marginBottom: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: '85%', height: '1rem', marginBottom: 16 }} />
          <div className="skeleton" style={{ width: '100%', height: 220, borderRadius: 16 }} />
        </div>
      ))}
    </div>
  );
}

export function GenericRouteSkeleton() {
  return (
    <div
      className="page-container"
      aria-busy="true"
      aria-label="Loading"
      style={{ paddingTop: '2rem', maxWidth: 960, margin: '0 auto' }}
    >
      <div className="skeleton skeleton-text" style={{ width: '35%', height: '2rem', marginBottom: '1.5rem', borderRadius: 8 }} />
      <div className="skeleton" style={{ width: '100%', height: 180, borderRadius: 16, marginBottom: '1rem' }} />
      <div className="skeleton skeleton-text" style={{ width: '100%', height: '1rem', marginBottom: 10 }} />
      <div className="skeleton skeleton-text" style={{ width: '90%', height: '1rem', marginBottom: 10 }} />
      <div className="skeleton skeleton-text" style={{ width: '70%', height: '1rem' }} />
    </div>
  );
}

export function ChatRouteSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading chat"
      style={{ display: 'flex', height: 'calc(100dvh - 0px)', minHeight: 480 }}
    >
      <div style={{ width: 320, borderRight: '1px solid rgba(255,255,255,0.08)', padding: '1rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text" style={{ width: '70%', height: '1rem', marginBottom: 6 }} />
              <div className="skeleton skeleton-text" style={{ width: '50%', height: '0.8rem' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: '1.5rem' }}>
        <div className="skeleton" style={{ width: '40%', height: 48, borderRadius: 16, marginBottom: '1rem' }} />
        <div className="skeleton" style={{ width: '55%', height: 48, borderRadius: 16, marginLeft: 'auto' }} />
      </div>
    </div>
  );
}
