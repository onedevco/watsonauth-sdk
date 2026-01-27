import { NextRequest, NextResponse } from 'next/server';

declare function createWatsonAuthProxy({ initPublicPaths }: {
    initPublicPaths?: string[];
}): (request: NextRequest) => Promise<NextResponse<unknown>>;

export { createWatsonAuthProxy };
