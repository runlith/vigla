<script>
	import { invalidate } from '$app/navigation';

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	let ticker = $state(0);
	async function update() {
		ticker += 1;
		await fetch('/load/cache-control/default/increment');
		await invalidate('/load/cache-control/default/count');
		ticker += 1;
	}
</script>

<p class="counter">Count is {data.count}</p>
<button onclick={update} data-ticker={ticker}>update</button>
