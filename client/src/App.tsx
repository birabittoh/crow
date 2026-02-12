import React, { useState } from 'react';
import { useConfig } from './hooks';
import PostForm from './components/PostForm';
import PostDetail from './components/PostDetail';
import CalendarPage from './pages/CalendarPage';
import MediaPage from './pages/MediaPage';
import PostsPage from './pages/PostsPage';
import { api } from './api';
import type { Post } from './api';

type View = 'calendar' | 'create' | 'detail' | 'media' | 'posts';

export default function App() {
  const { data: config, isLoading, error } = useConfig();
  const [view, setView] = useState<View>('calendar');
  const [returnView, setReturnView] = useState<View>('calendar');
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
            onClick={() => setView('posts')}
          >
            Posts
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setView('media')}
          >
            Media
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedPost(null);
              setSelectedDate(null);
              setReturnView(view === 'create' ? returnView : view);
              setView('create');
            }}
          >
            + New Post
          </button>
        </div>
      </header>

      <main className="app-main">
        {view === 'calendar' && (
          <CalendarPage
            onSelectPost={(post) => {
              setSelectedPost(post);
              setReturnView('calendar');
              setView('detail');
            }}
            onSelectDate={(date) => {
              setSelectedPost(null);
              setSelectedDate(date);
              setReturnView('calendar');
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
            post={selectedPost || undefined}
            onClose={() => {
              setSelectedPost(null);
              setView(returnView);
            }}
          />
        )}
        {view === 'detail' && selectedPost && (
          <PostDetail
            post={selectedPost}
            onClose={() => setView(returnView)}
          />
        )}
        {view === 'media' && (
          <MediaPage
            onClose={() => setView('calendar')}
            onNavigateToPost={async (postId) => {
              try {
                const post = await api.getPost(postId);
                setSelectedPost(post);
                setReturnView('media');
                setView('detail');
              } catch {
                setView('calendar');
              }
            }}
          />
        )}
        {view === 'posts' && (
          <PostsPage
            onSelectPost={(post) => {
              setSelectedPost(post);
              setReturnView('posts');
              setView('create');
            }}
            onClose={() => setView('calendar')}
          />
        )}
      </main>
    </div>
  );
}
