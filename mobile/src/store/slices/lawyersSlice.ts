import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { lawyersAPI } from '../../services/api';

export const fetchLawyers = createAsyncThunk('lawyers/fetchAll', async (params: any = {}, { rejectWithValue }) => {
  try { const d: any = await lawyersAPI.list(params); return d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const fetchLawyerById = createAsyncThunk('lawyers/fetchOne', async (id: number, { rejectWithValue }) => {
  try { return await lawyersAPI.get(id); }
  catch (e: any) { return rejectWithValue(e.message); }
});

const lawyersSlice = createSlice({
  name: 'lawyers',
  initialState: { items: [] as any[], current: null as any, loading: false, total: 0, error: null as string | null },
  reducers: { clearCurrent: s => { s.current = null; } },
  extraReducers: b => {
    b.addCase(fetchLawyers.pending,     s     => { s.loading = true; s.error = null; })
     .addCase(fetchLawyers.fulfilled,   (s,a) => { s.loading = false; s.items = a.payload.lawyers || a.payload; s.total = a.payload.total || s.items.length; })
     .addCase(fetchLawyers.rejected,    (s,a) => { s.loading = false; s.error = a.payload as string; })
     .addCase(fetchLawyerById.pending,  s     => { s.loading = true; })
     .addCase(fetchLawyerById.fulfilled,(s,a) => { s.loading = false; s.current = a.payload; })
     .addCase(fetchLawyerById.rejected, (s,a) => { s.loading = false; s.error = a.payload as string; });
  },
});

export const { clearCurrent } = lawyersSlice.actions;
export const selLawyers       = (s: any) => s.lawyers.items;
export const selCurrentLawyer = (s: any) => s.lawyers.current;
export const selLawyersLoad   = (s: any) => s.lawyers.loading;
export const selLawyersTotal  = (s: any) => s.lawyers.total;

export default lawyersSlice.reducer;
