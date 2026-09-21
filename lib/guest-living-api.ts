export interface GuestUpdateItem {
  id: string;
  category: string;
  title: string;
  body: string;
  importance: "normal" | "important";
  requireAcknowledgement: boolean;
  publishedAt: string;
  seenAt: string | null;
  acknowledgedAt: string | null;
}

export interface GuestLivingData {
  attire: string | null;
  arrivalParking: string | null;
  transportation: string | null;
  whatToBring: string | null;
  importantDetails: string | null;
  updates: GuestUpdateItem[];
  isArchived: boolean;
}

export interface GuestLivingResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
}
