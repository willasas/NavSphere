import { DatabaseService } from './DatabaseService';
import { isDatabaseEnabled } from '@/lib/github';
import { getFileContent } from '@/lib/github';

export class ResourceService {
  private dbService: DatabaseService | null = null;

  constructor(env?: any) {
    if (env && isDatabaseEnabled()) {
      this.dbService = new DatabaseService(env);
    }
  }

  async addResource(resource: { path: string }) {
    if (this.dbService) {
      // 使用数据库存储资源
      // Logic to add the resource to database
      try {
        // 这里应该实现数据库存储逻辑
        // 暂时返回模拟成功响应
        return { success: true, imageUrl: resource.path };
      } catch (error) {
        throw new Error('Failed to add resource to database');
      }
    } else {
      // 使用原有的GitHub API存储逻辑
      const response = await fetch('/api/resource', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        throw new Error('Failed to add resource');
      }

      return await response.json(); // Return the response data if needed
    }
  }

  async getResourceMetadata() {
    if (this.dbService) {
      // 从数据库获取资源元数据
      // 这里应该实现数据库查询逻辑
      return { metadata: [] };
    } else {
      // 从GitHub获取资源元数据
      try {
        const data = await getFileContent('navsphere/content/resource-metadata.json');
        if (!data?.metadata || !Array.isArray(data.metadata)) {
          return { metadata: [] };
        }
        return data;
      } catch (error) {
        console.error('Failed to fetch resource metadata:', error);
        return { metadata: [] };
      }
    }
  }
}