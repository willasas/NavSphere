# 部署后操作指南

本文档说明在将代码推送到GitHub并完成Cloudflare Pages部署后需要执行的操作。

## 1. 初始化数据库表结构

在项目根目录执行以下命令：

```bash
wrangler d1 execute navsphere-db --file=./scripts/init-database.js --remote
```

此命令将创建所有必需的数据库表和索引。

## 2. 验证数据库连接（可选）

运行测试脚本验证数据库连接是否正常：

```bash
wrangler d1 execute navsphere-db --file=./scripts/test-db-connection.js --remote
```

## 3. 设置环境变量

在Cloudflare Pages项目设置中添加以下环境变量：

- `D1_DATABASE_ENABLED = "true"`
- `DB_CACHE_EXPIRY = "30000"` （可根据需要调整，单位为毫秒）

## 4. 迁移现有数据

运行数据迁移脚本将现有JSON文件数据导入到D1数据库：

```bash
wrangler d1 execute navsphere-db --file=./scripts/migrate-data.js --remote
```

注意：迁移脚本会尝试从GitHub获取真实数据，如果无法访问GitHub，则会使用模拟数据。

## 5. 验证功能

1. 访问您的网站，确保导航数据正常显示
2. 尝试更新站点配置，确认数据能正确保存到数据库
3. 添加和删除资源，确认资源管理功能正常

## 6. 故障排除

如果遇到问题，请检查：

1. 确认所有代码已推送到GitHub并成功部署到Cloudflare Pages
2. 确认环境变量已正确设置
3. 检查Cloudflare Pages部署日志是否有错误
4. 确认数据库初始化是否成功执行

## 7. 回滚计划

如果需要回滚到基于文件的存储：

1. 将 `D1_DATABASE_ENABLED` 环境变量设置为 `false` 或删除该变量
2. 系统将自动回退到GitHub文件存储模式

## 常用命令

### 数据库相关命令

```bash
# 初始化数据库表结构
wrangler d1 execute navsphere-db --file=./scripts/init-database.js --remote

# 测试数据库连接
wrangler d1 execute navsphere-db --file=./scripts/test-db-connection.js --remote

# 迁移数据
wrangler d1 execute navsphere-db --file=./scripts/migrate-data.js --remote

# 查看数据库表结构
wrangler d1 execute navsphere-db --command="SELECT name FROM sqlite_master WHERE type='table'" --remote

# 查看表中的数据
wrangler d1 execute navsphere-db --command="SELECT * FROM site_config" --remote
```

### 开发相关命令

```bash
# 提交代码到GitHub
git add .
git commit -m "Add database support"
git push origin main

# 部署到Cloudflare Pages（如果未启用自动部署）
wrangler pages deploy
```

## 性能监控

启用数据库后，您应该关注以下性能指标：

1. 页面加载速度是否提升
2. 数据操作响应时间是否改善
3. 数据库查询是否正确使用缓存
4. 错误日志中是否有数据库相关错误

## 注意事项

1. D1数据库目前处于Beta阶段，可能存在一些限制
2. 数据库查询需要在Workers环境中执行
3. 建议定期备份重要数据
4. 缓存机制可以显著提升性能，请根据实际使用情况调整缓存过期时间