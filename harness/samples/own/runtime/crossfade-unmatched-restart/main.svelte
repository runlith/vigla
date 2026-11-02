<script>
	import { crossfade } from 'svelte/transition';

	let visible = $state(true);
	let reenter = false;
	let fallbacks = $state(0);
	const [send, receive] = crossfade({
		fallback(node, params, intro) {
			if (intro) return { duration: 0 };
			fallbacks += 1;
			return { duration: 100, tick: (t) => { node.dataset.progress = t; } };
		}
	});
	function leave(node, params) {
		const deferred = send(node, params);
		if (reenter) {
			reenter = false;
			visible = true;
		}
		return deferred;
	}
</script>

<button onclick={() => { visible = !visible; }}>Toggle</button>
<button onclick={() => { reenter = true; visible = false; }}>Cancel</button>
<output>{fallbacks}</output>
{#if visible}
	<div in:receive={{ key: 1 }} out:leave={{ key: 1 }} style="position: relative !important; width: 70px">row</div>
{/if}
