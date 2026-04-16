import { NextRequest, NextResponse } from 'next/server';

declare function createCallbackGET(): (request: NextRequest) => Promise<NextResponse<unknown>>;

declare function createLogoutPOST(): () => Promise<NextResponse<{
    success: boolean;
}>>;

declare function createRefreshPOST(): (request: NextRequest) => Promise<NextResponse<{
    code?: string;
    message?: string;
}> | NextResponse<{
    expiresIn: number;
}>>;

export { createCallbackGET, createLogoutPOST, createRefreshPOST };
