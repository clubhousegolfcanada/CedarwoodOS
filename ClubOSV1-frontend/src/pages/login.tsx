import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import toast from 'react-hot-toast';
import { http } from '@/api/http';
import { Eye, EyeOff } from 'lucide-react';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import Image from 'next/image';

const LoginPage = () => {
  const router = useRouter();
  const { login } = useAuthState();
  const { setViewMode } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default to true for 30-day login

  // Redirect authenticated users away from login page
  useEffect(() => {
    // Check if user is already authenticated
    const token = tokenManager.getToken();
    const currentUser = useAuthState.getState().user;

    // Only redirect if we have both token AND user data
    // This prevents redirect during initial auth setup
    if (token && currentUser) {
      logger.info(`User ${currentUser.email} already authenticated, redirecting...`);

      // Navigate based on user role
      const targetPath = currentUser.role === 'contractor'
        ? '/checklists'
        : '/';

      router.push(targetPath);
    }
    // Note: We do NOT clear auth data here anymore.
    // Auth should only be cleared on explicit logout action.
  }, []); // Run only once on mount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Clear any existing auth before attempting new login
      // This ensures a clean state for the new authentication
      tokenManager.clearAllAuth();

      const response = await http.post('auth/login', {
        email,
        password,
        rememberMe
      }, { auth: false } as any);

      if (response.data.success) {
        const { user, token } = response.data.data;

        // Use atomic token update to ensure clean auth state
        tokenManager.updateToken(token);

        // Update auth state (also sets viewMode in localStorage)
        login(user, token);

        // Set view mode to operator (no customer mode in CedarwoodOS)
        setViewMode('operator');

        // Show success message immediately
        toast.success(`Welcome back, ${user.name}!`);

        // Navigate based on actual user role
        const targetPath = user.role === 'contractor'
          ? '/checklists'
          : '/';

        // Use router.push with promise to ensure proper navigation
        await router.push(targetPath);
      }
    } catch (error: any) {
      logger.error('Login error:', error);

      // Extract error details
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message;

      // Provide specific error messages based on error codes
      let message = errorMessage;

      if (errorCode === 'INVALID_CREDENTIALS') {
        message = 'Invalid email or password. Please check your credentials.';
      } else if (errorCode === 'ACCOUNT_PENDING') {
        message = 'Your account is pending approval. You will be notified once approved.';
      } else if (errorCode === 'ACCOUNT_SUSPENDED') {
        message = 'Your account has been suspended. Please contact support.';
      } else if (errorCode === 'ACCOUNT_REJECTED') {
        message = 'Your account application was not approved.';
      } else if (!message) {
        message = 'Login failed. Please check your credentials.';
      }

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-[var(--bg-primary)] px-4 pt-20 pb-8">
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center">
          <Image
            src="/cedarwood-logo-dark.png"
            alt="Cedarwood Contracting"
            width={300}
            height={169}
            priority
            className="mb-2"
          />
          <h2 className="text-center text-lg sm:text-xl font-semibold text-[var(--text-secondary)]">
            Operations Terminal
          </h2>
        </div>

        <div className="space-y-4">
          {/* Password Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="operator-email" className="block text-sm font-medium text-[var(--text-secondary)]">
                Email address
              </label>
              <input
                id="operator-email"
                name="email"
                type="email"
                autoComplete="email"
                className="mt-1 block w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                placeholder="email@cedarwoodcontracting.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="operator-password" className="block text-sm font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="operator-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="block w-full px-3 py-2.5 pr-10 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="operator-remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--border-primary)] rounded"
              />
              <label htmlFor="operator-remember-me" className="ml-2 text-sm text-[var(--text-secondary)]">
                Keep me signed in for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Google Sign-In Option */}
          <div className="mt-6">
            <GoogleSignInButton
              rememberMe={rememberMe}
              loginMode="operator"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
