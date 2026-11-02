<script>
	import { crossfade } from 'svelte/transition';
	import { linear } from 'svelte/easing';

	const kinds = ['absolute', 'fixed', 'grid', 'flex'];
	const pairs = Object.fromEntries(kinds.map((kind) => [kind, crossfade({ duration: 1000, easing: linear })]));
	let swapped = $state(false);
	let alive = $state(true);
	function send(node, params) { return pairs[params.kind][0](node, params); }
	function receive(node, params) { return pairs[params.kind][1](node, params); }
	function authored(kind, side) {
		const position = kind === 'absolute' || kind === 'fixed' ? kind : 'relative';
		const left = kind === 'fixed' ? (side === 'left' ? 16 : 236) : 7;
		const top = kind === 'fixed' ? 160 : 6;
		return `position:${position}!important;width:70px!important;left:${left}px;top:${top}px;transform:translate(3px,2px);transform-origin:20% 70%!important;margin:2px 3px;box-sizing:border-box`;
	}
</script>

<button data-swap onclick={() => { swapped = !swapped; }}>Swap</button>
<button data-remove onclick={() => { alive = false; }}>Remove</button>
{#if alive}
	{#each kinds as kind}
		<section data-kind={kind}>
			<div class="slot {kind}" data-side="left">
				{#each [swapped ? 2 : 1] as key (key)}
					<div class="tile" data-key={key} style={authored(kind, 'left')} in:receive={{ key, kind }} out:send={{ key, kind }}>{key}</div>
				{/each}
			</div>
			<div class="slot {kind}" data-side="right">
				{#each [swapped ? 1 : 2] as key (key)}
					<div class="tile" data-key={key} style={authored(kind, 'right')} in:receive={{ key, kind }} out:send={{ key, kind }}>{key}</div>
				{/each}
			</div>
		</section>
	{/each}
{/if}

<style>
	section { display: flex; align-items: flex-start; gap: 134px; margin-bottom: 18px; }
	.slot { position: relative; width: 86px; min-height: 54px; }
	.grid { display: grid; gap: 5px; align-content: start; }
	.flex { display: flex; flex-direction: column; gap: 5px; }
	.tile { height: 32px; padding: 3px; border: 2px solid #468; background: #9bc; }
</style>
