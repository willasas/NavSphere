/**
 * 数据迁移脚本 - 将现有JSON文件数据导入D1数据库
 * 
 * 使用方法:
 * 1. 确保已在 wrangler.toml 中配置了 D1 数据库绑定
 * 2. 运行: wrangler d1 execute YOUR_DATABASE_NAME --file=./scripts/migrate-data.js --remote
 */

// 导入GitHub数据获取工具
import { GitHubDataFetcher, DataTransformer } from './github-data-fetcher.js';

export default {
  async run(queryRunner) {
    console.log('开始数据迁移...');
    
    try {
      // 在实际环境中，需要从环境变量获取GitHub配置
      const githubToken = process.env.GITHUB_TOKEN;
      const githubOwner = process.env.GITHUB_OWNER;
      const githubRepo = process.env.GITHUB_REPO;
      const githubBranch = process.env.GITHUB_BRANCH || 'main';
      
      if (!githubToken || !githubOwner || !githubRepo) {
        console.log('警告: 未提供GitHub配置，使用模拟数据');
        await this.migrateWithMockData(queryRunner);
      } else {
        console.log('使用真实GitHub数据进行迁移');
        await this.migrateWithRealData(queryRunner, githubToken, githubOwner, githubRepo, githubBranch);
      }
      
      console.log('数据迁移完成');
    } catch (error) {
      console.error('数据迁移失败:', error);
    }
  },
  
  async migrateWithMockData(queryRunner) {
    console.log('使用模拟数据进行迁移...');
    
    // 模拟导航数据
    const navigationData = {
      navigationItems: [
        {
          id: "1",
          title: "常用网站",
          icon: "globe",
          description: "经常访问的网站",
          enabled: true,
          items: [
            {
              id: "1_1",
              title: "GitHub",
              href: "https://github.com",
              description: "代码托管平台",
              icon: "/icons/github.png",
              enabled: true
            }
          ],
          subCategories: []
        }
      ]
    };
    
    // 模拟站点配置数据
    const siteConfig = {
      basic: {
        title: "NavSphere",
        description: "现代化导航网站",
        keywords: "导航,网站,资源"
      },
      appearance: {
        logo: "/logo.png",
        favicon: "/favicon.ico",
        theme: "system"
      },
      navigation: {
        linkTarget: "_blank"
      }
    };
    
    // 模拟资源元数据
    const resourceMetadata = {
      metadata: [
        {
          hash: "abc123",
          path: "/assets/img_123.png",
          commit: "def456"
        }
      ]
    };
    
    // 迁移数据
    await this.migrateNavigationData(queryRunner, navigationData);
    await this.migrateSiteConfig(queryRunner, siteConfig);
    await this.migrateResourceMetadata(queryRunner, resourceMetadata);
  },
  
  async migrateWithRealData(queryRunner, githubToken, githubOwner, githubRepo, githubBranch) {
    console.log('获取真实GitHub数据...');
    
    try {
      // 获取GitHub数据
      const fetcher = new GitHubDataFetcher(githubToken, githubOwner, githubRepo, githubBranch);
      const data = await fetcher.getAllData();
      
      // 转换数据
      const transformedNavigationData = DataTransformer.transformNavigationData(data.navigationData);
      const transformedSiteConfig = DataTransformer.transformSiteConfig(data.siteConfig);
      const transformedResourceMetadata = DataTransformer.transformResourceMetadata(data.resourceMetadata);
      
      // 迁移数据
      await this.migrateNavigationData(queryRunner, transformedNavigationData);
      await this.migrateSiteConfig(queryRunner, transformedSiteConfig);
      await this.migrateResourceMetadata(queryRunner, transformedResourceMetadata);
      
      console.log('真实数据迁移完成');
    } catch (error) {
      console.error('获取或迁移真实数据失败:', error);
      throw error;
    }
  },
  
  async migrateNavigationData(queryRunner, navigationData) {
    console.log('迁移导航数据...');
    
    // 清空现有数据
    await queryRunner.run("DELETE FROM resources");
    await queryRunner.run("DELETE FROM navigation_items");
    
    // 插入导航项和资源
    for (const item of navigationData.navigationItems) {
      await this.insertNavigationItem(queryRunner, item, null);
    }
    
    console.log('导航数据迁移完成');
  },
  
  async insertNavigationItem(queryRunner, item, parentId) {
    // 插入导航项
    await queryRunner.run(`
      INSERT INTO navigation_items (id, title, icon, description, enabled, parent_id, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, item.id, item.title, item.icon, item.description, item.enabled ? 1 : 0, parentId, item.order_index || 0);
    
    // 插入关联的资源
    if (item.items && Array.isArray(item.items)) {
      for (const resource of item.items) {
        await queryRunner.run(`
          INSERT INTO resources (id, title, href, description, icon, enabled, navigation_item_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, resource.id, resource.title, resource.href, resource.description, resource.icon, resource.enabled ? 1 : 0, item.id);
      }
    }
    
    // 递归插入子分类
    if (item.subCategories && Array.isArray(item.subCategories)) {
      for (const subItem of item.subCategories) {
        await this.insertNavigationItem(queryRunner, subItem, item.id);
      }
    }
  },
  
  async migrateSiteConfig(queryRunner, siteConfig) {
    console.log('迁移站点配置数据...');
    
    await queryRunner.run(`
      INSERT OR REPLACE INTO site_config (
        id, title, description, keywords, logo, favicon, theme, link_target
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, 1, siteConfig.basic.title, siteConfig.basic.description, siteConfig.basic.keywords,
       siteConfig.appearance.logo, siteConfig.appearance.favicon, siteConfig.appearance.theme,
       siteConfig.navigation.linkTarget);
    
    console.log('站点配置数据迁移完成');
  },
  
  async migrateResourceMetadata(queryRunner, resourceMetadata) {
    console.log('迁移资源元数据...');
    
    // 清空现有数据
    await queryRunner.run("DELETE FROM resource_metadata");
    
    // 插入资源元数据
    if (resourceMetadata.metadata && Array.isArray(resourceMetadata.metadata)) {
      for (const meta of resourceMetadata.metadata) {
        await queryRunner.run(`
          INSERT INTO resource_metadata (id, path, commit_hash)
          VALUES (?, ?, ?)
        `, meta.hash, meta.path, meta.commit);
      }
    }
    
    console.log('资源元数据迁移完成');
  }
}