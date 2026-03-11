import RequestForm from '@/components/RequestForm';
import DatabaseExternalTools from '@/components/DatabaseExternalTools';
import { useEffect, useState } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { CommandShortcutBar } from '@/components/dashboard/CommandShortcutBar';
import { TaskList } from '@/components/dashboard/TaskList';
import { DashboardErrorBoundary, SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import OperatorLayout from '@/components/OperatorLayout';


export default function Home() {
  const { user } = useAuthState();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // SECURITY: Enforce operator-only access with whitelist approach
  useEffect(() => {
    const checkAuth = setTimeout(() => {
      if (user && !['admin', 'operator', 'support', 'kiosk'].includes(user.role)) {
        router.push('/login');
      }
    }, 100);

    return () => clearTimeout(checkAuth);
  }, [user, router]);

  // Set client flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <OperatorLayout
      title="CedarwoodOS - Operations Terminal"
      description="Dashboard for business operations management"
      padding="lg"
    >
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            {/* Request Form - Takes up 8 columns on large screens */}
            <div className="lg:col-span-8">
              <DashboardErrorBoundary>
                <RequestForm />
              </DashboardErrorBoundary>

              {/* Task List */}
              <SectionErrorBoundary section="Tasks">
                <TaskList />
              </SectionErrorBoundary>
            </div>

            {/* Sidebar - External Tools - 4 columns */}
            <div className="lg:col-span-4">
              <SectionErrorBoundary section="Quick Links">
                <DatabaseExternalTools quickStats={[]} />
              </SectionErrorBoundary>
            </div>
          </div>

        {/* Command Shortcut Bar - Desktop only */}
        <CommandShortcutBar />
    </OperatorLayout>
  );
}
