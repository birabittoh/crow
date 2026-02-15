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
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Search for music when query changes (debounced)
  useEffect(() => {
    if (mode !== 'search' || searchQuery.trim().length < 2) {
      setTracks([]);
      setShowResults(false);
      setNotice(null);
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
        setNotice(data.notice || null);
        setShowResults(true);
      } catch (err: any) {
        setError(err.message);
        setTracks([]);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, mode]);

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
    setManualId('');
    setManualName('');
    setManualArtist('');
  };

  const handleManualSubmit = () => {
    if (!manualId.trim()) {
      setError('Audio ID is required');
      return;
    }
    const track: MusicTrack = {
      id: manualId.trim(),
      name: manualName.trim() || 'Custom Audio',
      artist: manualArtist.trim() || 'Unknown Artist',
      duration: 0,
    };
    setSelectedTrack(track);
    onChange(track.id, track.name, track.artist);
    if (onAudioNameChange) onAudioNameChange(track.name);
    if (onArtistChange) onArtistChange(track.artist);
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
        <>
          <div className="music-mode-tabs">
            <button
              type="button"
              className={`music-mode-tab ${mode === 'search' ? 'active' : ''}`}
              onClick={() => setMode('search')}
            >
              Search (Demo)
            </button>
            <button
              type="button"
              className={`music-mode-tab ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              Enter Audio ID
            </button>
          </div>

          {mode === 'search' ? (
            <div className="music-search">
              {notice && <div className="music-notice">{notice}</div>}
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
          ) : (
            <div className="music-manual">
              <div className="music-manual-help">
                Find audio IDs in Instagram Creator Studio or use the Facebook Music Catalog API.
              </div>
              <div className="form-group">
                <label>Audio ID *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., 1234567890"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Track Name (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., My Song"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Artist (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Artist Name"
                  value={manualArtist}
                  onChange={(e) => setManualArtist(e.target.value)}
                />
              </div>
              {error && <div className="music-search-error">{error}</div>}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleManualSubmit}
              >
                Add Music
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
