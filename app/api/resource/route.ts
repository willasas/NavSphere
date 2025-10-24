import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { commitFile, getFileContent } from '@/lib/github'
import type { ResourceMetadata } from '@/types/resource-metadata'
import { DatabaseService } from '@/services/DatabaseService'

export const runtime = 'edge'

export async function GET(request: Request) {
    // 检查是否启用数据库
    const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
    
    if (useDatabase) {
        try {
            const dbService = new DatabaseService((request as any).env);
            const metadata = await dbService.getResourceMetadata();
            return NextResponse.json({ metadata });
        } catch (error) {
            console.error('Failed to fetch resource metadata from database:', error);
            // 如果数据库访问失败，回退到文件存储
        }
    }
    
    // 使用原有的文件存储方式
    try {
        const data = await getFileContent('navsphere/content/resource-metadata.json') as ResourceMetadata
        if (!data?.metadata || !Array.isArray(data.metadata)) {
            throw new Error('Invalid data structure');
        }
        return NextResponse.json(data)
    } catch (error) {
        console.error('Failed to fetch resource metadata:', error)
        return NextResponse.json({ error: 'Failed to fetch resource metadata' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
    
    try {
        const session = await auth();
        if (!session?.user?.accessToken && !useDatabase) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { image } = await request.json(); // Get the Base64 image
        const base64Data = image.split(",")[1]; // Extract the Base64 part
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)); // Convert Base64 to binary

        // 在使用session.user.accessToken之前检查其存在性
        if (!useDatabase && (!session || !session.user || !session.user.accessToken)) {
            return new Response('Unauthorized', { status: 401 });
        }

        // 获取上传结果，包含路径和 commit hash
        const { path: imageUrl, commitHash } = await uploadImageToGitHub(binaryData, session.user.accessToken);

        if (useDatabase) {
            // 使用数据库存储资源元数据
            const dbService = new DatabaseService((request as any).env);
            await dbService.addResourceMetadata(imageUrl, commitHash);
        } else {
            // Handle metadata using file storage
            const metadata = await getFileContent('navsphere/content/resource-metadata.json') as ResourceMetadata;
            metadata.metadata.unshift({ 
                commit: commitHash,  // 使用实际的 commit hash
                hash: commitHash,    // 使用相同的 hash 作为资源标识
                path: imageUrl 
            });

            await commitFile(
                'navsphere/content/resource-metadata.json',
                JSON.stringify(metadata, null, 2),
                'Update resource metadata',
                session.user.accessToken
            );
        }

        return NextResponse.json({ success: true, imageUrl });
    } catch (error) {
        console.error('Failed to save resource metadata:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save resource metadata' },
            { status: 500 }
        );
    }
}

// Function to upload image to GitHub
async function uploadImageToGitHub(binaryData: Uint8Array, token: string): Promise<{ path: string, commitHash: string }> {
    const owner = process.env.GITHUB_OWNER!;
    const repo = process.env.GITHUB_REPO!;
    const branch = process.env.GITHUB_BRANCH || 'main'
    const path = `/assets/img_${Date.now()}.png`; // Generate a unique path for the image
    const githubPath = 'public'+path;

    // Convert Uint8Array to Base64
    const base64String = Buffer.from(binaryData).toString('base64'); // Use Buffer to convert to Base64
    const currentFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${githubPath}?ref=${branch}`
    // Use fetch to upload the file to GitHub
    const response = await fetch(currentFileUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
            message: `Upload ${githubPath}`,
            content: base64String, // Send only the Base64 string
            branch: branch, // Explicitly specify the branch
        }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to upload image to GitHub:', errorData);
        throw new Error(`Failed to upload image to GitHub: ${errorData.message || 'Unknown error'}`);
    }

    const responseData = await response.json();
    const commitHash = responseData.commit.sha; // 获取 commit hash

    return { path, commitHash }; // Return the URL of the uploaded image
}

export async function DELETE(request: Request) {
    const useDatabase = process.env.D1_DATABASE_ENABLED === 'true' && (request as any).env?.DB;
    
    try {
        const session = await auth();
        if (!session?.user?.accessToken && !useDatabase) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { resourceHashes } = await request.json();
        
        if (!Array.isArray(resourceHashes) || resourceHashes.length === 0) {
            return NextResponse.json({ error: 'Invalid resource hashes' }, { status: 400 });
        }

        let deletedCount = 0;
        if (useDatabase) {
            // 使用数据库删除资源元数据
            const dbService = new DatabaseService((request as any).env);
            const result = await dbService.deleteResourceMetadata(resourceHashes);
            deletedCount = result.deletedCount;
        } else {
            // 使用文件存储方式删除资源元数据
            // 修复类型错误：确保session、session.user和accessToken都存在
            if (!session || !session.user || !session.user.accessToken) {
                return new Response('Unauthorized', { status: 401 });
            }
            
            // 获取当前的资源元数据
            const metadata = await getFileContent('navsphere/content/resource-metadata.json') as ResourceMetadata;
            
            // 过滤掉要删除的资源
            const originalCount = metadata.metadata.length;
            metadata.metadata = metadata.metadata.filter(item => !resourceHashes.includes(item.hash));
            deletedCount = originalCount - metadata.metadata.length;

            // 更新资源元数据文件
            await commitFile(
                'navsphere/content/resource-metadata.json',
                JSON.stringify(metadata, null, 2),
                `Delete ${deletedCount} resource(s)`,
                session.user.accessToken
            );
        }

        // 注意：这里只是从元数据中删除了引用，实际的图片文件仍然存在于GitHub仓库中
        // 如果需要删除实际文件，需要额外的GitHub API调用

        return NextResponse.json({ 
            success: true, 
            deletedCount,
            message: `成功删除 ${deletedCount} 个资源` 
        });
    } catch (error) {
        console.error('Failed to delete resources:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete resources' },
            { status: 500 }
        );
    }
}