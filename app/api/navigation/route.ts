import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent } from '@/lib/github'
import { DatabaseService } from '@/services/DatabaseService'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

export async function GET(request: Request) {
  // 检查是否启用数据库
  const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
  
  if (useDatabase) {
    try {
      const dbService = new DatabaseService((request as any).env);
      const data = await dbService.getNavigationData();
      return NextResponse.json(data);
    } catch (error) {
      console.error('Failed to fetch navigation data from database:', error);
      // 如果数据库访问失败，回退到文件存储
    }
  }
  
  // 使用原有的文件存储方式
  try {
    const data = await getFileContent('navsphere/content/navigation.json')
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch navigation data:', error)
    return NextResponse.json({ navigationItems: [] })
  }
}

export async function PUT(request: Request) {
  const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
  
  try {
    const session = await auth()
    if (!session?.user?.accessToken && !useDatabase) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data: NavigationData = await request.json()
    
    if (useDatabase) {
      // 使用数据库存储
      const dbService = new DatabaseService((request as any).env);
      await dbService.updateNavigationData(data);
      return NextResponse.json({ success: true })
    } else {
      // 使用原有的GitHub文件存储
      await commitFile(
        'navsphere/content/navigation.json',
        JSON.stringify(data, null, 2),
        'Update navigation data',
        session.user.accessToken
      )
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Failed to update navigation data:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update navigation data' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.accessToken) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    await commitFile(
      'navsphere/content/navigation.json',
      JSON.stringify(data, null, 2),
      'Update navigation data',
      session.user.accessToken
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save navigation data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save navigation data', 
        details: (error as Error).message 
      },
      { status: 500 }
    )
  }
}
