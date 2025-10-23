import { SiteConfig } from '@/types/site'
import { DatabaseService } from './DatabaseService';
import { isDatabaseEnabled } from '@/lib/github';

export class SiteConfigService {
  private dbService: DatabaseService | null = null;

  constructor(env?: any) {
    if (env && isDatabaseEnabled()) {
      this.dbService = new DatabaseService(env);
    }
  }

  async getSiteConfig(): Promise<SiteConfig> {
    if (this.dbService) {
      // 从数据库获取站点配置
      try {
        const config = await this.dbService.getSiteConfig();
        return config;
      } catch (error) {
        console.error('Error fetching site config from database:', error);
        // 返回默认配置
        return this.getDefaultConfig();
      }
    } else {
      // 原有的GitHub获取方式
      try {
        const response = await fetch('/api/site')
        if (!response.ok) throw new Error('Failed to fetch site config')
        const data = await response.json()
        return data
      } catch (error) {
        console.error('Error fetching site config:', error)
        return this.getDefaultConfig();
      }
    }
  }

  private getDefaultConfig(): SiteConfig {
    return {
      basic: {
        title: '',
        description: '',
        keywords: ''
      },
      appearance: {
        logo: '',
        favicon: '',
        theme: 'system'
      },
      navigation: {
        linkTarget: '_blank'
      }
    };
  }

  async updateSiteConfig(config: SiteConfig): Promise<boolean> {
    if (this.dbService) {
      // 更新数据库中的站点配置
      try {
        const result = await this.dbService.updateSiteConfig(config);
        return result;
      } catch (error) {
        console.error('Error updating site config in database:', error);
        return false;
      }
    } else {
      // 原有的GitHub更新方式
      try {
        const response = await fetch('/api/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        })
        return response.ok
      } catch (error) {
        console.error('Error updating site config:', error)
        return false
      }
    }
  }
}