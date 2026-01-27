import { NextRequest, NextResponse } from 'next/server';

declare function createCallbackGET(): (request: NextRequest) => Promise<NextResponse<unknown>>;

declare function createLogoutPOST(): () => Promise<NextResponse<{
    success: boolean;
}>>;

export { createCallbackGET, createLogoutPOST };
