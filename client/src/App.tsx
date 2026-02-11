import React, { useState } from 'react';
import { useConfig } from './hooks';
import Calendar from './components/Calendar';
import PostForm from './components/PostForm';
import PostDetail from './components/PostDetail';
import type { Post } from './api';

type View = 'calendar' | 'create' | 'detail';

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
      </main>
    </div>
  );
}
