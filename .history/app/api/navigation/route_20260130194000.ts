import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { DatabaseService } from '@/services/DatabaseService'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const dbService = new DatabaseService((request as any).env);
    const data = await dbService.getNavigationData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch navigation data:', error);
    return NextResponse.json({ navigationItems: [] });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data: NavigationData = await request.json()

    const dbService = new DatabaseService((request as any).env);
    await dbService.updateNavigationData(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update navigation data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update navigation data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data = await request.json();

    const dbService = new DatabaseService((request as any).env);
    await dbService.updateNavigationData(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save navigation data:', error);
    return NextResponse.json(
      {
        error: 'Failed to save navigation data',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}