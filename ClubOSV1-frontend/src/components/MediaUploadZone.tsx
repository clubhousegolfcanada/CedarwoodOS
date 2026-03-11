/**
 * CedarwoodOS Media Knowledge Engine - Upload Zone
 *
 * Zero-friction media upload: camera, file picker, clipboard paste, drag-and-drop.
 * No description required — AI fills metadata via GPT-4 Vision.
 * Supports JPEG, PNG, WebP, HEIC (converted client-side), and PDF.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import type { MediaAttachment } from '@/types/request';

interface MediaUploadZoneProps {
  attachments: MediaAttachment[];
  onAttachmentsChange: (attachments: MediaAttachment[]) => void;
  maxAttachments?: number;
  disabled?: boolean;
}

const MAX_FILE_SIZE_MB = 15;
const MAX_COMPRESSED_SIZE = 5_000_000; // 5MB base64 limit
const MAX_DIMENSION = 2000; // px longest side

const MediaUploadZone: React.FC<MediaUploadZoneProps> = ({
  attachments,
  onAttachmentsChange,
  maxAttachments = 5,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Process a file into a MediaAttachment
  const processFile = useCallback(async (file: File): Promise<MediaAttachment | null> => {
    // Check raw file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return null;
    }

    // Handle PDFs — just convert to base64, no image processing
    if (file.type === 'application/pdf') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          if (dataUrl.length > MAX_COMPRESSED_SIZE * 2) {
            resolve(null); // PDF too large
            return;
          }
          resolve({
            data: dataUrl,
            fileName: file.name,
            mimeType: file.type,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    // Standard image formats (PNG, SVG, JPEG, WebP): send original file as-is
    // This preserves exact resolution, quality, transparency, and metadata.
    // The backend handles EXIF stripping for privacy on photos.
    const needsCanvasConversion = file.type === 'image/heic' || file.type === 'image/heif';

    if (!needsCanvasConversion) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          if (dataUrl.length > MAX_COMPRESSED_SIZE * 2) {
            resolve(null); // File too large even at original size
            return;
          }
          resolve({
            data: dataUrl,
            fileName: file.name,
            mimeType: file.type,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    // HEIC only: must convert via canvas (browsers can't encode HEIC)
    return new Promise((resolve) => {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height / width) * MAX_DIMENSION);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width / height) * MAX_DIMENSION);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (dataUrl.length > MAX_COMPRESSED_SIZE) {
          const mqDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          if (mqDataUrl.length > MAX_COMPRESSED_SIZE) { resolve(null); return; }
          resolve({ data: mqDataUrl, fileName: file.name.replace(/\.[^.]+$/, '.jpg'), mimeType: 'image/jpeg' });
          return;
        }
        resolve({ data: dataUrl, fileName: file.name.replace(/\.[^.]+$/, '.jpg'), mimeType: 'image/jpeg' });
      };

      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
      img.src = objectUrl;
    });
  }, []);

  // Add files (from any source)
  const addFiles = useCallback(async (files: File[]) => {
    if (disabled) return;

    const remaining = maxAttachments - attachments.length;
    const filesToProcess = files.slice(0, remaining);

    if (filesToProcess.length === 0) return;

    setProcessingCount(filesToProcess.length);

    const newAttachments: MediaAttachment[] = [];

    for (const file of filesToProcess) {
      const attachment = await processFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    setProcessingCount(0);

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
  }, [attachments, disabled, maxAttachments, onAttachmentsChange, processFile]);

  // Remove an attachment
  const removeAttachment = useCallback((index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  }, [attachments, onAttachmentsChange]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (files.length > 0) addFiles(files);
  }, [addFiles]);

  // Clipboard paste handler (Ctrl+V screenshot)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      if (attachments.length >= maxAttachments) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addFiles, attachments.length, disabled, maxAttachments]);

  // File input change handler
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFiles(files);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [addFiles]);

  const canAddMore = attachments.length < maxAttachments && !disabled;

  // Compact inline: just show buttons if no attachments yet
  if (attachments.length === 0 && processingCount === 0) {
    return (
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center gap-2 transition-all ${
          isDragging
            ? 'bg-[var(--accent)]/10 border border-dashed border-[var(--accent)] rounded-lg p-2'
            : ''
        }`}
      >
        {/* Camera button (mobile-first, uses rear camera) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={!canAddMore}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors disabled:opacity-30"
          title="Take photo"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* File picker (images + PDF) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAddMore}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors disabled:opacity-30"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {isDragging && (
          <span className="text-xs text-[var(--accent)] font-medium">Drop files here</span>
        )}
      </div>
    );
  }

  // Expanded: show preview row + buttons
  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`space-y-2 transition-all ${
        isDragging
          ? 'bg-[var(--accent)]/10 border border-dashed border-[var(--accent)] rounded-lg p-2'
          : ''
      }`}
    >
      {/* Preview row */}
      <div className="flex gap-2 flex-wrap">
        {attachments.map((att, index) => (
          <div key={index} className="relative group">
            {att.mimeType === 'application/pdf' ? (
              <div className="w-16 h-16 flex flex-col items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg">
                <FileText className="w-6 h-6 text-red-500" />
                <span className="text-[8px] text-[var(--text-muted)] mt-0.5 truncate max-w-[56px] px-1">
                  {att.fileName}
                </span>
              </div>
            ) : (
              <img
                src={att.data}
                alt={att.fileName}
                className="w-16 h-16 object-cover rounded-lg border border-[var(--border-secondary)]"
              />
            )}
            <button
              type="button"
              onClick={() => removeAttachment(index)}
              className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Processing indicator */}
        {processingCount > 0 && (
          <div className="w-16 h-16 flex items-center justify-center bg-[var(--bg-tertiary)] border border-dashed border-[var(--border-secondary)] rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={!canAddMore}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors disabled:opacity-30"
          title="Take photo"
        >
          <Camera className="w-4 h-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAddMore}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors disabled:opacity-30"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <span className="text-xs text-[var(--text-muted)]">
          {attachments.length}/{maxAttachments} attached
          {attachments.length < maxAttachments && ' \u00B7 Paste or drag to add'}
        </span>
      </div>
    </div>
  );
};

export default MediaUploadZone;
