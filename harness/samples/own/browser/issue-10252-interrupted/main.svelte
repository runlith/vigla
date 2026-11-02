<script>
	import { linear } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	const [send, receive] = crossfade({ duration: 1000, easing: linear });
	const plans = [['b', 'a', 'b', 'a', 'b', 'a'], ['a', 'a', 'b', 'b', 'a', 'b']];
	let step = 0;
	let items = $state([1, 2, 3, 4, 5, 6].map((id, index) => ({ id, team: index < 3 ? 'a' : 'b' })));
	function shuffle() {
		const teams = plans[step++];
		items = items.map((item, index) => ({ ...item, team: teams[index] }));
	}
</script>

<button onclick={shuffle}>shuffle</button>
<div class="board">
	{#each ['a', 'b'] as team}
		<div class="list" data-team={team}>
			{#each items.filter((item) => item.team === team) as item (item.id)}
				<div class="tile" data-id={item.id} in:receive={{ key: item.id }} out:send={{ key: item.id }} animate:flip={{ duration: 1000, easing: linear }}>{item.id}</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.board { width: 600px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
	.list { display: flex; flex-direction: column; gap: 8px; }
	.tile { box-sizing: border-box; height: 32px; background: #9bc; }
</style>
