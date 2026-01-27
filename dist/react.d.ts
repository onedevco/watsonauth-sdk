export { UserProfileDropdown } from './Logout.js';
import 'react/jsx-runtime';

type WatsonUser = {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
};
type UseWatsonUserOptions = {
    endpoint?: string;
    auto?: boolean;
};
type UseWatsonUserResult = {
    user: WatsonUser | null;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};
declare function useWatsonUser(options?: UseWatsonUserOptions): UseWatsonUserResult;

export { useWatsonUser };
