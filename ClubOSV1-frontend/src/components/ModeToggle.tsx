import React from 'react';
import { useStore, useAuthState } from '../state/useStore';
import { useRouter } from 'next/router';

interface ModeToggleProps {
  variant?: 'default' | 'compact';
}

const ModeToggle: React.FC<ModeToggleProps> = ({ variant = 'default' }) => {
  const { viewMode, setViewMode } = useStore();
  const { user } = useAuthState();
  const router = useRouter();

  // Only show toggle for admins and operators
  const canToggleMode = user?.role === 'admin' || user?.role === 'operator';

  if (!canToggleMode) {
    return null;
  }

  // CedarwoodOS is operator-only, so this toggle is simplified
  // Kept for potential future use but always shows operator mode
  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-xs text-[var(--text-muted)]">Mode</span>
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] px-3 py-1 rounded-full">
        <span className="text-xs font-medium text-[var(--accent)]">
          Operator
        </span>
      </div>
    </div>
  );
};

export default ModeToggle;
