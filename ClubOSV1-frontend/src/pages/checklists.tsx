import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Clipboard } from 'lucide-react';
import OperatorLayout from '@/components/OperatorLayout';

export default function Checklists() {
  const { user } = useAuthState();
  const router = useRouter();

  // SECURITY: Block customer role from accessing checklists
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.push('/customer/');
        return;
      }
      // Allow operator roles and contractors
      if (!['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
        router.push('/login');
        return;
      }
    }
  }, [user, router]);

  // Don't render until we know the user's role
  if (!user || !['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
    return null;
  }

  return (
    <OperatorLayout
      title="Checklists - CedarwoodOS"
      description="Checklists for operations management"
    >
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Clipboard className="w-16 h-16 text-[var(--text-muted)] mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Checklists</h1>
        <p className="text-[var(--text-secondary)]">Coming Soon</p>
      </div>
    </OperatorLayout>
  );
}
