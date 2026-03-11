import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('clubos-theme') as Theme;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    updateMetaTheme(initialTheme);
  }, []);

  const updateMetaTheme = (theme: Theme) => {
    // Update theme-color meta tag with proper colors
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      // Use CedarwoodOS brand colors that match the actual theme
      metaTheme.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f9fafb');
    }

    // Update apple-mobile-web-app-status-bar-style for iOS
    const appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusBar) {
      appleStatusBar.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
    }

    // Update msapplication-navbutton-color for Windows
    const msNavButton = document.querySelector('meta[name="msapplication-navbutton-color"]');
    if (msNavButton) {
      msNavButton.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f9fafb');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('clubos-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    updateMetaTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
