import { NextRequest, NextResponse } from 'next/server';

type WatsonUser = {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
};
declare function createUserGET(): (request: NextRequest) => Promise<NextResponse<{
    user: null;
}> | NextResponse<{
    user: WatsonUser;
}>>;

export { createUserGET };
