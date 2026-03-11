import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink, Monitor, Calendar, Users, Shield, CreditCard, Activity, HardDrive, Edit2, Save, X, Loader, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useNotifications } from '@/state/hooks';
import { userSettingsApi } from '@/services/userSettings';
import logger from '@/services/logger';

interface QuickStat {
  label: string;
  value: string;
  change?: string;
  trend: 'up' | 'down' | 'neutral';
  isButton?: boolean;
  onClick?: () => void;
  buttonText?: string;
  statusIndicator?: boolean;
}

interface DatabaseExternalToolsProps {
  quickStats?: QuickStat[];
}

// Default URLs
const DEFAULT_EXTERNAL_TOOLS = {
  REMOTE_DESKTOP: 'https://my.splashtop.com/computers',
  BOOKING_SITE: '#', // TODO: Configure booking URL
  CUSTOMER_INFO: 'https://app.hubspot.com',
  ACCESS_CAMERAS: 'https://unifi.ui.com',
  STRIPE_RETURNS: 'https://dashboard.stripe.com',
  TRACKMAN_PORTAL: 'https://login.trackmangolf.com/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Ddr-web.4633fada-3b16-490f-8de7-2aa67158a1d6%26scope%3Dopenid%2520profile%2520email%2520offline_access%2520https%253A%252F%252Fauth.trackman.com%252Fdr%252Fcloud%2520https%253A%252F%252Fauth.trackman.com%252Fauthorization%2520https%253A%252F%252Fauth.trackman.com%252Fproamevent%26response_type%3Dcode%26redirect_uri%3Dhttps%253A%252F%252Fportal.trackmangolf.com%252Faccount%252Fcallback%26nonce%3D08fBNss-AVg9eR2T8pu2JKKfZGk8sWH9vzCqjPrG8z8%26state%3DeyJyZXR1cm5UbyI6Ii8ifQ%26code_challenge_method%3DS256%26code_challenge%3D06sJEm0-gkB1i-I4J_FdgtLpWCeNkX4OWn2CmMmEmcY',
  GOOGLE_DRIVE: 'https://drive.google.com'
};

