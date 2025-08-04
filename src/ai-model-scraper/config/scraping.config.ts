import { registerAs } from '@nestjs/config';

export interface ScrapingSource {
  name: string;
  url: string;
  enabled: boolean;
  selectors: {
    container: string;
    title: string;
    description: string;
    icon: string;
    link: string;
    tags?: string;
    type?: string;
    model?: string;
  };
  waitForSelector?: string;
  pagination?: {
    nextButton?: string;
    maxPages?: number;
  };
}

export default registerAs('scraping', () => ({
  outputPath: process.env.SCRAPING_OUTPUT_PATH || './ai-models.json',
  puppeteerOptions: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
  },
  retryOptions: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
  },
  sources: [
    {
      name: 'FutureTools.io',
      url: 'https://www.futuretools.io',
      enabled: true,
      selectors: {
        container: '.tool-card, .product-card',
        title: 'h3, .tool-title, .product-title',
        description: '.tool-description, .product-description, p',
        icon: 'img',
        link: 'a',
        tags: '.tag, .category',
        type: '.tool-type, .category-name',
      },
      waitForSelector: '.tool-card, .product-card',
    },
    // {
    //   name: "There's An AI For That",
    //   url: 'https://theresanaiforthat.com/ai/',
    //   enabled: true,
    //   selectors: {
    //     container: '.ai-tool, .tool-item',
    //     title: 'h2, .tool-name',
    //     description: '.tool-desc, .description',
    //     icon: '.tool-logo img, .icon img',
    //     link: 'a',
    //     tags: '.tags .tag',
    //     type: '.category',
    //   },
    //   waitForSelector: '.ai-tool, .tool-item',
    // },
  ] as ScrapingSource[],
}));
