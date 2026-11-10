import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogIn, LogOut, CheckCircle2, Cloud, CloudOff, Loader2, ChevronDown } from 'lucide-react';

export const UserProfileButton: React.FC = () => {
  const { user, userProfile, loading, logout, openLoginModal, openSignupModal, loginWithGoogle } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoogleClick = async () => {
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading || isSigningIn) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#155eef]" />
        <span>{isSigningIn ? 'Connecting Google...' : 'Syncing...'}</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        {/* Direct Google Sign In Button */}
        <button
          id="header-google-signin-btn"
          onClick={handleGoogleClick}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs hover:border-[#155eef]/40 active:scale-95"
          title="Sign in with your Google Account"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="font-semibold text-slate-800 dark:text-slate-100">Sign in with Google</span>
        </button>

        {/* Email Sign In */}
        <button
          onClick={openLoginModal}
          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Sign in with Email & Password"
        >
          <LogIn className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="hidden md:inline">Email Login</span>
        </button>
      </div>
    );
  }

  const displayName = userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#155eef] to-blue-500 text-white font-bold flex items-center justify-center text-[11px] shadow-xs">
            {initial}
          </div>
        )}
        <div className="hidden sm:flex flex-col text-left">
          <span className="font-semibold text-slate-900 dark:text-white leading-tight max-w-[120px] truncate">
            {displayName}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Cloud className="w-2.5 h-2.5" />
            <span>Firebase Synced</span>
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0f1424] rounded-2xl shadow-xl border border-blue-100 dark:border-blue-900/40 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Cloud Firestore Active</span>
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={async () => {
                setDropdownOpen(false);
                await logout();
              }}
              className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
