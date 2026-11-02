<script>
	import { crossfade } from 'svelte/transition';
	import { quadIn } from 'svelte/easing';

	let { known = false } = $props();
	let moved = $state(false);
	const events = [];
	let display;
	function record(event) {
		events.push(event);
		display.textContent = JSON.stringify(events);
	}
	const [send, receive] = crossfade({
		fallback(node, params, intro) {
			record({ phase: 'fallback', key: params.key, role: intro ? 'in' : 'out' });
			node.dataset.fallbackCalls = Number(node.dataset.fallbackCalls ?? 0) + 1;
			return { duration: 200, delay: 7, easing: quadIn,
				css: (t) => `opacity:${t};`,
				tick: (t) => { node.dataset.fallback = t; } };
		}
	});
	function wrapped(half, node, params, eager, role) {
		let calls = 0;
		const settings = { ...params, delay: 7, easing: quadIn, duration(distance) {
			calls += 1;
			record({ phase: 'duration', key: params.key, role, distance, calls });
			node.dataset.distance = distance;
			return 100 + distance;
		} };
		const resolver = eager ? half(node, settings) : null;
		return (options) => {
			record({ phase: 'before', key: params.key, role });
			const config = (resolver ?? half(node, settings))(options);
			const duration = config.duration;
			const delay = config.delay;
			const easing = config.easing;
			const css = config.css;
			const tick = config.tick;
			node.dataset.calls = calls;
			node.dataset.duration = duration;
			node.dataset.delay = delay;
			node.dataset.easing = easing === quadIn ? 1 : 0;
			const result = { ...config, duration: duration * 2, delay, easing,
				css: (t, u) => `${css(t, u)} outline-width:${t * 10}px; outline-style:solid;`,
				tick: (t, u) => { tick?.(t, u); node.dataset.sample = t; } };
			record({ phase: 'after', key: params.key, role });
			return result;
		};
	}
	function outgoing(node, params) { return wrapped(send, node, params, known, 'out'); }
	function incoming(node, params) { return wrapped(receive, node, params, true, 'in'); }
</script>

<button onclick={() => { moved = !moved; }}>Move</button>
<div style="display:flex;align-items:flex-start;gap:120px">
	<div data-side="left" style="position:relative;width:100px;min-height:40px">
		{#each moved ? [] : [1] as key (key)}
			<div data-key={key} style="opacity:1;width:100px;height:40px" out:outgoing={{ key }}>source</div>
		{/each}
	</div>
	<div data-side="right" style="position:relative;width:100px;min-height:40px">
		{#each moved ? [1] : [] as key (key)}
			<div data-key={key} style="opacity:1;width:100px;height:40px" in:incoming={{ key }}>target</div>
		{/each}
	</div>
</div>
{#if !moved}
	<i data-unmatched style="opacity:1" out:outgoing={{ key: 'unmatched' }}>fallback</i>
{/if}
<output data-configs bind:this={display}></output>
