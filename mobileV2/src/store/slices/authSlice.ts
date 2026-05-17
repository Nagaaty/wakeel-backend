import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storage } from '../../utils/storage';
import { authAPI } from '../../services/api';

const persist = async (token: string, user: any) => {
  await storage.set('wakeel_token', token);
  await storage.setUser(user);
};

export const login = createAsyncThunk('auth/login', async (creds: any, { rejectWithValue }) => {
  try {
    const d: any = await authAPI.login(creds);
    await persist(d.token, d.user);
    return d;
  } catch (e: any) {
    if (e?.isWarming) return rejectWithValue('⏳ Server is starting up — please wait a moment and try again.');
    if (e?.isOffline) return rejectWithValue('📵 No internet connection. Please check your network.');
    return rejectWithValue(e.message || 'خطأ في تسجيل الدخول');
  }
});

export const register = createAsyncThunk('auth/register', async (data: any, { rejectWithValue }) => {
  try {
    const d: any = await authAPI.register(data);
    await persist(d.token, d.user);
    return d;
  } catch (e: any) {
    if (e?.isWarming) return rejectWithValue('⏳ Server is starting up — please wait a moment and try again.');
    if (e?.isOffline) return rejectWithValue('📵 No internet connection. Please check your network.');
    return rejectWithValue(e.message || 'خطأ في التسجيل');
  }
});

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try { return await authAPI.me(); }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await authAPI.logout().catch(() => {});
  await storage.multiRemove(['wakeel_token', 'wakeel_user']);
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:    null as any,
    token:   null as string | null,
    loading: false,
    error:   null as string | null,
  },
  reducers: {
    setUser:     (s, { payload }) => { s.user = { ...s.user, ...payload }; },
    clearError:  (s)              => { s.error = null; },
    forceLogout: (s)              => {
      s.user = null; s.token = null;
      storage.multiRemove(['wakeel_token', 'wakeel_user']).catch(() => {});
    },
  },
  extraReducers: b => {
    b.addCase(login.pending,      s     => { s.loading = true;  s.error = null; })
     .addCase(login.fulfilled,    (s,a) => { s.loading = false; s.user = a.payload.user; s.token = a.payload.token; })
     .addCase(login.rejected,     (s,a) => { s.loading = false; s.error = a.payload as string; })
     .addCase(register.pending,   s     => { s.loading = true;  s.error = null; })
     .addCase(register.fulfilled, (s,a) => { s.loading = false; s.user = a.payload.user; s.token = a.payload.token; })
     .addCase(register.rejected,  (s,a) => { s.loading = false; s.error = a.payload as string; })
     .addCase(fetchMe.fulfilled,  (s,a) => { s.user = a.payload; })
     .addCase(fetchMe.rejected,   s     => { s.user = null; s.token = null; })
     .addCase(logoutUser.fulfilled, s   => { s.user = null; s.token = null; });
  },
});

export const { setUser, clearError, forceLogout } = authSlice.actions;

export const selUser     = (s: any) => s.auth.user;
export const selToken    = (s: any) => s.auth.token;
export const selLoading  = (s: any) => s.auth.loading;
export const selError    = (s: any) => s.auth.error;
export const selLoggedIn = (s: any) => !!s.auth.token && !!s.auth.user;
export const selIsLawyer = (s: any) => s.auth.user?.role === 'lawyer';
export const selIsClient = (s: any) => s.auth.user?.role === 'client';
export const selIsAdmin  = (s: any) => s.auth.user?.role === 'admin';

export default authSlice.reducer;
