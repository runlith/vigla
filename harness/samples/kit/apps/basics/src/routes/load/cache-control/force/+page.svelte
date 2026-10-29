<script>
	import { invalidate } from '$app/navigation';

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	async function update() {
		await fetch('/load/cache-control/force/increment');
		invalidate('/load/cache-control/force/count');
	}
</script>

<p class="counter">Count is {data.count}</p>
<button onclick={update}>update</button>
