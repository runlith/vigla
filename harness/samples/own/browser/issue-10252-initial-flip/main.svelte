<script>
	import { quintOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	const [send, receive] = crossfade({
		fallback(node) {
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;
			return {
				duration: 600,
				easing: quintOut,
				css: (t) => `transform: ${transform} scale(${t}); opacity: ${t}`
			};
		}
	});
	let items = $state([
		{ id: 1, team: 'a', description: 'Dianna' },
		{ id: 2, team: 'a', description: 'Oda' },
		{ id: 3, team: 'a', description: 'Anna' },
		{ id: 4, team: 'b', description: 'Keenan' },
		{ id: 5, team: 'b', description: 'Craig' },
		{ id: 6, team: 'b', description: 'Alyce' }
	]);
	function shuffle() {
		const teams = ['b', 'a', 'b', 'a', 'b', 'a'];
		items = items.map((item, index) => ({ ...item, team: teams[index] }));
	}
</script>

<button onclick={shuffle}>shuffle</button>
<div class="board">
	<div class="left"><h2>Team A</h2><div class="list">
		{#each items.filter((item) => item.team === 'a') as item (item.id)}
			<button data-id={item.id} in:receive={{ key: item.id }} out:send={{ key: item.id }} animate:flip>{item.description}</button>
		{/each}
	</div></div>
	<div class="right"><h2>Team B</h2><div class="list">
		{#each items.filter((item) => item.team === 'b') as item (item.id)}
			<button data-id={item.id} in:receive={{ key: item.id }} out:send={{ key: item.id }} animate:flip>{item.description}</button>
		{/each}
	</div></div>
</div>

<style>
	.board { max-width: 36em; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
	h2 { font-size: 2em; font-weight: 200; user-select: none; }
	button { top: 0; left: 0; display: block; font-size: 1em; line-height: 1; padding: 0.5em; border: none; border-radius: 2px; user-select: none; color: black; text-align: left; }
	.list { display: flex; flex-direction: column; gap: 8px; }
	.left button { background-color: hsl(0, 100%, 83%); }
	.right button { background-color: hsl(231, 100%, 87%); }
</style>
