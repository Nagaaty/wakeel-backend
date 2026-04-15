import axios from 'axios';
import { storage } from '../utils/storage';
import { getConnectivityStatus } from '../utils/network';

const BASE_URL = 'https://wakeel-api.onrender.com';

// Standard API — 90s timeout to survive Render free-tier cold starts
const api = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 90000 });

// Wake-up ping — lightweight call to /health so the server is warm before login
// Call this on app mount; resolve silently on any response (even error means server is alive)
export async function wakeServer(): Promise<void> {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 90000 });
  } catch {
    // Ignore — even a non-200 means the server responded (cold start done)
  }
}

// Reset session timer on every API call (proves user is active)
let _resetFn: (() => void) | null = null;
export function setSessionResetFn(fn: () => void) { _resetFn = fn; }

api.interceptors.request.use(async cfg => {
  _resetFn?.();
  const token = await storage.get('wakeel_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res  => res.data,
  async err => {
    if (err.response?.status === 401) {
      storage.multiRemove(['wakeel_token', 'wakeel_user']);
    }

    // ERR_NETWORK can mean: (a) truly offline, or (b) Render server refusing connection (cold start)
    // Distinguish using NetInfo: if device has internet, it's a server issue (cold-start), not offline.
    if (!err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error')) {
      try {
        const status = await getConnectivityStatus();
        if (status !== 'offline') {
          // Device has internet — server is down/cold-starting
          const warmingErr = new Error('The server is warming up. Please wait a moment and try again.');
          (warmingErr as any).isWarming = true;
          return Promise.reject(warmingErr);
        }
      } catch {}
      // Fall through: truly offline
      const offlineErr = new Error('offline');
      (offlineErr as any).isOffline = true;
      return Promise.reject(offlineErr);
    }

    // Server cold-start timeout (Render free tier)
    if (!err.response && err.code === 'ECONNABORTED') {
      const warmingErr = new Error(
        'The server is warming up (cold start). Please wait a moment and try again.'
      );
      (warmingErr as any).isWarming = true;
      return Promise.reject(warmingErr);
    }

    return Promise.reject(err.response?.data || err);
  }
);

export const authAPI = {
  register:       (data: any) => api.post('/auth/register', data),
  login:          (data: any) => api.post('/auth/login', data),
  me:             ()          => api.get('/auth/me'),
  update:         (data: any) => api.patch('/auth/me', data),
  changePassword: (data: any) => api.post('/auth/change-password', data),
  forgotPassword: (data: any) => api.post('/auth/forgot-password', data),
  resetPassword:  (data: any) => api.post('/auth/reset-password', data),
  sendOtp:        (data: any) => api.post('/auth/send-otp', data),
  verifyOtp:      (data: any) => api.post('/auth/verify-otp', data),
  sendOtpPublic:  (data: any) => api.post('/auth/send-otp-public', data),
  verifyOtpPublic:(data: any) => api.post('/auth/verify-otp-public', data),
  logout:         ()          => api.post('/auth/logout'),
  updateProfile:  (data: any) => api.patch('/auth/me', data),
  deleteAccount:  ()          => api.delete('/auth/me'),
};

export const lawyersAPI = {
  list:            (params?: any) => api.get('/lawyers', { params }),
  get:             (id: string | number)   => api.get(`/lawyers/${id}`),
  getAvailability: (id: number, date: string) => api.get(`/lawyers/${id}/availability`, { params: { date } }),
  getMyProfile:    ()             => api.get('/lawyers/me/profile'),
  saveProfile:     (data: any)    => api.post('/lawyers/me/profile', data),
  getRawAvailability: ()          => api.get('/lawyers/me/availability'),
  saveAvailability:(schedule: any)=> api.post('/lawyers/me/availability', { schedule }),
  getOverrides:    ()             => api.get('/lawyers/me/overrides'),
  saveOverrides:   (data: any)    => api.post('/lawyers/me/overrides', data),
  getMyReviews:    ()             => api.get('/lawyers/me/reviews'),
  getMyClients:    ()             => api.get('/lawyers/me/clients'),
  review:          (id: number, data: any) => api.post(`/lawyers/${id}/review`, data),
};

export const bookingsAPI = {
  create: (data: any)              => api.post('/bookings', data),
  list:   (params?: any)           => api.get('/bookings', { params }),
  get:    (id: string | number)             => api.get(`/bookings/${id}`),
  update: (id: number, data: any)  => api.patch(`/bookings/${id}/status`, data),
  cancel: (id: number, data?: any) => api.post(`/bookings/${id}/cancel`, data),
  markNoShow: (id: string | number) => api.patch(`/bookings/${id}/no-show`),
};

export const paymentsAPI = {
  initiate: (data: any) => api.post('/payments/initiate', data),
  confirm:  (data: any) => api.post('/payments/confirm', data),
  history:  ()          => api.get('/payments/history'),
  refund:   (data: any) => api.post('/payments/refund', data),
};

export const messagesAPI = {
  getConversations:  ()                         => api.get('/messages/conversations'),
  getMessages:       (convId: string | number)           => api.get(`/messages/conversations/${convId}`),
  sendMessage:       (convId: number, content: string) => api.post(`/messages/conversations/${convId}`, { content }),
  createConversation:(lawyerId: string | number)         => api.post('/messages/conversations', { lawyerId }),
  unreadCount:       ()                         => api.get('/messages/unread-count'),
};

export const notificationsAPI = {
  getAll:      ()              => api.get('/notifications'),
  markRead:    (id: string | number)    => api.patch(`/notifications/${id}/read`),
  markAllRead: ()              => api.patch('/notifications/read-all'),
  unreadCount: ()              => api.get('/notifications/unread-count'),
};

export const favoritesAPI = {
  list:   ()                 => api.get('/favorites'),
  toggle: (lawyerId: string | number) => api.post(`/favorites/${lawyerId}/toggle`),
  check:  (lawyerId: string | number) => api.get(`/favorites/check/${lawyerId}`),
};

export const broadcastAPI = {
  list:   ()                               => api.get('/broadcast'),
  create: (data: any)                      => api.post('/broadcast', data),
  bid:    (id: number, data: any)          => api.post(`/broadcast/${id}/bid`, data),
  accept: (id: number, bidId: number)      => api.post(`/broadcast/${id}/accept/${bidId}`),
};

export const contentAPI = {
  faq:        ()                  => api.get('/content/faq'),
  glossary:   (params?: any)      => api.get('/content/glossary', { params }),
  blog:       (params?: any)      => api.get('/content/blog', { params }),
  contracts:  (params?: any)      => api.get('/content/contracts', { params }),
  leaderboard:(period?: string)   => api.get('/content/leaderboard', { params: { period } }),
};

export const courtDatesAPI = {
  list:   ()           => api.get('/court-dates'),
  create: (data: any)  => api.post('/court-dates', data),
  delete: (id: string | number) => api.delete(`/court-dates/${id}`),
};

export const uploadAPI = {
  upload: (data: FormData) => api.post('/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  multiple: (data: FormData) => api.post('/upload/multiple', data, { headers: { 'Content-Type': 'multipart/form-data' } })
};


export const vaultAPI = {
  list:   ()           => api.get('/vault'),
  upload: (data: any)  => api.post('/vault', data),
  delete: (id: string | number) => api.delete(`/vault/${id}`),
};

export const invoicesAPI = {
  create: (bookingId: string | number) => api.post('/invoices', { bookingId }),
  list:   ()                  => api.get('/invoices'),
  get:    (id: string | number)        => api.get(`/invoices/${id}`),
};

export const supportAPI = {
  createTicket:  (data: any)                      => api.post('/support/tickets', data),
  myTickets:     ()                               => api.get('/support/tickets/mine'),
  getTickets:    (params?: any)                   => api.get('/support/tickets', { params }),
  getTicket:     (id: string | number)            => api.get(`/support/tickets/${id}`),
  reply:         (id: number, d: any)             => api.post(`/support/tickets/${id}/messages`, d),
  resolveTicket: (id: number, reply: string)      => api.patch(`/support/tickets/${id}/resolve`, { reply }),
};

export const aiAPI = {
  chat:       (messages: any[], system?: string) => api.post('/ai/chat', { messages, system }),
  analyzeCase:(caseText: string)  => api.post('/ai/analyze-case', { caseText }),
  analyzeDoc: (data: any)         => api.post('/ai/analyze-doc', data),
  matchLawyer:(data: any)         => api.post('/ai/match-lawyer', data),
};

export const videoAPI = {
  createRoom: (bookingId: string | number)                       => api.post('/video/room', { bookingId }),
  endRoom:    (bookingId: number, durationMin: number)  => api.post('/video/end', { bookingId, durationMin }),
  getToken:   (bookingId: string | number)                       => api.get(`/video/token/${bookingId}`),
};

export const referralAPI = {
  myCode: ()              => api.get('/referral/my-code'),
  apply:  (code: string)  => api.post('/referral/apply', { code }),
};

export const usersAPI = { 
  online: () => api.get('/users/online'),
  get: (id: string | number) => api.get(`/users/${id}`)
};
export const adminAPI = {
  stats:          ()                           => api.get('/admin/stats'),
  users:          (params?: any)               => api.get('/admin/users', { params }),
  banUser:        (id: string, data: any)      => api.post(`/admin/users/${id}/ban`, data),
  auditLogs:      (params?: any)               => api.get('/admin/audit-logs', { params }),
  pendingLawyers: ()                           => api.get('/verification/pending'),
  verifyLawyer:   (id: string, data: any)      => api.post(`/verification/${id}`, data),
};

// ─── Forum API ───────────────────────────────────────────────────────────────
export const forumAPI = {
  getQuestions: (cat?: string, search?: string) => 
    api.get('/forum/questions', { params: { cat, search } }),
  createQuestion: (data: { question: string; category: string; anonymous?: boolean }) => 
    api.post('/forum/questions', data),
  getAnswers: (id: string | number) => 
    api.get(`/forum/questions/${id}/answers`),
  createAnswer: (id: string | number, answer: string) => 
    api.post(`/forum/questions/${id}/answers`, { answer }),
  likeQuestion: (id: string | number) =>
    api.post(`/forum/questions/${id}/like`),
};

export const analyticsAPI = {
  admin:  () => api.get('/analytics/admin'),
  lawyer: () => api.get('/analytics/lawyer'),
};
export const jobsAPI = {
  list:  (params?: any)              => api.get('/jobs', { params }),
  get:   (id: string | number)       => api.get(`/jobs/${id}`),
  apply: (id: number, data: any)     => api.post(`/jobs/${id}/apply`, data),
};
export const subscriptionsAPI = {
  plans:     ()        => api.get('/subscriptions/plans'),
  status:    ()        => api.get('/subscriptions/status'),
  subscribe: (d: any)  => api.post('/subscriptions/subscribe', d),
  cancel:    ()        => api.post('/subscriptions/cancel'),
  upgrade:   (d: any)  => api.post('/subscriptions/upgrade', d),
  checkLimit:()        => api.get('/subscriptions/check-limit'),
};
export const promosAPI = {
  validate: (code: string)               => api.post('/promos/validate', { code }),
  apply:    (code: string, bookingId: number) => api.post('/promos/apply', { code, bookingId }),
  list:     (params?: any)               => api.get('/promos', { params }),
  create:   (data: any)                  => api.post('/promos', data),
  toggle:   (id: string, active: boolean)=> api.patch(`/promos/${id}/toggle`, { active }),
  delete:   (id: string)                 => api.delete(`/promos/${id}`),
};



export const installmentsAPI = {
  create: (data: any) => api.post('/installments', data),
  list:   ()          => api.get('/installments'),
};

export const payoutsAPI = {
  request: (data: any)          => api.post('/payouts/payout-request', data),
  list:    ()                   => api.get('/payouts/payout-requests'),
  update:  (id: number, d: any) => api.patch(`/payouts/payout-requests/${id}`, d),
};

export const pushAPI = {
  register: (token: string, platform: string) => api.post('/push/register', { token, platform }),
  remove:   (token: string)                    => api.delete('/push/register', { data: { token } }),
};

export const verificationAPI = {
  pendingLawyers:   ()             => api.get('/verification/pending'),
  approve:          (id: string | number)   => api.post(`/verification/${id}/approve`),
  reject:           (id: number, data: any) => api.post(`/verification/${id}/reject`, data),
  setAvailability:  (data: any)    => api.patch('/verification/availability', data),
  setServicePrices: (data: any)    => api.patch('/verification/service-prices', data),
  availableNow:     ()             => api.get('/verification/available-now'),
};


export const docVaultAPI = {
  list:     (params?: any)           => api.get('/document-vault', { params }),
  upload:   (data: FormData)         => api.post('/document-vault/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  get:      (id: string | number)    => api.get(`/document-vault/${id}`),
  delete:   (id: string | number)    => api.delete(`/document-vault/${id}`),
  share:    (id: number, data: any)  => api.post(`/document-vault/${id}/share`, data),
  download: (id: string | number)    => api.get(`/document-vault/${id}/download`),
};

export default api;
