<script>
	import { onMount } from 'svelte';
	import { fromStore, readonly, writable } from 'svelte/store';

	const count = writable(0);
	const mirror = readonly(count);
	const observed = fromStore(count);
	const reset = writable(0);

	onMount(() => reset.subscribe(() => {
		count.set(0);
		console.log([$count, $mirror, observed.current].join('|'));
	}));
</script>

<button onclick={() => count.update(value => value + 1)}>increment</button>
<button onclick={() => reset.update(value => value + 1)}>reset</button>
<p>{[$count, $mirror, observed.current].join('|')}</p>
