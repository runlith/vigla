class StaleReactionError extends Error {
	constructor() {
		super('The reaction that called `getAbortSignal()` was re-run or destroyed');
		this.name = 'StaleReactionError';
	}
}

export const staleReaction = new StaleReactionError();
