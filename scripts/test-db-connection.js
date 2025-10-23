/**
 * 数据库连接测试脚本
 * 
 * 使用方法:
 * wrangler d1 execute navsphere-db --file=./scripts/test-db-connection.js --remote
 */

export default {
  async run(queryRunner) {
    console.log('测试数据库连接...');
    
    try {
      // 测试查询
      const result = await queryRunner.run("SELECT 1 as connection_test");
      console.log('数据库连接成功:', result);
      
      // 测试创建表
      await queryRunner.run(`
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('表创建成功');
      
      // 测试插入数据
      await queryRunner.run(
        "INSERT INTO test_table (name) VALUES (?)",
        "测试数据"
      );
      console.log('数据插入成功');
      
      // 测试查询数据
      const queryResult = await queryRunner.run("SELECT * FROM test_table");
      console.log('查询结果:', queryResult);
      
      // 清理测试数据
      await queryRunner.run("DROP TABLE IF EXISTS test_table");
      console.log('测试完成，已清理测试数据');
      
    } catch (error) {
      console.error('数据库连接测试失败:', error);
      throw error;
    }
  }
}