<script>
	import { writable } from 'svelte/store';
	const count = writable(0);
	const object = writable({ n: 0 });
	const tail = writable([]);
	let same = $state(false);

	function update() {
		const values = [undefined, 3, 4];
		same = values === ([$count = 2, ...$tail] = values);
	}
</script>

<p>{$count}/{$object.n}/{$tail.join(',')}/{same}</p>
<button onclick={update}>update</button>
<button onclick={() => ([$object.n] = [42])}>object</button>
