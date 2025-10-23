/**
 * Cloudflare D1 数据库初始化脚本
 * 
 * 使用方法:
 * 1. 确保已在 wrangler.toml 中配置了 D1 数据库绑定
 * 2. 运行: wrangler d1 execute YOUR_DATABASE_NAME --file=./scripts/init-database.js
 */

export default {
  async run(queryRunner) {
    console.log('开始初始化数据库...');
    
    try {
      // 创建导航项表
      await queryRunner.run(`
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
        );
      `);
      console.log('navigation_items 表创建成功');

      // 创建站点资源表
      await queryRunner.run(`
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
        );
      `);
      console.log('resources 表创建成功');

      // 创建站点配置表
      await queryRunner.run(`
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
        );
      `);
      console.log('site_config 表创建成功');

      // 创建资源元数据表
      await queryRunner.run(`
        CREATE TABLE IF NOT EXISTS resource_metadata (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          commit_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('resource_metadata 表创建成功');

      // 创建索引以提高查询性能
      await queryRunner.run(`
        CREATE INDEX IF NOT EXISTS idx_navigation_items_parent_id 
        ON navigation_items(parent_id);
      `);
      console.log('idx_navigation_items_parent_id 索引创建成功');

      await queryRunner.run(`
        CREATE INDEX IF NOT EXISTS idx_resources_navigation_item_id 
        ON resources(navigation_item_id);
      `);
      console.log('idx_resources_navigation_item_id 索引创建成功');

      await queryRunner.run(`
        CREATE INDEX IF NOT EXISTS idx_navigation_items_enabled 
        ON navigation_items(enabled);
      `);
      console.log('idx_navigation_items_enabled 索引创建成功');

      await queryRunner.run(`
        CREATE INDEX IF NOT EXISTS idx_resources_enabled 
        ON resources(enabled);
      `);
      console.log('idx_resources_enabled 索引创建成功');

      console.log('数据库初始化完成');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }
}