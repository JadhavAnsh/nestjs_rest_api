export interface AIModel {
  title: string;
  description: string;
  icon_url: string;
  redirect_url: string;
  ai_model: 'free' | 'freemium' | 'premium';
  tags: string[];
  filter_tags: ('Popular' | 'Trending' | 'Underrated')[];
  type: string;
  origin: string;
}

export interface ScrapingResult {
  data: AIModel[];
  metadata: {
    totalScraped: number;
    sources: string[];
    timestamp: string;
    success: boolean;
    errors?: string[];
  };
}
