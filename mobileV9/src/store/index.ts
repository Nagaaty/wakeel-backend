import { configureStore } from '@reduxjs/toolkit';
import authReducer          from '../features/auth/authSlice';
import bookingsReducer      from '../features/consultations/bookingsSlice';
import lawyersReducer       from '../features/lawyers/lawyersSlice';
import messagesReducer      from '../features/messages/messagesSlice';
import subscriptionsReducer from '../features/subscriptions/subscriptionsSlice';

import { apiSlice } from './apiSlice';

export const store = configureStore({
  reducer: {
    auth:          authReducer,
    bookings:      bookingsReducer,
    lawyers:       lawyersReducer,
    messages:      messagesReducer,
    subscriptions: subscriptionsReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(apiSlice.middleware),
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
