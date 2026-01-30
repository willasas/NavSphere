import { NextResponse } from 'next/server'
import type { SiteConfig } from '@/types/site'
import { DatabaseService } from '@/services/DatabaseService'
import { auth } from '@/lib/auth'

export const runtime = 'edge'

const defaultConfig: SiteConfig = {
  basic: {
    title: 'NavSphere',
    description: 'A modern navigation platform',
    keywords: 'navigation, platform, web, management'
  },
  appearance: {
    logo: '/logo.png',
    favicon: '/favicon.ico',
    theme: 'system'
  },
  navigation: {
    linkTarget: '_blank'
  }
}

export async function GET(request: Request) {
  try {
    const dbService = new DatabaseService((request as any).env);
    const config = await dbService.getSiteConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching site config:', error);
    return NextResponse.json(defaultConfig);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const config: SiteConfig = await request.json();
    const dbService = new DatabaseService((request as any).env);
    await dbService.updateSiteConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating site config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update site config' },
      { status: 500 }
    );
  }
}
