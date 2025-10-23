import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent } from '@/lib/github'
import { DatabaseService } from '@/services/DatabaseService'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

export async function POST(request: Request) {
  const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
  
  try {
    const session = await auth()
    if (!session?.user?.accessToken && !useDatabase) {
      return new Response('Unauthorized', { status: 401 })
    }

    // 获取默认导航数据
    const defaultData = await getFileContent('navsphere/content/navigation-default.json') as NavigationData
    
    if (useDatabase) {
      // 使用数据库存储
      const dbService = new DatabaseService((request as any).env);
      await dbService.updateNavigationData(defaultData);
      return NextResponse.json({ success: true })
    } else {
      // 使用原有的GitHub文件存储
      // 修复类型错误：确保session、session.user和accessToken都存在
      if (!session || !session.user || !session.user.accessToken) {
        return new Response('Unauthorized', { status: 401 })
      }
      
      await commitFile(
        'navsphere/content/navigation.json',
        JSON.stringify(defaultData, null, 2),
        'Restore navigation data from default',
        session.user.accessToken
      )
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Failed to restore navigation data:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore navigation data' },
      { status: 500 }
    )
  }
}