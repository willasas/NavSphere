# 数据库迁移指南

本文档介绍如何将项目从基于GitHub文件的存储迁移到Cloudflare D1数据库。

## 迁移前准备

### 1. 创建D1数据库

在Cloudflare Dashboard中创建一个新的D1数据库：

1. 登录Cloudflare Dashboard
2. 导航到Workers & Pages > D1
3. 点击"Create database"
4. 输入数据库名称（例如：navsphere-db）
5. 记录数据库ID

### 2. 更新wrangler.toml

确保[wrangler.toml](file:///d:/VDhub/NavSphere/wrangler.toml)中的数据库配置正确：

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "navsphere-db"
database_id = "your-database-id"
```

### 3. 初始化数据库表

运行数据库初始化脚本：

```bash
wrangler d1 execute navsphere-db --file=./scripts/init-database.js --remote
```

## 数据迁移步骤

### 1. 启用数据库模式

设置环境变量以启用数据库模式：

```bash
# 在Cloudflare Pages环境变量中设置
D1_DATABASE_ENABLED = "true"
```

### 2. 数据迁移

运行数据迁移脚本将现有JSON文件数据导入D1数据库：

```bash
wrangler d1 execute navsphere-db --file=./scripts/migrate-data.js --remote
```

注意：当前迁移脚本使用模拟数据。在实际使用中，您需要修改脚本以从GitHub获取真实数据。

### 3. 验证迁移

1. 检查所有功能是否正常工作
2. 确认数据完整性和正确性
3. 测试读写操作

## 回滚计划

如果需要回滚到基于文件的存储：

1. 将`D1_DATABASE_ENABLED`环境变量设置为`false`
2. 系统将自动回退到GitHub文件存储

## 性能优化

使用D1数据库的优势：

1. 更快的数据访问速度
2. 更好的并发处理能力
3. 原子操作和事务支持
4. 更可靠的数据持久性

## 注意事项

1. D1目前处于Beta阶段，可能存在一些限制
2. 数据库查询需要在Workers环境中执行
3. 需要适当处理错误和异常情况
4. 建议定期备份重要数据

## 数据库表结构说明

### navigation_items 表
存储导航分类信息：
- id: 导航项唯一标识
- title: 导航项标题
- icon: 图标
- description: 描述
- enabled: 是否启用
- parent_id: 父级导航项ID（用于构建层级结构）
- order_index: 排序索引

### resources 表
存储站点资源信息：
- id: 资源唯一标识
- title: 资源标题
- href: 链接地址
- description: 描述
- icon: 图标
- enabled: 是否启用
- navigation_item_id: 所属导航项ID

### site_config 表
存储站点配置信息：
- id: 配置ID（固定为1）
- title: 站点标题
- description: 站点描述
- keywords: 关键词
- logo: Logo路径
- favicon: 站点图标路径
- theme: 主题设置
- link_target: 链接打开方式

### resource_metadata 表
存储资源元数据信息：
- id: 资源唯一标识
- path: 资源路径
- commit_hash: 提交哈希值
- created_at: 创建时间

## API路由支持情况

以下API路由已支持数据库操作：
- `/api/site` - 站点配置管理
- `/api/navigation` - 导航数据管理
- `/api/navigation/restore` - 导航数据恢复
- `/api/resource` - 资源管理

所有API路由均支持双模式运行，在数据库不可用时会自动回退到文件存储模式。

## 性能优化特性

### 缓存机制
数据库服务实现了智能缓存机制，减少重复查询：
- 可配置的缓存过期时间（默认30秒）
- 基于查询语句和参数的缓存键生成
- 自动缓存清理机制

### 错误处理
完善的错误处理机制：
- 详细的错误日志记录
- 友好的错误信息返回
- 异常情况的优雅降级

### 连接管理
- 优化的数据库连接使用
- 查询结果缓存
- 自动清除过期缓存