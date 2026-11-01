let current = $state({ word: null });

export const store = {
	get word() { return current.word; },
	set(word) { current = { word }; },
	clear() { current = { word: null }; }
};
