export type RequestRoute = "Auto" | "Booking&Access" | "Emergency" | "TechSupport" | "BrandTone";

export interface UserRequest {
  requestDescription: string;
  location?: string;
  routePreference?: RequestRoute;
  smartAssistEnabled: boolean;
  mediaAttachments?: MediaAttachment[];
}

export interface MediaAttachment {
  data: string; // base64 data URL
  fileName: string;
  mimeType: string;
  description?: string;
}

export interface MediaSearchResult {
  id: string;
  thumbnailData: string | null;
  fileName: string;
  mimeType: string;
  userDescription: string | null;
  aiDescription: string | null;
  category: string | null;
  location: string | null;
  uploaderName: string;
  createdAt: string;
  similarity: number;
  isPartialMatch: boolean;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}
