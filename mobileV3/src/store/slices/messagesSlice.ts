import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { messagesAPI } from '../../services/api';

export const fetchConvos = createAsyncThunk('msgs/convos', async (_, { rejectWithValue }) => {
  try { const d: any = await messagesAPI.getConversations(); return d.conversations || d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const fetchThread = createAsyncThunk('msgs/thread', async (convId: number, { rejectWithValue }) => {
  try { const d: any = await messagesAPI.getMessages(convId); return d.messages || d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

export const sendMsg = createAsyncThunk('msgs/send', async ({ convId, content }: any, { rejectWithValue }) => {
  try { const d: any = await messagesAPI.sendMessage(convId, content); return d.message || d; }
  catch (e: any) { return rejectWithValue(e.message); }
});

const messagesSlice = createSlice({
  name: 'messages',
  initialState: { convos: [] as any[], thread: [] as any[], loading: false, error: null as string | null },
  reducers: {
    addMessage: (s, { payload }) => { s.thread = [...s.thread, payload]; },
  },
  extraReducers: b => {
    b.addCase(fetchConvos.pending,   s     => { s.loading = true; })
     .addCase(fetchConvos.fulfilled, (s,a) => { s.loading = false; s.convos = a.payload; })
     .addCase(fetchConvos.rejected,  (s,a) => { s.loading = false; s.error = a.payload as string; })
     .addCase(fetchThread.fulfilled, (s,a) => { s.thread = a.payload; })
     .addCase(sendMsg.fulfilled,     (s,a) => { if (a.payload) s.thread = [...s.thread, a.payload]; });
  },
});

export const { addMessage } = messagesSlice.actions;
export const selConvos  = (s: any) => s.messages.convos;
export const selThread  = (s: any) => s.messages.thread;
export const selMLoading= (s: any) => s.messages.loading;

export default messagesSlice.reducer;
