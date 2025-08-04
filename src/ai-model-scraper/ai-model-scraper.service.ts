import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import scrapingConfig, { ScrapingSource } from './config/scraping.config';
import { AIModel, ScrapingResult } from './interface/ai-model.interface';

@Injectable()
export class AiModelScraperService {
  private readonly logger = new Logger(AiModelScraperService.name);
  private browser: puppeteer.Browser | null;

  constructor(
    @Inject(scrapingConfig.KEY)
    private config: ConfigType<typeof scrapingConfig>,
  ) {}

  async runScraping(): Promise<ScrapingResult> {
    const startTime = Date.now();
    const allModels: AIModel[] = [];
    const errors: string[] = [];
    const successfulSources: string[] = [];

    try {
      // Initialize browser
      this.browser = await puppeteer.launch({
        ...this.config.puppeteerOptions,
        headless: false, // <--- change this to false
        args: [
          ...(this.config.puppeteerOptions?.args || []),
          '--disable-blink-features=AutomationControlled',
        ],
      });
      this.logger.log('Browser launched successfully');

      // Process each enabled source
      for (const source of this.config.sources.filter((s) => s.enabled)) {
        try {
          this.logger.log(`Scraping ${source.name}...`);
          const models = await this.scrapeSource(source);
          allModels.push(...models);
          successfulSources.push(source.name);
          this.logger.log(
            `Successfully scraped ${models.length} models from ${source.name}`,
          );
        } catch (error) {
          const errorMsg = `Failed to scrape ${source.name}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Save results
      const result: ScrapingResult = {
        data: allModels,
        metadata: {
          totalScraped: allModels.length,
          sources: successfulSources,
          timestamp: new Date().toISOString(),
          success: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined,
        },
      };

      await this.saveResults(result);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Scraping completed in ${duration}ms. Total models: ${allModels.length}`,
      );

      return result;
    } finally {
      await this.closeBrowser();
    }
  }

  private async scrapeSource(source: ScrapingSource): Promise<AIModel[]> {
    const models: AIModel[] = [];
    let retryCount = 0;

    while (retryCount < this.config.retryOptions.maxRetries) {
      try {
        if (!this.browser) throw new Error('Browser not initialized');
        const page = await this.browser.newPage();

        // Configure page
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        );
        await page.setViewport({ width: 1920, height: 1080 });

        // Navigate to page
        await page.goto(source.url, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        // Wait for content to load
        if (source.waitForSelector) {
          await page.waitForSelector(source.waitForSelector, {
            timeout: 20000, // increase timeout
          });
        } else {
          await new Promise(resolve => setTimeout(resolve, 5000)); // fallback wait
        }

        // Extract data
        const pageModels = await page.evaluate((selectors, sourceName) => {
          const containers = document.querySelectorAll(selectors.container);
          console.log(`Selector used: ${selectors.container}, Containers found: ${containers.length}`); // Add this line for debugging
          const results: any[] = [];

          containers.forEach((container) => {
            try {
              const titleEl = container.querySelector(selectors.title || 'h2, .title, .name');
              const descEl = container.querySelector(selectors.description || 'p, .desc, .description');
              const iconEl = container.querySelector(selectors.icon || 'img, .icon');
              const linkEl = container.querySelector(selectors.link || 'a, .link');

              if (!titleEl || !descEl) return;

              const title = titleEl.textContent?.trim() || '';
              const description = descEl.textContent?.trim() || '';

              if (!title || !description) return;

              // Extract tags
              const tagElements = container.querySelectorAll(
                selectors.tags || '.tag',
              );
              const tags = Array.from(tagElements)
                .map((el) => el.textContent?.trim())
                .filter(Boolean);

              // Extract type
              const typeEl = container.querySelector(
                selectors.type || '.category',
              );
              const type = typeEl?.textContent?.trim() || 'AI Tool';

              // Extract URLs
              const iconUrl =
                iconEl?.getAttribute('src') ||
                iconEl?.getAttribute('data-src') ||
                '';
              const redirectUrl = linkEl?.getAttribute('href') || '';

              // Determine pricing model (simple heuristic)
              const lowerText = (title + ' ' + description).toLowerCase();
              let aiModel: 'free' | 'freemium' | 'premium' = 'freemium';
              if (
                lowerText.includes('free') &&
                !lowerText.includes('premium')
              ) {
                aiModel = 'free';
              } else if (
                lowerText.includes('premium') ||
                lowerText.includes('paid')
              ) {
                aiModel = 'premium';
              }

              // Determine filter tags (simple heuristic)
              const filterTags: ('Popular' | 'Trending' | 'Underrated')[] = [];
              if (
                container.querySelector('.popular, .trending') ||
                tags.some((tag) => tag && tag.toLowerCase().includes('popular'))
              ) {
                filterTags.push('Popular');
              }
              if (
                container.querySelector('.trending') ||
                tags.some((tag) => tag && tag.toLowerCase().includes('trending'))
              ) {
                filterTags.push('Trending');
              }
              if (filterTags.length === 0) {
                filterTags.push('Underrated');
              }

              results.push({
                title,
                description,
                icon_url: (() => {
                  if (iconUrl.startsWith('http')) return iconUrl;
                  try {
                    return iconUrl ? new URL(iconUrl, window.location.origin).href : '';
                  } catch {
                    return iconUrl || '';
                  }
                })(),
                redirect_url: (() => {
                  if (redirectUrl.startsWith('http')) return redirectUrl;
                  try {
                    return redirectUrl ? new URL(redirectUrl, window.location.origin).href : '';
                  } catch {
                    return redirectUrl || '';
                  }
                })(),
                ai_model: aiModel,
                tags: tags.length > 0 ? tags : ['ai', 'tool'],
                filter_tags: filterTags,
                type,
                origin: sourceName || 'Unknown',
              });
            } catch (error) {
              console.error('Error processing container:', error);
            }
          });

          return results;
        }, source.selectors, source.name);

        await page.close();
        models.push(...pageModels);
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        const delay = Math.min(
          this.config.retryOptions.baseDelay * Math.pow(2, retryCount - 1),
          this.config.retryOptions.maxDelay,
        );

        this.logger.warn(
          `Retry ${retryCount}/${this.config.retryOptions.maxRetries} for ${source.name} after ${delay}ms delay`,
        );

        if (retryCount >= this.config.retryOptions.maxRetries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return models.filter((model) => model.title && model.description);
  }

  private async saveResults(result: ScrapingResult): Promise<void> {
    try {
      // Ensure directory exists
      const outputDir = path.dirname(this.config.outputPath);
      await fs.ensureDir(outputDir);

      // Save JSON file
      await fs.writeJSON(this.config.outputPath, result, { spaces: 2 });

      this.logger.log(`Results saved to ${this.config.outputPath}`);
    } catch (error) {
      this.logger.error('Failed to save results', error.stack);
      throw error;
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.logger.log('Browser closed successfully');
      } catch (error) {
        this.logger.error('Error closing browser', error.stack);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }
}
