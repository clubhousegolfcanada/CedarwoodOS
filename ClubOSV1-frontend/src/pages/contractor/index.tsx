import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import Head from 'next/head';

export default function ContractorDashboard() {
  const { user } = useAuthState();
  const router = useRouter();

  useEffect(() => {
    // Redirect contractors directly to checklists
    if (user?.role === 'contractor') {
      router.replace('/checklists');
    } else if (user) {
      // If not a contractor, redirect based on role
      switch (user.role) {
        case 'admin':
        case 'operator':
        case 'support':
          router.replace('/');
          break;
        default:
          router.replace('/login');
      }
    } else {
      router.replace('/login');
    }
  }, [user, router]);

  return (
    <>
      <Head>
        <title>CedarwoodOS - Redirecting...</title>
      </Head>
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Redirecting...</div>
      </div>
    </>
  );
}