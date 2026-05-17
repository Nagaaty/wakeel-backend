// v9 — Client profile page removed from client experience.
// Redirects to My Consults as the user's home.
import { Redirect } from 'expo-router';
export default function ProfileRedirect() {
  return <Redirect href="/(tabs)/my-requests" />;
}
