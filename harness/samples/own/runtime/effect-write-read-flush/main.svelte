<script>
	import { flushSync } from 'svelte';

	let shown = $state(false);
	let seen = $state(0);

	$effect(() => {
		if (!shown) return;
		let x = $state(0);
		$effect(() => {
			if (x === 0) {
				x = 1;
				flushSync();
			}
			seen = x;
		});
	});
</script>

<button onclick={() => (shown = true)}>reveal</button>
<p>{seen}</p>
