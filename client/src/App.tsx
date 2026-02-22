import React, { useState } from 'react';
import { useConfig } from './hooks';
import PostForm from './components/PostForm';
import PostDetail from './components/PostDetail';
import CalendarPage from './pages/CalendarPage';
import MediaPage from './pages/MediaPage';
import PostsPage from './pages/PostsPage';
import PlatformsPage from './pages/PlatformsPage';
import { api } from './api';
import type { Post } from './api';

type View = 'calendar' | 'create' | 'detail' | 'media' | 'posts' | 'platforms';

export default function App() {
  const { data: config, isLoading, error } = useConfig();
  const [view, setView] = useState<View>('calendar');
  const [returnView, setReturnView] = useState<View>('calendar');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialTheme, setInitialTheme] = useState<string>('');

  if (isLoading) {
    return <div className="loading">Loading configuration...</div>;
  }

  if (error) {
    return <div className="error">Failed to load configuration: {error.message}</div>;
  }

  const hasPlatforms = (config?.platforms.length ?? 0) > 0;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title" onClick={() => setView('calendar')}>
          Crow
        </h1>
        <div className="header-actions">
          <button
            className="btn btn-ghost"
            onClick={() => setView('platforms')}
            title="Platforms"
          >
            ⚙️
          </button>
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
            onSelectDate={(date, theme) => {
              if (!hasPlatforms) return;
              setSelectedPost(null);
              setSelectedDate(date);
              setInitialTheme(theme || '');
              setReturnView('calendar');
              setView('create');
            }}
          />
        )}
        {view === 'create' && (
          <PostForm
            platforms={config?.platforms || []}
            platformOptions={config?.platformOptions || {}}
            platformLimits={config?.platformLimits || {}}
            initialDate={selectedDate}
            initialTheme={initialTheme}
            aiServices={config?.aiServices || []}
            aiDefaultPrompt={config?.aiDefaultPrompt || ''}
            post={selectedPost || undefined}
            onClose={() => {
              setSelectedPost(null);
              setInitialTheme('');
              setView(returnView);
            }}
          />
        )}
        {view === 'detail' && selectedPost && (
          <PostDetail
            post={selectedPost}
            onEdit={(post) => {
              setSelectedPost(post);
              setView('create');
            }}
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
              setView('detail');
            }}
            onClose={() => setView('calendar')}
          />
        )}
        {view === 'platforms' && (
          <PlatformsPage
            onClose={() => setView('calendar')}
          />
        )}
      </main>
    </div>
  );
}
