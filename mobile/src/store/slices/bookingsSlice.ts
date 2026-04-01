import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { bookingsAPI } from '../../services/api';

export const fetchBookings = createAsyncThunk('bookings/list', async (params: any = {}, { rejectWithValue }) => {
  try { const d: any = await bookingsAPI.list(params); return d.bookings || d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const createBooking = createAsyncThunk('bookings/create', async (data: any, { rejectWithValue }) => {
  try { return await bookingsAPI.create(data); }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const updateBooking = createAsyncThunk('bookings/update', async ({ id, status }: any, { rejectWithValue }) => {
  try { const d: any = await bookingsAPI.update(id, { status }); return d.booking || d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState: { items: [] as any[], loading: false, error: null as string | null },
  reducers: {
    clearBookingError: s => { s.error = null; },
  },
  extraReducers: b => {
    b.addCase(fetchBookings.pending,   s     => { s.loading = true; s.error = null; })
     .addCase(fetchBookings.fulfilled, (s,a) => { s.loading = false; s.items = a.payload; })
     .addCase(fetchBookings.rejected,  (s,a) => { s.loading = false; s.error = a.payload as string; })
     .addCase(createBooking.fulfilled, (s,a) => { if ((a.payload as any)?.booking) s.items = [(a.payload as any).booking, ...s.items]; })
     .addCase(updateBooking.fulfilled, (s,a) => { s.items = s.items.map((b: any) => b.id === (a.payload as any)?.id ? a.payload : b); });
  },
});

export const { clearBookingError } = bookingsSlice.actions;
export const selBookings  = (s: any) => s.bookings.items;
export const selBLoading  = (s: any) => s.bookings.loading;
export const selBError    = (s: any) => s.bookings.error;

export default bookingsSlice.reducer;
