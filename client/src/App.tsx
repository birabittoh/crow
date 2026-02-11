import React, { useState } from 'react';
import { useConfig } from './hooks';
import Calendar from './components/Calendar';
import PostForm from './components/PostForm';
import PostDetail from './components/PostDetail';
import MediaLibrary from './components/MediaLibrary';
import { api } from './api';
import type { Post } from './api';

type View = 'calendar' | 'create' | 'detail' | 'media';

export default function App() {
  const { data: config, isLoading, error } = useConfig();
  const [view, setView] = useState<View>('calendar');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  if (isLoading) {
    return <div className="loading">Loading configuration...</div>;
  }

  if (error) {
    return <div className="error">Failed to load configuration: {error.message}</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title" onClick={() => setView('calendar')}>
          Crow
        </h1>
        <div className="header-actions">
          <span className="platform-badges">
            {config?.platforms.map((p) => (
              <span key={p} className="badge">{p}</span>
            ))}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setView('media')}
          >
            Media
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedDate(null);
              setView('create');
            }}
          >
            + New Post
          </button>
        </div>
      </header>

      <main className="app-main">
        {view === 'calendar' && (
          <Calendar
            onSelectPost={(post) => {
              setSelectedPost(post);
              setView('detail');
            }}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setView('create');
            }}
            recurrentEventsUrl={config?.recurrentEventsUrl}
          />
        )}
        {view === 'create' && (
          <PostForm
            platforms={config?.platforms || []}
            platformOptions={config?.platformOptions || {}}
            platformLimits={config?.platformLimits || {}}
            initialDate={selectedDate}
            onClose={() => setView('calendar')}
          />
        )}
        {view === 'detail' && selectedPost && (
          <PostDetail
            post={selectedPost}
            onClose={() => setView('calendar')}
          />
        )}
        {view === 'media' && (
          <MediaLibrary
            onClose={() => setView('calendar')}
            onNavigateToPost={async (postId) => {
              try {
                const post = await api.getPost(postId);
                setSelectedPost(post);
                setView('detail');
              } catch {
                setView('calendar');
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
