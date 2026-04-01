// Core domain types for Wakeel mobile app

export interface User {
  id:              string;
  name:            string;
  email:           string;
  phone?:          string;
  role:            'client' | 'lawyer' | 'admin';
  avatar_url?:     string;
  is_online?:      boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  bio?:            string;
  referral_code?:  string;
}

export interface LawyerProfile {
  id:                  string;
  user_id:             string;
  name:                string;
  specialization:      string;
  city:                string;
  consultation_fee:    number;
  experience_years:    number;
  bio?:                string;
  bar_number?:         string;
  avg_rating?:         number;
  total_reviews?:      number;
  wins?:               number;
  losses?:             number;
  is_verified:         boolean;
  is_online?:          boolean;
  response_time_hours? :number;
  subscription_plan?:  string;
  avatar_url?:         string;
  reviews?:            Review[];
}

export interface Booking {
  id:             string;
  client_id:      string;
  lawyer_id:      string;
  client_name:    string;
  lawyer_name:    string;
  booking_date:   string;
  start_time:     string;
  end_time?:      string;
  service_type:   'text' | 'voice' | 'video' | 'inperson' | 'document';
  fee:            number;
  status:         'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  notes?:         string;
  urgency?:       string;
}

export interface Message {
  id:              string;
  conversation_id: string;
  sender_id:       string;
  content:         string;
  read_at?:        string;
  created_at:      string;
  attachment_url?: string;
}

export interface Conversation {
  id:              string;
  client_id:       string;
  lawyer_id:       string;
  other_id:        string;
  other_name:      string;
  other_avatar?:   string;
  other_online?:   boolean;
  last_message?:   string;
  last_message_at?:string;
  unread_count?:   number;
}

export interface Notification {
  id:         string;
  user_id:    string;
  type:       string;
  title:      string;
  body:       string;
  link?:      string;
  read_at?:   string;
  created_at: string;
}

export interface Review {
  id:          string;
  lawyer_id:   string;
  client_id:   string;
  client_name: string;
  rating:      number;
  comment?:    string;
  outcome?:    string;
  created_at:  string;
}

export interface TimeSlot {
  time:      string;
  available: boolean;
}

export interface BroadcastRequest {
  id:           string;
  client_id:    string;
  client_name?: string;
  title:        string;
  category:     string;
  description?: string;
  budget?:      string;
  urgency:      'urgent' | 'normal' | 'flexible';
  status:       'active' | 'closed' | 'expired';
  bid_count?:   number;
  my_bid_status?: 'pending' | 'accepted' | 'rejected';
  bids?:        BroadcastBid[];
  created_at:   string;
}

export interface BroadcastBid {
  id:          string;
  request_id:  string;
  lawyer_id:   string;
  lawyer_name: string;
  specialization?: string;
  avg_rating?: number;
  price:       number;
  note?:       string;
  status:      'pending' | 'accepted' | 'rejected';
  created_at:  string;
}

export interface Job {
  id:           string;
  title:        string;
  company:      string;
  location:     string;
  type:         string;
  salary_min?:  number;
  salary_max?:  number;
  description?: string;
  requirements?: string[] | string;
  urgent:       boolean;
  created_at:   string;
}

export interface CourtDate {
  id:       string;
  user_id:  string;
  title:    string;
  court?:   string;
  date:     string;
  time?:    string;
  type:     'hearing' | 'deadline' | 'meeting';
  reminder: boolean;
  notes?:   string;
}

export interface SupportTicket {
  id:          string;
  user_id:     string;
  user_name:   string;
  user_email:  string;
  subject:     string;
  body:        string;
  category:    string;
  priority:    string;
  status:      'open' | 'in_progress' | 'resolved' | 'closed';
  created_at:  string;
}
