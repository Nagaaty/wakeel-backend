import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { subscriptionsAPI } from '../../services/api';

export const fetchPlans = createAsyncThunk('subs/plans', async (_, { rejectWithValue }) => {
  try { const d: any = await subscriptionsAPI.plans(); return d.plans || d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const fetchStatus = createAsyncThunk('subs/status', async (_, { rejectWithValue }) => {
  try { return await subscriptionsAPI.status(); }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const subscribe = createAsyncThunk('subs/subscribe', async (data: any, { rejectWithValue }) => {
  try { return await subscriptionsAPI.subscribe(data); }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const cancelSub = createAsyncThunk('subs/cancel', async (_, { rejectWithValue }) => {
  try { return await subscriptionsAPI.cancel(); }
  catch (e: any) { return rejectWithValue(e.message); }
});

const subsSlice = createSlice({
  name: 'subscriptions',
  initialState: {
    plans:   [] as any[],
    status:  null as any,
    loading: false,
    error:   null as string | null,
  },
  reducers: {},
  extraReducers: b => {
    b.addCase(fetchPlans.pending,    s     => { s.loading = true; })
     .addCase(fetchPlans.fulfilled,  (s,a) => { s.loading = false; s.plans = a.payload; })
     .addCase(fetchPlans.rejected,   (s,a) => { s.loading = false; s.error = a.payload as string; })
     .addCase(fetchStatus.fulfilled, (s,a) => { s.status = a.payload; })
     .addCase(subscribe.fulfilled,   (s,a) => { s.status = a.payload; });
  },
});

export const selPlans   = (s: any) => s.subscriptions.plans;
export const selSubStat = (s: any) => s.subscriptions.status;
export const selSubLoad = (s: any) => s.subscriptions.loading;

export default subsSlice.reducer;
