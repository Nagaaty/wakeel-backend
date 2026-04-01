import { configureStore } from '@reduxjs/toolkit';
import authReducer          from './slices/authSlice';
import bookingsReducer      from './slices/bookingsSlice';
import lawyersReducer       from './slices/lawyersSlice';
import messagesReducer      from './slices/messagesSlice';
import subscriptionsReducer from './slices/subscriptionsSlice';

export const store = configureStore({
  reducer: {
    auth:          authReducer,
    bookings:      bookingsReducer,
    lawyers:       lawyersReducer,
    messages:      messagesReducer,
    subscriptions: subscriptionsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
