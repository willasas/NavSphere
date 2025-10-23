import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent } from '@/lib/github'
import { DatabaseService } from '@/services/DatabaseService'

export const runtime = 'edge'

export async function GET(request: Request) {
  // 检查是否启用数据库
  const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
  
  if (useDatabase) {
    try {
      const dbService = new DatabaseService((request as any).env);
      const config = await dbService.getSiteConfig();
      return NextResponse.json(config);
    } catch (error) {
      console.error('Failed to fetch site config from database:', error);
      // 如果数据库访问失败，回退到文件存储
    }
  }
  
  // 使用原有的文件存储方式
  try {
    const data = await getFileContent('navsphere/content/site.json')
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch site config:', error)
    return NextResponse.json({ 
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
    })
  }
}

export async function POST(request: Request) {
  const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
  
  try {
    const session = await auth()
    if (!session?.user?.accessToken && !useDatabase) {
      return new Response('Unauthorized', { status: 401 })
    }

    const config = await request.json()
    
    if (useDatabase) {
      // 使用数据库存储
      const dbService = new DatabaseService((request as any).env);
      await dbService.updateSiteConfig(config);
      return NextResponse.json({ success: true })
    } else {
      // 使用原有的GitHub文件存储
      await commitFile(
        'navsphere/content/site.json',
        JSON.stringify(config, null, 2),
        'Update site configuration',
        session.user.accessToken
      )
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Failed to update site config:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update site config' },
      { status: 500 }
    )
  }
}