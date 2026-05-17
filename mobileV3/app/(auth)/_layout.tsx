import { Stack, Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { selLoggedIn, selIsLawyer, selIsAdmin } from '../../src/store/slices/authSlice';

export default function AuthLayout() {
  const isLoggedIn = useSelector(selLoggedIn);
  const isLawyer = useSelector(selIsLawyer);
  const isAdmin = useSelector(selIsAdmin);

  if (isLoggedIn) {
    if (isLawyer) return <Redirect href={"/(lawyer-tabs)/" as any} />;
    if (isAdmin) return <Redirect href={"/admin/index" as any} />;
    return <Redirect href="/(tabs)" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
