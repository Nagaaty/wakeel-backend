import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { lawyersAPI, firmsAPI } from '../../services/api';

export const fetchLawyers = createAsyncThunk('lawyers/fetchAll', async (params: any = {}, { rejectWithValue }) => {
  try { const d: any = await lawyersAPI.list(params); return d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const fetchLawyerById = createAsyncThunk('lawyers/fetchOne', async (id: string | number, { rejectWithValue }) => {
  try { return await lawyersAPI.get(id); }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const fetchFirms = createAsyncThunk('firms/fetchAll', async (params: any = {}, { rejectWithValue }) => {
  try { const d: any = await firmsAPI.list(params); return d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const fetchFirmById = createAsyncThunk('firms/fetchOne', async (id: string | number, { rejectWithValue }) => {
  try { return await firmsAPI.get(id); }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const fetchFirmLawyers = createAsyncThunk('firms/fetchLawyers', async (id: string | number, { rejectWithValue }) => {
  try { const d: any = await firmsAPI.getLawyers(id); return d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

const lawyersSlice = createSlice({
  name: 'lawyers',
  initialState: {
    items: [] as any[],
    current: null as any,
    loading: false,
    total: 0,
    error: null as string | null,
    
    // Firms state fields
    firms: [] as any[],
    firmsTotal: 0,
    firmsLoading: false,
    currentFirm: null as any,
    currentFirmLawyers: [] as any[],
  },
  reducers: {
    clearCurrent: s => { s.current = null; },
    clearCurrentFirm: s => { s.currentFirm = null; s.currentFirmLawyers = []; },
  },
  extraReducers: b => {
    b.addCase(fetchLawyers.pending,     s     => { s.loading = true; s.error = null; })
     .addCase(fetchLawyers.fulfilled,   (s,a) => { s.loading = false; s.items = a.payload.lawyers || a.payload; s.total = a.payload.total || s.items.length; })
     .addCase(fetchLawyers.rejected,    (s,a) => { s.loading = false; s.error = a.payload as string; })
     
     .addCase(fetchLawyerById.pending,  s     => { s.loading = true; })
     .addCase(fetchLawyerById.fulfilled,(s,a) => { s.loading = false; s.current = a.payload; })
     .addCase(fetchLawyerById.rejected, (s,a) => { s.loading = false; s.error = a.payload as string; })
     
     // Firms slice cases
     .addCase(fetchFirms.pending,       s     => { s.firmsLoading = true; s.error = null; })
     .addCase(fetchFirms.fulfilled,     (s,a) => { s.firmsLoading = false; s.firms = a.payload.firms || []; s.firmsTotal = a.payload.total || s.firms.length; })
     .addCase(fetchFirms.rejected,      (s,a) => { s.firmsLoading = false; s.error = a.payload as string; })
     
     .addCase(fetchFirmById.pending,     s     => { s.firmsLoading = true; })
     .addCase(fetchFirmById.fulfilled,   (s,a) => { s.firmsLoading = false; s.currentFirm = a.payload.firm; })
     .addCase(fetchFirmById.rejected,    (s,a) => { s.firmsLoading = false; s.error = a.payload as string; })
     
     .addCase(fetchFirmLawyers.pending,  s     => { s.firmsLoading = true; })
     .addCase(fetchFirmLawyers.fulfilled,(s,a) => { s.firmsLoading = false; s.currentFirmLawyers = a.payload.lawyers || []; })
     .addCase(fetchFirmLawyers.rejected, (s,a) => { s.firmsLoading = false; s.error = a.payload as string; });
  },
});

export const { clearCurrent, clearCurrentFirm } = lawyersSlice.actions;

export const selLawyers       = (s: any) => s.lawyers.items;
export const selCurrentLawyer = (s: any) => s.lawyers.current;
export const selLawyersLoad   = (s: any) => s.lawyers.loading;
export const selLawyersTotal  = (s: any) => s.lawyers.total;

// Firms selectors
export const selFirms              = (s: any) => s.lawyers.firms;
export const selFirmsLoading       = (s: any) => s.lawyers.firmsLoading;
export const selFirmsTotal         = (s: any) => s.lawyers.firmsTotal;
export const selCurrentFirm        = (s: any) => s.lawyers.currentFirm;
export const selCurrentFirmLawyers = (s: any) => s.lawyers.currentFirmLawyers;

export default lawyersSlice.reducer;
