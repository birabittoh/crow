import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  duration: number;
}

interface InstagramMusicPickerProps {
  value: string | undefined;
  onChange: (trackId: string | undefined, trackName?: string, artistName?: string) => void;
  onAudioNameChange?: (name: string) => void;
  onArtistChange?: (artist: string) => void;
}

export default function InstagramMusicPicker({
  value,
  onChange,
  onAudioNameChange,
  onArtistChange,
}: InstagramMusicPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Search for music when query changes (debounced)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setTracks([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/platforms/instagram/music/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to search music');
        }
        const data = await response.json();
        setTracks(data.tracks || []);
        setShowResults(true);
      } catch (err: any) {
        setError(err.message);
        setTracks([]);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelectTrack = (track: MusicTrack) => {
    setSelectedTrack(track);
    onChange(track.id, track.name, track.artist);
    if (onAudioNameChange) onAudioNameChange(track.name);
    if (onArtistChange) onArtistChange(track.artist);
    setShowResults(false);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    setSelectedTrack(null);
    onChange(undefined);
    if (onAudioNameChange) onAudioNameChange('');
    if (onArtistChange) onArtistChange('');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="instagram-music-picker">
      {selectedTrack ? (
        <div className="selected-music">
          <div className="selected-music-info">
            <span className="music-icon">🎵</span>
            <div className="music-details">
              <div className="music-name">{selectedTrack.name}</div>
              <div className="music-artist">{selectedTrack.artist}</div>
            </div>
            {selectedTrack.duration > 0 && (
              <span className="music-duration">{formatDuration(selectedTrack.duration)}</span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleClearSelection}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="music-search">
          <input
            type="text"
            className="form-input"
            placeholder="Search for music..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (tracks.length > 0) setShowResults(true);
            }}
          />
          {loading && <div className="music-search-loading">Searching...</div>}
          {error && <div className="music-search-error">{error}</div>}
          {showResults && tracks.length > 0 && (
            <div className="music-search-results">
              {tracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  className="music-track-item"
                  onClick={() => handleSelectTrack(track)}
                >
                  <span className="music-icon">🎵</span>
                  <div className="music-details">
                    <div className="music-name">{track.name}</div>
                    <div className="music-artist">{track.artist}</div>
                  </div>
                  <span className="music-duration">{formatDuration(track.duration)}</span>
                </button>
              ))}
            </div>
          )}
          {showResults && tracks.length === 0 && !loading && searchQuery.length >= 2 && (
            <div className="music-search-empty">No music found</div>
          )}
        </div>
      )}
    </div>
  );
}
