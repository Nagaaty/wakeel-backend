import { useEffect } from 'react';
import io from 'socket.io-client';
import { useAuth } from './useAuth';
const WS_URL = 'https://wakeel-api.onrender.com';
let socket: any = null;

export function useForumSocket({ onLike, onComment, onNewPost, onShare }: {
  onLike?: (data: { postId: number, likes_count: number, liked: boolean }) => void;
  onComment?: (data: { postId: number, answer: any, isReply: boolean }) => void;
  onNewPost?: (data: { post: any }) => void;
  onShare?: (data: { postId: number, shares_count: number }) => void;
}) {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    if (!socket) {
      socket = io(WS_URL, {
        auth: { token },
        transports: ['websocket'], // Force WebSocket (bypasses polling issues)
      });
      
      socket.on('connect', () => console.log('🟢 Forum WebSocket Connected'));
      socket.on('disconnect', () => console.log('🔴 Forum WebSocket Disconnected'));
    }

    if (onLike) socket.on('forum:like', onLike);
    if (onComment) socket.on('forum:comment', onComment);
    if (onNewPost) socket.on('forum:new_post', onNewPost);
    if (onShare) socket.on('forum:share', onShare);

    return () => {
      if (socket) {
        if (onLike) socket.off('forum:like', onLike);
        if (onComment) socket.off('forum:comment', onComment);
        if (onNewPost) socket.off('forum:new_post', onNewPost);
        if (onShare) socket.off('forum:share', onShare);
      }
    };
  }, [token, onLike, onComment, onNewPost, onShare]);

  return socket;
}
