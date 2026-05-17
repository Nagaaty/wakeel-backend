import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { storage } from '../utils/storage';
import { BASE_URL } from '../services/api';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${BASE_URL}/api`,
    prepareHeaders: async (headers) => {
      const token = await storage.get('wakeel_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Lawyer', 'Booking', 'Profile'],
  endpoints: (builder) => ({}),
});
