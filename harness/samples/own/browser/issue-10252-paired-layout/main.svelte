<script>
	import { crossfade } from 'svelte/transition';
	import { linear } from 'svelte/easing';

	const pairs = {
		plain: crossfade({ duration: 1000, easing: linear }),
		wrapped: crossfade({ duration: 1000, easing: linear }),
		opaque: crossfade({ duration: 1000, easing: linear })
	};
	let swapped = $state(false);
	function send(node, params) {
		return pairs[params.mode][0](node, params);
	}
	function receive(node, params) {
		if (params.mode === 'wrapped') {
			const resolve = pairs.wrapped[1](node, params);
			return (options) => resolve(options);
		}
		if (params.mode === 'opaque') return () => pairs.opaque[1](node, params)();
		return pairs[params.mode][1](node, params);
	}
</script>

<button onclick={() => { swapped = !swapped; }}>Swap</button>
{#each ['plain', 'wrapped', 'opaque'] as mode}
	<section data-mode={mode}>
		<div class="slot" data-side="left">
			{#each [swapped ? 2 : 1] as key (key)}
				<div class="tile" data-key={key} in:receive={{ key, mode }} out:send={{ key, mode }}>{key}</div>
			{/each}
		</div>
		<div class="slot" data-side="right">
			{#each [swapped ? 1 : 2] as key (key)}
				<div class="tile" data-key={key} in:receive={{ key, mode }} out:send={{ key, mode }}>{key}</div>
			{/each}
		</div>
	</section>
{/each}

<style>
	section { display: flex; align-items: flex-start; gap: 120px; margin-bottom: 20px; }
	.slot { position: relative; width: 100px; min-height: 40px; }
	.tile { box-sizing: border-box; width: 100px; height: 40px; background: #579; }
</style>
