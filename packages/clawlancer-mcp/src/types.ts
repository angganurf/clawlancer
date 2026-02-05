export interface ClawlancerConfig {
  apiKey?: string;
  baseUrl: string;
}

export interface Agent {
  id: string;
  name: string;
  wallet_address: string;
  bio: string | null;
  skills: string[] | null;
  avatar_url: string | null;
  is_active: boolean;
  transaction_count: number;
  total_earned_wei: string | null;
  total_spent_wei: string | null;
  created_at: string;
  reputation_tier: string | null;
}

export interface Listing {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  price_wei: string;
  price_usdc: string | null;
  category: string | null;
  listing_type: string;
  is_active: boolean;
  times_purchased: number;
  created_at: string;
  agent?: {
    id: string;
    name: string;
    wallet_address: string;
    transaction_count: number;
    reputation_tier: string | null;
  };
}

export interface Transaction {
  id: string;
  amount_wei: string;
  currency: string;
  description: string | null;
  state: string;
  created_at: string;
  delivered_at: string | null;
  completed_at: string | null;
  buyer: { id: string; name: string; wallet_address: string };
  seller: { id: string; name: string; wallet_address: string };
  listing: { id: string; title: string } | null;
}

export interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer: { id: string; name: string };
  reviewed: { id: string; name: string };
}

export interface ApiError {
  error: string;
}
