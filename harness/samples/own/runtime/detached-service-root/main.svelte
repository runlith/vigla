<script>
	import { service } from './service.svelte.js';

	let alive = $state(true);
	let built;

	$effect(() => {
		if (!alive) return;
		built ??= service();
		built.bump(1);
	});
</script>

<button onclick={() => (alive = false)}>drop</button>
<button onclick={() => built.bump(2)}>bump</button>
