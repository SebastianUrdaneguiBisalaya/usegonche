import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser } from '~/features/auth/api';

interface SessionState {
	clearUser: () => void;
	setUser: (user: AuthUser) => void;
	/** Who is signed in. The tokens are httpOnly cookies the page cannot read; the API stays the source of truth. */
	user: AuthUser | null;
}

/** The signed-in user, persisted so a reload keeps the UI signed in until the API answers 401. */
export const useSessionStore = create<SessionState>()(
	persist(
		set => ({
			clearUser: () => {
				set({
					user: null,
				});
			},
			setUser: user => {
				set({
					user,
				});
			},
			user: null,
		}),
		{
			name: 'ui-session',
			partialize: state => ({
				user: state.user,
			}),
			storage: createJSONStorage(() => localStorage),
		}
	)
);
