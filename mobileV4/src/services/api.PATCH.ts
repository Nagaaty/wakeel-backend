// ─── Wakeel — Mobile Patch: API Service Additions ────────────────────────────
// File: mobile/src/services/api.ts
//
// Add the two methods below to your existing `lawyersAPI` object (around
// line 86-99 in api.ts). The rest of the file stays unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/*
INSIDE export const lawyersAPI = { ... }:
ADD these two lines (anywhere; recommended right after saveOverrides):

  getServiceAvailability:  ()           => api.get('/lawyers/me/service-availability'),
  saveServiceAvailability: (data: any)  => api.post('/lawyers/me/service-availability', data),
*/


// Type definitions you can paste at the top of api.ts (or a types file):

/**
 * The five consultation types Wakeel supports. The booking screen and the
 * lawyer schedule screen must agree on these strings. Backend stores them
 * lowercase; the bookings.type column stores uppercase variants.
 */
export type ConsultationType = 'video' | 'text' | 'phone' | 'inperson' | 'document';

export interface ServiceAvailability {
  /** Per-weekday default. Keys are 0..6 (Sun..Sat) as STRINGS. */
  defaults:  Record<string, ConsultationType[]>;
  /** Date-specific overrides. service_types null = use weekly default. */
  overrides: Array<{
    override_date: string;          // YYYY-MM-DD
    service_types: ConsultationType[] | null;
  }>;
}

export interface AvailabilityResponse {
  slots: Array<{ time: string; available: boolean }>;
  enabled_services: ConsultationType[];
  is_off: boolean;
}
