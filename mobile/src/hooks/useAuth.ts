import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import {
  selUser, selToken, selLoading, selError, selLoggedIn,
  selIsLawyer, selIsClient, selIsAdmin,
  logoutUser, clearError, forceLogout
} from '../store/slices/authSlice';
import { AppDispatch } from '../store';
import { router } from 'expo-router';
import { disconnectSocket } from '../utils/socket';
import { setBadgeCount } from '../utils/notifications';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const user      = useSelector(selUser);
  const token     = useSelector(selToken);
  const loading   = useSelector(selLoading);
  const error     = useSelector(selError);
  const isLoggedIn= useSelector(selLoggedIn);
  const isLawyer  = useSelector(selIsLawyer);
  const isClient  = useSelector(selIsClient);
  const isAdmin   = useSelector(selIsAdmin);

  const logout = useCallback(() => {
    dispatch(forceLogout());
    disconnectSocket();
    setBadgeCount(0).catch(() => {});
    
    // Slight delay to allow Redux to flush before unmounting navigation structure
    setTimeout(() => {
        router.replace('/(auth)/login');
    }, 100);
  }, [dispatch]);

  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Dashboard path based on role
  const dashPath = isAdmin
    ? '/admin/index'
    : isLawyer
    ? '/lawyer/dashboard'
    : '/(tabs)';

  return {
    user,
    token,
    loading,
    error,
    isLoggedIn,
    isLawyer,
    isClient,
    isAdmin,
    logout,
    clearAuthError,
    dashPath,
    // Convenience
    initials: user?.name
      ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
      : 'U',
  };
}
