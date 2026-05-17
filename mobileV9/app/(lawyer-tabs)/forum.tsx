// v9 — Forum removed. Redirects to lawyer dashboard.
import { Redirect } from 'expo-router';
export default function LawyerForumRedirect() {
  return <Redirect href="/(lawyer-tabs)/" />;
}
