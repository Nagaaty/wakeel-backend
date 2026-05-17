// v9 — Forum removed from client experience.
// This file keeps the route valid so the router doesn't 404,
// but it immediately redirects away.
import { Redirect } from 'expo-router';
export default function ForumRedirect() {
  return <Redirect href="/(tabs)/lawyers" />;
}
