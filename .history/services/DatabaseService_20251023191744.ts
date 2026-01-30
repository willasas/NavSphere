export class DatabaseService {
  private env: any;
  private db: any;
  private cache: Map<string, { data: any, timestamp: number }>;
  private cacheExpiry: number;

  constructor(env: any) {
    this.env = env;
    this.db = env.DB;
    this.cache = new Map();
    this.cacheExpiry = parseInt(process.env.DB_CACHE_EXPIRY || '30000'); // 默认30秒
  }

  /**
   * 缓存键生成
   */
  private generateCacheKey(operation: string, ...params: any[]): string {
    return `${operation}:${JSON.stringify(params)}`;
  }

  /**
   * 从缓存获取数据
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * 将数据存入缓存
   */
  private setInCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * 清除缓存
   */
  private clearCache(): void {
    this.cache.clear();
  }

  /**
   * 执行数据库查询并处理错误
   */
  private async executeQuery<T>(query: string, params: any[] = [], useCache: boolean = false): Promise<T> {
    const cacheKey = this.generateCacheKey(query, ...params);
    
    // 尝试从缓存获取
    if (useCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    try {
      let result;
      if (params.length > 0) {
        result = await this.db.prepare(query).bind(...params).all();
      } else {
        result = await this.db.prepare(query).all();
      }
      
      // 将结果存入缓存
      if (useCache) {
        this.setInCache(cacheKey, result);
      }
      
      return result as T;
    } catch (error) {
      console.error(`数据库查询失败: ${query}`, error);
      throw new Error(`数据库查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行数据库变更操作并处理错误
   */
  private async executeMutation(query: string, params: any[] = []): Promise<any> {
    try {
      let result;
      if (params.length > 0) {
        result = await this.db.prepare(query).bind(...params).run();
      } else {
        result = await this.db.prepare(query).run();
      }
      
      // 清除缓存
      this.clearCache();
      
      return result;
    } catch (error) {
      console.error(`数据库变更失败: ${query}`, error);
      throw new Error(`数据库变更失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 初始化数据库表
   */
  async initializeDatabase() {
    try {
      // 创建导航项表
      await this.executeMutation(`
        CREATE TABLE IF NOT EXISTS navigation_items (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          icon TEXT,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          parent_id TEXT,
          order_index INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建站点资源表
      await this.executeMutation(`
        CREATE TABLE IF NOT EXISTS resources (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          href TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          enabled INTEGER DEFAULT 1,
          navigation_item_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建站点配置表
      await this.executeMutation(`
        CREATE TABLE IF NOT EXISTS site_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          title TEXT,
          description TEXT,
          keywords TEXT,
          logo TEXT,
          favicon TEXT,
          theme TEXT DEFAULT 'system',
          link_target TEXT DEFAULT '_blank',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建资源元数据表
      await this.executeMutation(`
        CREATE TABLE IF NOT EXISTS resource_metadata (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          commit_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 创建索引
      await this.createIndexes();
      
      console.log('数据库初始化完成');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }
  
  /**
   * 创建索引
   */
  private async createIndexes() {
    try {
      await this.executeMutation(`
        CREATE INDEX IF NOT EXISTS idx_navigation_items_parent_id 
        ON navigation_items(parent_id)
      `);

      await this.executeMutation(`
        CREATE INDEX IF NOT EXISTS idx_resources_navigation_item_id 
        ON resources(navigation_item_id)
      `);

      await this.executeMutation(`
        CREATE INDEX IF NOT EXISTS idx_navigation_items_enabled 
        ON navigation_items(enabled)
      `);

      await this.executeMutation(`
        CREATE INDEX IF NOT EXISTS idx_resources_enabled 
        ON resources(enabled)
      `);
    } catch (error) {
      console.error('创建索引失败:', error);
      // 不抛出错误，因为索引不是必需的
    }
  }

  /**
   * 获取导航数据
   */
  async getNavigationData() {
    try {
      // 查询所有启用的导航项
      const navigationItemsResult = await this.executeQuery(
        `SELECT * FROM navigation_items 
         WHERE enabled = 1 
         ORDER BY parent_id, order_index`, 
        [], 
        true // 使用缓存
      );
      
      const navigationItems = navigationItemsResult.results;
      
      // 查询所有站点资源
      const resourcesResult = await this.executeQuery(
        `SELECT * FROM resources 
         WHERE enabled = 1 
         ORDER BY navigation_item_id`,
        [],
        true // 使用缓存
      );
      
      const resources = resourcesResult.results;

      // 构建层级结构
      return this.buildNavigationStructure(navigationItems, resources);
    } catch (error) {
      console.error('获取导航数据失败:', error);
      throw error;
    }
  }

  /**
   * 构建导航层级结构
   */
  private buildNavigationStructure(navigationItems: any[], resources: any[]) {
    try {
      // 创建导航项映射
      const itemMap = new Map();
      navigationItems.forEach(item => {
        itemMap.set(item.id, {
          ...item,
          items: [],
          subCategories: []
        });
      });

      // 关联资源到对应的导航项
      resources.forEach(resource => {
        const navItem = itemMap.get(resource.navigation_item_id);
        if (navItem) {
          navItem.items.push({
            id: resource.id,
            title: resource.title,
            href: resource.href,
            description: resource.description,
            icon: resource.icon,
            enabled: resource.enabled === 1
          });
        }
      });

      // 构建层级结构
      const rootItems: any[] = [];
      navigationItems.forEach(item => {
        if (!item.parent_id) {
          rootItems.push(itemMap.get(item.id));
        } else {
          const parent = itemMap.get(item.parent_id);
          if (parent) {
            parent.subCategories.push(itemMap.get(item.id));
          }
        }
      });

      return { navigationItems: rootItems };
    } catch (error) {
      console.error('构建导航结构失败:', error);
      throw new Error(`构建导航结构失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 更新导航数据
   */
  async updateNavigationData(data: any) {
    try {
      // 开始事务
      // 注意：D1的事务支持有限，这里简化处理
      
      // 清除现有数据
      await this.executeMutation("DELETE FROM navigation_items");
      await this.executeMutation("DELETE FROM resources");
      
      // 插入新数据
      await this.insertNavigationData(data.navigationItems);
      
      return { success: true };
    } catch (error) {
      console.error('更新导航数据失败:', error);
      throw error;
    }
  }

  /**
   * 插入导航数据
   */
  private async insertNavigationData(items: any[], parentId: string | null = null) {
    try {
      for (const item of items) {
        // 插入导航项
        await this.executeMutation(`
          INSERT INTO navigation_items (id, title, icon, description, enabled, parent_id, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          item.id,
          item.title,
          item.icon,
          item.description,
          item.enabled ? 1 : 0,
          parentId,
          item.order_index || 0
        ]);

        // 插入关联的站点资源
        if (item.items && Array.isArray(item.items)) {
          for (const resource of item.items) {
            await this.executeMutation(`
              INSERT INTO resources (id, title, href, description, icon, enabled, navigation_item_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              resource.id,
              resource.title,
              resource.href,
              resource.description,
              resource.icon,
              resource.enabled ? 1 : 0,
              item.id
            ]);
          }
        }

        // 递归插入子分类
        if (item.subCategories && Array.isArray(item.subCategories)) {
          await this.insertNavigationData(item.subCategories, item.id);
        }
      }
    } catch (error) {
      console.error('插入导航数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取站点配置
   */
  async getSiteConfig() {
    try {
      const result = await this.executeQuery(
        "SELECT * FROM site_config WHERE id = 1", 
        [], 
        true // 使用缓存
      );
      
      const row = result.results[0];
      
      if (row) {
        return {
          basic: {
            title: row.title,
            description: row.description,
            keywords: row.keywords
          },
          appearance: {
            logo: row.logo,
            favicon: row.favicon,
            theme: row.theme
          },
          navigation: {
            linkTarget: row.link_target
          }
        };
      }
      
      // 返回默认配置
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
    } catch (error) {
      console.error('获取站点配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新站点配置
   */
  async updateSiteConfig(config: any) {
    try {
      // 检查是否存在配置记录
      const existsResult = await this.executeQuery("SELECT id FROM site_config WHERE id = 1");
      const exists = existsResult.results.length > 0;
      
      if (exists) {
        // 更新现有记录
        await this.executeMutation(`
          UPDATE site_config SET
            title = ?,
            description = ?,
            keywords = ?,
            logo = ?,
            favicon = ?,
            theme = ?,
            link_target = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `, [
          config.basic.title,
          config.basic.description,
          config.basic.keywords,
          config.appearance.logo,
          config.appearance.favicon,
          config.appearance.theme,
          config.navigation.linkTarget
        ]);
      } else {
        // 插入新记录
        await this.executeMutation(`
          INSERT INTO site_config (
            title, description, keywords, logo, favicon, theme, link_target
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          config.basic.title,
          config.basic.description,
          config.basic.keywords,
          config.appearance.logo,
          config.appearance.favicon,
          config.appearance.theme,
          config.navigation.linkTarget
        ]);
      }
      
      return true;
    } catch (error) {
      console.error('更新站点配置失败:', error);
      throw error;
    }
  }

  /**
   * 添加资源元数据
   */
  async addResourceMetadata(path: string, commitHash: string) {
    try {
      // 生成唯一ID
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.executeMutation(`
        INSERT INTO resource_metadata (id, path, commit_hash)
        VALUES (?, ?, ?)
      `, [id, path, commitHash]);
      
      return { id, path, commitHash };
    } catch (error) {
      console.error('添加资源元数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有资源元数据
   */
  async getResourceMetadata() {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM resource_metadata 
         ORDER BY created_at DESC`,
        [],
        true // 使用缓存
      );
      
      return result.results.map((item: any) => ({
        hash: item.id,
        path: item.path,
        commit: item.commit_hash
      }));
    } catch (error) {
      console.error('获取资源元数据失败:', error);
      throw error;
    }
  }

  /**
   * 删除资源元数据
   */
  async deleteResourceMetadata(hashes: string[]) {
    try {
      // 构建占位符
      const placeholders = hashes.map(() => '?').join(',');
      
      const result = await this.executeMutation(`
        DELETE FROM resource_metadata 
        WHERE id IN (${placeholders})
      `, hashes);
      
      return { deletedCount: result.meta.changes };
    } catch (error) {
      console.error('删除资源元数据失败:', error);
      throw error;
    }
  }
}