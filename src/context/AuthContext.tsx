import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { handleFirestoreError, OperationType, formatAuthError } from '../lib/firestoreErrors';

export interface UserProfileData {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfileData | null;
  loading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  openLoginModal: () => void;
  openSignupModal: () => void;
  closeAuthModal: () => void;
  loginWithGoogle: () => Promise<boolean>;
  loginWithEmail: (email: string, pass: string) => Promise<boolean>;
  signupWithEmail: (email: string, pass: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  const openLoginModal = () => {
    setAuthError(null);
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const openSignupModal = () => {
    setAuthError(null);
    setAuthModalMode('signup');
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthError(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  // Sync profile document in Firestore
  const syncUserProfile = async (firebaseUser: User) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const path = `users/${firebaseUser.uid}`;
    try {
      const snap = await getDoc(userDocRef);
      const now = new Date().toISOString();
      if (!snap.exists()) {
        const newProfile: UserProfileData = {
          userId: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL || '',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      } else {
        const existing = snap.data() as UserProfileData;
        setUserProfile(existing);
      }
    } catch (err: any) {
      console.warn('Could not sync user profile in Firestore:', err);
      // Non-fatal if offline
    }
  };

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await syncUserProfile(currentUser);
        setLoading(false);
      } else {
        try {
          const anon = await signInAnonymously(auth);
          setUser(anon.user);
          await syncUserProfile(anon.user);
        } catch (anonErr) {
          console.warn('Anonymous auth note:', anonErr);
          setUser(null);
          setUserProfile(null);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await syncUserProfile(result.user);
        closeAuthModal();
        return true;
      }
      return false;
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      return false;
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
      if (result.user) {
        await syncUserProfile(result.user);
        closeAuthModal();
        return true;
      }
      return false;
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      return false;
    }
  };

  const signupWithEmail = async (email: string, pass: string, name?: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (result.user) {
        if (name && name.trim()) {
          try {
            await updateProfile(result.user, { displayName: name.trim() });
          } catch (e) {
            console.warn('Could not set displayName on Firebase user:', e);
          }
        }
        await syncUserProfile(result.user);
        closeAuthModal();
        return true;
      }
      return false;
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      authError,
      isAuthModalOpen,
      authModalMode,
      openLoginModal,
      openSignupModal,
      closeAuthModal,
      loginWithGoogle,
      loginWithEmail,
      signupWithEmail,
      logout,
      clearAuthError,
    }),
    [user, userProfile, loading, authError, isAuthModalOpen, authModalMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