const DatabaseExternalTools: React.FC<DatabaseExternalToolsProps> = ({ quickStats = [] }) => {
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedUrls, setEditedUrls] = useState<Record<string, string>>({});
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  const [savedTitles, setSavedTitles] = useState<Record<string, string>>({});
  const [isStatusCollapsed, setIsStatusCollapsed] = useState(false);
  const [isLinksCollapsed, setIsLinksCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // All users can now edit their own links - but not on mobile
  const canEdit = !!user && !isMobile;

  // Load collapsed state from localStorage and detect mobile
  useEffect(() => {
    // Detect mobile
    const checkMobile = () => {
      const mobile = window.innerWidth < 640; // sm breakpoint
      setIsMobile(mobile);

      // Set initial collapsed state for links
      const savedLinksState = localStorage.getItem('linksSectionCollapsed');
      if (savedLinksState !== null) {
        setIsLinksCollapsed(savedLinksState === 'true');
      } else {
        // Default to collapsed on mobile only
        setIsLinksCollapsed(mobile);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Load status collapsed state
    const savedStatusState = localStorage.getItem('statusSectionCollapsed');
    if (savedStatusState !== null) {
      setIsStatusCollapsed(savedStatusState === 'true');
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save collapsed state to localStorage
  const toggleStatusCollapsed = () => {
    const newState = !isStatusCollapsed;
    setIsStatusCollapsed(newState);
    localStorage.setItem('statusSectionCollapsed', String(newState));
  };
  
  const toggleLinksCollapsed = () => {
    const newState = !isLinksCollapsed;
    setIsLinksCollapsed(newState);
    localStorage.setItem('linksSectionCollapsed', String(newState));
  };

  // Tool definitions (name and icon are locked)
  const tools = [
    {
      id: 'REMOTE_DESKTOP',
      name: 'Remote Desktop',
      subtitle: 'Splashtop',
      icon: Monitor,
      color: '#FFFFFF'
    },
    {
      id: 'BOOKING_SITE',
      name: 'Booking Site',
      subtitle: 'Skedda',
      icon: Calendar,
      color: '#FFFFFF'
    },
    {
      id: 'CUSTOMER_INFO',
      name: 'Customer Info',
      subtitle: 'HubSpot',
      icon: Users,
      color: '#FFFFFF'
    },
    {
      id: 'ACCESS_CAMERAS',
      name: 'Access & Cameras',
      subtitle: 'UniFi',
      icon: Shield,
      color: '#FFFFFF'
    },
    {
      id: 'STRIPE_RETURNS',
      name: 'Returns',
      subtitle: 'Stripe',
      icon: CreditCard,
      color: '#FFFFFF'
    },
    {
      id: 'TRACKMAN_PORTAL',
      name: 'Equipment Portal',
      subtitle: 'Tools',
      icon: Activity,
      color: '#FF9800'
    },
    {
      id: 'GOOGLE_DRIVE',
      name: 'File Search',
      subtitle: 'Google Drive',
      icon: HardDrive,
      color: '#FFFFFF'
    }
  ];

  // Load saved URLs from database on mount
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        const links = await userSettingsApi.getExternalLinks();
        if (links) {
          // Separate URLs and titles from saved data
          const urls: Record<string, string> = {};
          const titles: Record<string, string> = {};
          Object.entries(links).forEach(([key, value]) => {
            if (key.endsWith('_TITLE')) {
              titles[key.replace('_TITLE', '')] = value;
            } else {
              urls[key] = value;
            }
          });
          setSavedUrls(urls);
          setSavedTitles(titles);
        }
      } catch (error) {
        logger.error('Failed to load user settings:', error);
        notify('error', 'Failed to load your custom links');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserSettings();
  }, [user, notify]);

  // Get the current URL for a tool
  const getToolUrl = (toolId: string) => {
    // Priority: edited URL > saved URL > environment variable > default
    if (isEditMode && editedUrls[toolId] !== undefined) {
      return editedUrls[toolId];
    }
    if (savedUrls[toolId]) {
      return savedUrls[toolId];
    }
    if (process.env[`NEXT_PUBLIC_${toolId}_URL`]) {
      return process.env[`NEXT_PUBLIC_${toolId}_URL`]!;
    }
    return DEFAULT_EXTERNAL_TOOLS[toolId as keyof typeof DEFAULT_EXTERNAL_TOOLS];
  };

  // Get the current display title for a tool
  const getToolTitle = (tool: typeof tools[0]) => {
    if (isEditMode && editedTitles[tool.id] !== undefined) {
      return editedTitles[tool.id];
    }
    if (savedTitles[tool.id]) {
      return savedTitles[tool.id];
    }
    return tool.name;
  };

  const handleTitleChange = (toolId: string, value: string) => {
    setEditedTitles(prev => ({
      ...prev,
      [toolId]: value
    }));
  };

  const handleToolClick = (url: string, toolId?: string) => {
    if (!isEditMode && url) {
      // Special handling for Splashtop on all platforms
      if (toolId === 'REMOTE_DESKTOP') {
        const userAgent = navigator.userAgent;
        const isIOS = /iPhone|iPad|iPod/.test(userAgent) && !/Mac/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);
        const isMac = /Mac/.test(userAgent) && !isIOS;
        const isWindows = /Windows/.test(userAgent);
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: minimal-ui)').matches ||
                      window.matchMedia('(display-mode: fullscreen)').matches;
        
        logger.debug(`Platform detection - iOS: ${isIOS}, Android: ${isAndroid}, Mac: ${isMac}, Windows: ${isWindows}, PWA: ${isPWA}`);
        
        if (isIOS) {
          // iOS: Try multiple URL schemes for Splashtop Business app
          logger.debug('iOS detected - attempting to open Splashtop Business app...');
          
          // Try different URL schemes
          const schemes = [
            'splashtopbusiness://',  // Splashtop Business specific
            'splashtop://',          // Generic Splashtop
            'stbusiness://'          // Alternative Business scheme
          ];
          
          let schemeIndex = 0;
          const tryNextScheme = () => {
            if (schemeIndex < schemes.length) {
              const scheme = schemes[schemeIndex];
              logger.debug(`Trying iOS scheme: ${scheme}`);
              
              // Create invisible iframe to attempt app launch
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = scheme;
              document.body.appendChild(iframe);
              
              setTimeout(() => {
                document.body.removeChild(iframe);
                schemeIndex++;
                
                // Check if page is still visible (app didn't open)
                if (!document.hidden && schemeIndex < schemes.length) {
                  tryNextScheme();
                } else if (!document.hidden && schemeIndex >= schemes.length) {
                  // All schemes failed, fallback to web
                  logger.debug('No iOS app found, opening web portal...');
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }, 500);
            }
          };
          
          tryNextScheme();
          
        } else if (isAndroid) {
          // Android: Use intent for Splashtop Business app
          logger.debug('Android detected - attempting to open Splashtop Business app...');
          
          // Try Splashtop Business package first
          const businessIntent = `intent://open#Intent;scheme=splashtopbusiness;package=com.splashtop.remote.business;S.browser_fallback_url=${encodeURIComponent(url)};end`;
          window.location.href = businessIntent;
          
        } else if (isMac || isWindows) {
          // Desktop: Try to open desktop app first, then fallback to web
          logger.debug(`Desktop ${isMac ? 'Mac' : 'Windows'} detected - attempting to open Splashtop Business desktop app...`);
          
          // Try desktop URL schemes
          const desktopScheme = 'splashtopbusiness://';
          
          // Create invisible iframe to attempt desktop app launch
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = desktopScheme;
          document.body.appendChild(iframe);
          
          // Set up fallback to web portal
          setTimeout(() => {
            document.body.removeChild(iframe);
            // Always open web portal as backup on desktop
            logger.debug('Opening web portal as fallback/primary option...');
            window.open(url, '_blank', 'noopener,noreferrer');
          }, 1000);
          
        } else {
          // Unknown platform: Open web portal
          logger.debug('Unknown platform - opening web portal...');
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } else {
        // For all other tools, use standard web opening
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleEditToggle = () => {
    if (!user) {
      notify('error', 'Please log in to customize links');
      return;
    }
    
    if (isEditMode) {
      // Cancel edit mode - discard changes
      setEditedUrls({});
      setEditedTitles({});
      setIsEditMode(false);
    } else {
      // Enter edit mode - initialize with current URLs and titles
      const currentUrls: Record<string, string> = {};
      const currentTitles: Record<string, string> = {};
      tools.forEach(tool => {
        currentUrls[tool.id] = getToolUrl(tool.id);
        currentTitles[tool.id] = savedTitles[tool.id] || tool.name;
      });
      setEditedUrls(currentUrls);
      setEditedTitles(currentTitles);
      setIsEditMode(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Filter out default URLs and titles - only save customized ones
      const dataToSave: Record<string, string> = {};
      tools.forEach(tool => {
        const url = editedUrls[tool.id];
        if (url && url !== DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS]) {
          dataToSave[tool.id] = url;
        }
        const title = editedTitles[tool.id];
        if (title && title !== tool.name) {
          dataToSave[`${tool.id}_TITLE`] = title;
        }
      });

      // Save to database
      await userSettingsApi.saveExternalLinks(dataToSave);

      // Separate saved URLs and titles for state
      const newUrls: Record<string, string> = {};
      const newTitles: Record<string, string> = {};
      Object.entries(dataToSave).forEach(([key, value]) => {
        if (key.endsWith('_TITLE')) {
          newTitles[key.replace('_TITLE', '')] = value;
        } else {
          newUrls[key] = value;
        }
      });
      setSavedUrls(newUrls);
      setSavedTitles(newTitles);
      setIsEditMode(false);
      setEditedUrls({});
      setEditedTitles({});
      notify('success', 'External links updated successfully');
    } catch (error) {
      logger.error('Failed to save links:', error);
      notify('error', 'Failed to save your custom links');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUrlChange = (toolId: string, value: string) => {
    setEditedUrls(prev => ({
      ...prev,
      [toolId]: value
    }));
  };

  const handleReset = (toolId: string) => {
    setEditedUrls(prev => ({
      ...prev,
      [toolId]: DEFAULT_EXTERNAL_TOOLS[toolId as keyof typeof DEFAULT_EXTERNAL_TOOLS]
    }));
    const tool = tools.find(t => t.id === toolId);
    if (tool) {
      setEditedTitles(prev => ({
        ...prev,
        [toolId]: tool.name
      }));
    }
  };

  const handleResetAll = () => {
    const defaultUrls: Record<string, string> = {};
    const defaultTitles: Record<string, string> = {};
    tools.forEach(tool => {
      defaultUrls[tool.id] = DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS];
      defaultTitles[tool.id] = tool.name;
    });
    setEditedUrls(defaultUrls);
    setEditedTitles(defaultTitles);
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-[var(--accent)]" />
        </div>
      </div>
    );
  }


  return (
    <div className="card">
      <div className="space-y-3">
        {/* Quick Stats Section */}
        {quickStats && quickStats.length > 0 && (
          <div>
            <button
              onClick={toggleStatusCollapsed}
              className="w-full flex items-center justify-between mb-3 hover:text-[var(--text-primary)] transition-colors"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)]">Status</span>
              <div className="flex items-center gap-2">
                {isStatusCollapsed && (
                  <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                    {quickStats.length} stats
                  </span>
                )}
                {isStatusCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </div>
            </button>

            {/* Collapsible Status Content */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isStatusCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'
            }`}>
              <div className="grid grid-cols-2 gap-2">
                {quickStats.map((stat, index) => (
                  stat.isButton ? (
                    <button
                      key={index}
                      onClick={stat.onClick}
                      className="text-left p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors border border-[var(--border-secondary)]"
                    >
                      <div className="text-[10px] text-[var(--text-muted)]">{stat.label}</div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{stat.value}</div>
                      {stat.buttonText && (
                        <div className="text-[10px] text-[var(--accent)] mt-1">{stat.buttonText}</div>
                      )}
                    </button>
                  ) : (
                    <div key={index} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                      <div className="text-[10px] text-[var(--text-muted)]">{stat.label}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{stat.value}</span>
                        {stat.change && (
                          <span className={`text-[10px] ${
                            stat.trend === 'up' ? 'text-green-500' :
                            stat.trend === 'down' ? 'text-red-500' :
                            'text-[var(--text-muted)]'
                          }`}>
                            {stat.change}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Divider - only show if stats section is visible */}
        {quickStats && quickStats.length > 0 && (
          <div className="border-t border-[var(--border-secondary)]"></div>
        )}

        {/* External Tools Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={toggleLinksCollapsed}
              className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
            >
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Quick Links</h3>
              {isLinksCollapsed && (
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                  {tools.length} tools
                </span>
              )}
              {isLinksCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>

            {/* Edit controls — outside the collapse button */}
            {canEdit && !isLinksCollapsed && (
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <button
                      onClick={handleResetAll}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline mr-2"
                      title="Reset all to defaults"
                    >
                      Reset All
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors disabled:opacity-50"
                      title="Save changes"
                    >
                      {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleEditToggle}
                      disabled={isSaving}
                      className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEditToggle}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
                    title="Edit your links"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
      
        {/* Collapsible Quick Links Content */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isLinksCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'
        }`}>
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 sm:gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const url = getToolUrl(tool.id);
          const isCustomized = (savedUrls[tool.id] && savedUrls[tool.id] !== DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS]) || !!savedTitles[tool.id];
          
          return (
            <div key={tool.id} className="relative">
              {isEditMode ? (
                  <div className="w-full p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                      <div
                        className="p-1 rounded bg-[var(--bg-tertiary)]"
                        style={{ color: tool.color }}
                      >
                        <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editedTitles[tool.id] ?? tool.name}
                        onChange={(e) => handleTitleChange(tool.id, e.target.value)}
                        className="w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder="Link title..."
                      />
                    </div>
                    {(editedUrls[tool.id] !== DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS] || editedTitles[tool.id] !== tool.name) && (
                      <button
                        onClick={() => handleReset(tool.id)}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(tool.id, e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-xs focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Enter URL..."
                  />
                </div>
              ) : (
                <button
                  onClick={() => handleToolClick(url, tool.id)}
                  className="w-full p-2 sm:p-2.5 min-h-[44px] bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 group active:scale-95"
                  disabled={!url}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className="p-1 rounded bg-[var(--bg-tertiary)] group-hover:bg-[var(--bg-primary)]"
                      style={{ color: tool.color }}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-xs text-[var(--text-primary)]">
                        {getToolTitle(tool)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {tool.subtitle}
                      </p>
                    </div>
                    {isCustomized && (
                      <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full" title="Customized URL" />
                    )}
                    <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
                  </div>
                </button>
              )}
            </div>
            );
          })}
          </div>
        </div>
        
        {isEditMode && (
          <div className="mt-2 text-[10px] text-[var(--text-muted)]">
            Custom links sync across devices
          </div>
        )}
        
        {!user && (
          <div className="mt-2 text-[10px] text-[var(--text-muted)] text-center">
            <Link href="/login" className="text-[var(--accent)] hover:underline">Log in</Link> to customize
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseExternalTools;
