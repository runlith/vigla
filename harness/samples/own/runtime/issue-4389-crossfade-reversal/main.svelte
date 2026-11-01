<script>
	import { crossfade } from 'svelte/transition';

	let position = $state(0);
	let fallbacks = $state(0);
	const [send, receive] = crossfade({
		duration: 2000,
		fallback() {
			fallbacks += 1;
			return { duration: 2000 };
		}
	});
</script>

<button onclick={() => (position += 1)}>Move</button>
<output>{fallbacks}</output>
{#each position % 2 === 0 ? [1] : [] as item (item)}
	<div in:receive={{ key: item }} out:send={{ key: item }}>box</div>
{/each}
{#each position % 2 === 1 ? [1] : [] as item (item)}
	<div in:receive={{ key: item }} out:send={{ key: item }}>box</div>
{/each}
