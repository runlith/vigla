export const ledgers = [];

export class Ledger {
	stored = $state.raw(undefined);

	constructor() {
		ledgers.push(this);
	}

	get answer() {
		return this.stored;
	}

	settle(answer) {
		this.stored = answer;
	}
}

export function settleAll(answer) {
	for (const ledger of ledgers) ledger.settle(answer);
}

export class Player {
	constructor(ledger) {
		this.ledger = ledger;
	}

	get blocker() {
		return this.ledger.answer === undefined ? 'loading' : undefined;
	}
}

class Machine {
	player = $state(undefined);
	blocker = $derived(this.player?.blocker);
}

export const machine = new Machine();

let release = () => {};

export const chunk = new Promise((resolve) => {
	release = resolve;
});

export function open() {
	release();
}
