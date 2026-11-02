<script>
	import { crossfade } from 'svelte/transition';
	import { linear } from 'svelte/easing';

	const cases = ['late', 'own', 'channel', 'authored'];
	const pairs = Object.fromEntries(cases.map((name) => [name, crossfade({ duration: 1000, easing: linear })]));
	let moved = $state(false);
	let late = $state(false);
	let seeded = $state(false);
	const send = (node, params) => pairs[params.name][0](node, params);
	const receive = (node, params) => pairs[params.name][1](node, params);
	function slide(node) {
		return { duration: 2000, easing: linear, css: (t) => `translate: ${(1 - t) * 100}px 0px` };
	}
</script>

<button data-seed onclick={() => { seeded = true; }}>Seed</button>
<button data-move onclick={() => { moved = !moved; late = true; }}>Move</button>

<section data-case="late">
	<div class="stage" style:transform={late ? 'scale(1.5)' : 'none'}>
		<div class="slot">{#each moved ? [] : [1] as key (key)}<div class="tile" data-key="late" in:receive={{ key, name: 'late' }} out:send={{ key, name: 'late' }}></div>{/each}</div>
		<div class="slot">{#each moved ? [1] : [] as key (key)}<div class="tile" data-key="late" in:receive={{ key, name: 'late' }} out:send={{ key, name: 'late' }}></div>{/each}</div>
	</div>
</section>

<section data-case="own">
	<div class="stage" style="transform: scale(2)">
		<div class="slot">{#each moved ? [] : [1] as key (key)}<div class="tile" data-key="own" in:receive={{ key, name: 'own' }} out:send={{ key, name: 'own' }}></div>{/each}</div>
	</div>
	<div class="stage">
		<div class="slot">{#each moved ? [1] : [] as key (key)}<div class="tile" data-key="own" style="transform: scale(2)" in:receive={{ key, name: 'own' }} out:send={{ key, name: 'own' }}></div>{/each}</div>
	</div>
</section>

<section data-case="channel">
	<div class="stage">
		<div class="slot">{#each seeded && !moved ? [1] : [] as key (key)}<div class="tile" data-key="channel" in:slide out:send={{ key, name: 'channel' }}></div>{/each}</div>
		<div class="slot">{#each !seeded || moved ? [1] : [] as key (key)}<div class="tile" data-key="channel" in:receive={{ key, name: 'channel' }} out:send={{ key, name: 'channel' }}></div>{/each}</div>
	</div>
</section>

<section data-case="authored">
	<div class="stage" style="transform: perspective(600px) rotateY(20deg)">
		<div class="slot">{#each moved ? [] : [1] as key (key)}<div class="tile fading" data-key="authored" class:dim={seeded} in:receive={{ key, name: 'authored' }} out:send={{ key, name: 'authored' }}></div>{/each}</div>
		<div class="slot">{#each moved ? [1] : [] as key (key)}<div class="tile" data-key="authored" in:receive={{ key, name: 'authored' }} out:send={{ key, name: 'authored' }}></div>{/each}</div>
	</div>
</section>

<style>
	section { margin-bottom: 30px; }
	.stage { display: flex; gap: 60px; transform-origin: top left; }
	.slot { width: 60px; min-height: 30px; }
	.tile { width: 60px; height: 30px; background: #579; transform-origin: top left; }
	.fading { transition: background-color 5s linear; }
	.dim { background: #fff; }
</style>
