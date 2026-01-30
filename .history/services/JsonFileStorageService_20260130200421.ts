// 检测是否在Edge运行时中
const isEdgeRuntime = typeof process === 'undefined';

interface StorageData {
  navigation_items: any[];
  resources: any[];
  site_config: any;
  resource_metadata: any[];
}

export class JsonFileStorageService {
  private storagePath: string;
  private cache: Map<string, { data: any, timestamp: number }>;
  private cacheExpiry: number;
  private storageData: StorageData;

  constructor(storagePath: string = 'navsphere/content') {
    this.storagePath = storagePath;
    this.cache = new Map();
    this.cacheExpiry = parseInt((!isEdgeRuntime && process.env.DB_CACHE_EXPIRY) || '30000'); // 默认30秒
    this.storageData = {
      navigation_items: [],
      resources: [],
      site_config: {
        id: 1,
        title: '',
        description: '',
        keywords: '',
        logo: '',
        favicon: '',
        theme: 'system',
        link_target: '_blank',
        updated_at: new Date().toISOString()
      },
      resource_metadata: []
    };
  }

  /**
   * 读取存储数据
   */
  private async readStorage(): Promise<StorageData> {
    if (!isEdgeRuntime) {
      // 只在非Edge运行时中尝试文件系统操作
      try {
        // 动态导入文件系统模块
        const fs = await import('fs').then(m => m.promises);
        const path = await import('path');

        const fullStoragePath = path.join(process.cwd(), this.storagePath);
        const storageFilePath = path.join(fullStoragePath, 'storage.json');

        // 确保存储目录存在
        await fs.mkdir(fullStoragePath, { recursive: true });

        try {
          // 尝试读取存储文件
          const data = await fs.readFile(storageFilePath, 'utf8');
          this.storageData = JSON.parse(data);
        } catch {
          // 如果文件不存在，创建默认存储文件
          await fs.writeFile(storageFilePath, JSON.stringify(this.storageData, null, 2));
        }
      } catch (error) {
        console.error('文件系统操作失败:', error);
      }
    }
    return this.storageData;
  }

  /**
   * 写入存储数据
   */
  private async writeStorage(data: StorageData): Promise<void> {
    this.storageData = data;

    if (!isEdgeRuntime) {
      // 只在非Edge运行时中尝试文件系统操作
      try {
        // 动态导入文件系统模块
        const fs = await import('fs').then(m => m.promises);
        const path = await import('path');

        const fullStoragePath = path.join(process.cwd(), this.storagePath);
        const storageFilePath = path.join(fullStoragePath, 'storage.json');

        // 确保存储目录存在
        await fs.mkdir(fullStoragePath, { recursive: true });

        // 写入存储文件
        await fs.writeFile(storageFilePath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('文件系统操作失败:', error);
      }
    }

    // 清除缓存
    this.cache.clear();
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
   * 初始化数据库表（JSON存储不需要表结构）
   */
  async initializeDatabase() {
    await this.initializeStorage();
    console.log('JSON存储初始化完成');
  }

  /**
   * 初始化存储
   */
  private async initializeStorage(): Promise<void> {
    await this.readStorage();
  }

  /**
   * 获取导航数据
   */
  async getNavigationData() {
    const cacheKey = this.generateCacheKey('getNavigationData');
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const data = await this.readStorage();
      const navigationItems = data.navigation_items.filter(item => item.enabled === 1);
      const resources = data.resources.filter(resource => resource.enabled === 1);

      // 构建层级结构
      const result = this.buildNavigationStructure(navigationItems, resources);
      this.setInCache(cacheKey, result);
      return result;
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
      const storageData = await this.readStorage();

      // 清空现有数据
      storageData.navigation_items = [];
      storageData.resources = [];

      // 插入新数据
      await this.insertNavigationData(data.navigationItems, storageData);

      await this.writeStorage(storageData);
      return { success: true };
    } catch (error) {
      console.error('更新导航数据失败:', error);
      throw error;
    }
  }

  /**
   * 插入导航数据
   */
  private async insertNavigationData(items: any[], storageData: StorageData, parentId: string | null = null) {
    try {
      for (const item of items) {
        // 插入导航项
        storageData.navigation_items.push({
          id: item.id,
          title: item.title,
          icon: item.icon,
          description: item.description,
          enabled: item.enabled ? 1 : 0,
          parent_id: parentId,
          order_index: item.order_index || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // 插入关联的站点资源
        if (item.items && Array.isArray(item.items)) {
          for (const resource of item.items) {
            storageData.resources.push({
              id: resource.id,
              title: resource.title,
              href: resource.href,
              description: resource.description,
              icon: resource.icon,
              enabled: resource.enabled ? 1 : 0,
              navigation_item_id: item.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }

        // 递归插入子分类
        if (item.subCategories && Array.isArray(item.subCategories)) {
          await this.insertNavigationData(item.subCategories, storageData, item.id);
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
    const cacheKey = this.generateCacheKey('getSiteConfig');
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const data = await this.readStorage();
      const config = data.site_config;

      if (config) {
        const result = {
          basic: {
            title: config.title,
            description: config.description,
            keywords: config.keywords
          },
          appearance: {
            logo: config.logo,
            favicon: config.favicon,
            theme: config.theme
          },
          navigation: {
            linkTarget: config.link_target
          }
        };
        this.setInCache(cacheKey, result);
        return result;
      }

      // 返回默认配置
      const defaultConfig = {
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
      this.setInCache(cacheKey, defaultConfig);
      return defaultConfig;
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
      const storageData = await this.readStorage();

      storageData.site_config = {
        id: 1,
        title: config.basic.title,
        description: config.basic.description,
        keywords: config.basic.keywords,
        logo: config.appearance.logo,
        favicon: config.appearance.favicon,
        theme: config.appearance.theme,
        link_target: config.navigation.linkTarget,
        updated_at: new Date().toISOString()
      };

      await this.writeStorage(storageData);
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
      const storageData = await this.readStorage();

      // 生成唯一ID
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      storageData.resource_metadata.push({
        id,
        path,
        commit_hash: commitHash,
        created_at: new Date().toISOString()
      });

      await this.writeStorage(storageData);
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
    const cacheKey = this.generateCacheKey('getResourceMetadata');
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const data = await this.readStorage();
      const result = data.resource_metadata.map((item: any) => ({
        hash: item.id,
        path: item.path,
        commit: item.commit_hash
      }));
      this.setInCache(cacheKey, result);
      return result;
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
      const storageData = await this.readStorage();
      const originalLength = storageData.resource_metadata.length;

      // 过滤掉要删除的