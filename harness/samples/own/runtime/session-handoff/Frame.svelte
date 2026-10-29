<script>
	import { onDestroy } from 'svelte';
	import { Ledger, Player, chunk, machine } from './world.svelte.js';

	let { user, awaits = false } = $props();

	const ledger = new Ledger();
	if (user) {
		machine.player = new Player(ledger);
		onDestroy(() => {
			machine.player = undefined;
		});
	}
	if (awaits) await chunk;
</script>

<div>{machine.blocker ?? 'ready'}</div>
