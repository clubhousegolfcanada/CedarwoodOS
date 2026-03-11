/**
 * CedarwoodOS Media Knowledge Engine - Gallery Display
 *
 * Displays media search results as horizontal card row.
 * Each card: thumbnail + description snippet + location + date + attribution.
 * Click opens lightbox modal with full image + AI description + tags.
 */

import React, { useState } from 'react';
import { X, MapPin, Clock, User, Image as ImageIcon, FileText, Search, Trash2 } from 'lucide-react';
import type { MediaSearchResult } from '@/types/request';

interface MediaGalleryProps {
  results: MediaSearchResult[];
  context?: string; // optional text answer from RAG
  onDelete?: (id: string) => void; // callback when user deletes an asset
}

// Format relative time ("3 weeks ago", "2 hours ago")
const timeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const MediaGallery: React.FC<MediaGalleryProps> = ({ results, context, onDelete }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [localResults, setLocalResults] = useState<MediaSearchResult[]>(results);

  // Sync local results when prop changes
  React.useEffect(() => {
    setLocalResults(results);
  }, [results]);

  if (!localResults || localResults.length === 0) return null;

  const hasPartialOnly = localResults.every(r => r.isPartialMatch);

  // Handle delete: remove from local state, close lightbox if needed, call parent
  const handleDelete = (id: string) => {
    const newResults = localResults.filter(r => r.id !== id);
    setLocalResults(newResults);
    setLightboxIndex(null);
    if (onDelete) onDelete(id);
  };

  return (
    <div className="space-y-3">
      {/* RAG context answer (if present) */}
      {context && (
        <div className="text-sm text-[var(--text-primary)] leading-relaxed pl-4">
          {context}
        </div>
      )}

      {/* Section label */}
      <div className="flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
          {hasPartialOnly ? 'Related Media' : 'Media Results'}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          ({localResults.length})
        </span>
      </div>

      {/* Horizontal card row */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {localResults.map((result, index) => (
          <button
            key={result.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="flex-shrink-0 w-44 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition-colors text-left group"
          >
            {/* Thumbnail */}
            <div className="w-full h-28 bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden">
              {result.thumbnailData ? (
                <img
                  src={result.thumbnailData}
                  alt={result.aiDescription || result.fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : result.mimeType === 'application/pdf' ? (
                <FileText className="w-8 h-8 text-red-400" />
              ) : (
                <ImageIcon className="w-8 h-8 text-[var(--text-muted)]" />
              )}

              {/* Partial match badge */}
              {result.isPartialMatch && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-yellow-500/80 text-white text-[9px] font-medium rounded">
                  Related
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2 space-y-1">
              <p className="text-xs text-[var(--text-primary)] font-medium line-clamp-2 leading-tight">
                {result.aiDescription || result.userDescription || result.fileName}
              </p>

              {/* Location + time */}
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                {result.location && (
                  <span className="flex items-center gap-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                    {result.location}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                  {timeAgo(result.createdAt)}
                </span>
              </div>

              {/* Attribution */}
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <User className="w-2.5 h-2.5" />
                <span>{result.uploaderName}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && localResults[lightboxIndex] && (
        <LightboxModal
          result={localResults[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxIndex > 0 ? () => setLightboxIndex(lightboxIndex - 1) : undefined}
          onNext={lightboxIndex < localResults.length - 1 ? () => setLightboxIndex(lightboxIndex + 1) : undefined}
          onDelete={onDelete ? () => handleDelete(localResults[lightboxIndex].id) : undefined}
        />
      )}
    </div>
  );
};

// ─── Lightbox Modal ───────────────────────────────────────────────────────────

interface LightboxModalProps {
  result: MediaSearchResult;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDelete?: () => void;
}

const LightboxModal: React.FC<LightboxModalProps> = ({ result, onClose, onPrev, onNext, onDelete }) => {
  const [fullResUrl, setFullResUrl] = React.useState<string | null>(null);
  const [loadingFullRes, setLoadingFullRes] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Fetch full-resolution image when lightbox opens
  React.useEffect(() => {
    if (result.id && result.mimeType?.startsWith('image/')) {
      setLoadingFullRes(true);
      setFullResUrl(null);
      const { http } = require('@/api/http');
      http.get(`media/${result.id}/file`)
        .then((res: any) => {
          // Backend returns { success, fileData } — axios wraps in res.data
          const fileData = res.data?.fileData || res.data?.data?.fileData;
          if (fileData) {
            setFullResUrl(fileData);
          }
        })
        .catch((err: any) => {
          console.warn('[MediaGallery] Full-res fetch failed, using thumbnail:', err?.message);
        })
        .finally(() => setLoadingFullRes(false));
    }
  }, [result.id]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  // Handle delete with API call
  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const { http } = require('@/api/http');
      await http.delete(`media/${result.id}`);
      if (onDelete) onDelete();
    } catch (err: any) {
      console.error('[MediaGallery] Delete failed:', err?.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-3xl w-full mx-4 bg-[var(--bg-primary)] rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image area */}
        <div className="flex-1 bg-[var(--bg-tertiary)] flex items-center justify-center min-h-[200px] max-h-[60vh] overflow-hidden">
          {result.thumbnailData || fullResUrl ? (
            <img
              src={fullResUrl || result.thumbnailData || ''}
              alt={result.aiDescription || result.fileName}
              className="max-w-full max-h-[60vh] object-contain"
            />
          ) : result.mimeType === 'application/pdf' ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <FileText className="w-16 h-16 text-red-400" />
              <span className="text-sm text-[var(--text-secondary)]">{result.fileName}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <ImageIcon className="w-16 h-16 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)]">No preview available</span>
            </div>
          )}

          {/* Navigation arrows */}
          {onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Info panel */}
        <div className="p-4 space-y-3 border-t border-[var(--border-secondary)]">
          {/* AI Description */}
          {result.aiDescription && (
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              {result.aiDescription}
            </p>
          )}

          {/* User Description (if different from AI) */}
          {result.userDescription && result.userDescription !== result.aiDescription && (
            <p className="text-sm text-[var(--text-secondary)] italic">
              &ldquo;{result.userDescription}&rdquo;
            </p>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
            {result.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {result.location}
              </span>
            )}
            {result.category && (
              <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded-full capitalize">
                {result.category}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(result.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          {/* Attribution footer + delete */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-secondary)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <User className="w-3 h-3" />
              <span>
                Uploaded by <strong className="text-[var(--text-secondary)]">{result.uploaderName}</strong>
                {' \u00B7 '}
                {timeAgo(result.createdAt)}
              </span>
            </div>

            {/* Delete button */}
            {onDelete && (
              <div className="flex items-center gap-2">
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-red-400">Delete permanently?</span>
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={deleting}
                      className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="px-2 py-1 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete this asset"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaGallery;
