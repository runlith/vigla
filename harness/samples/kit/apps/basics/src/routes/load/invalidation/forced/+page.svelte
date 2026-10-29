<script>
	import { refreshAll, goto } from '$app/navigation';

	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<h1>a: {data.a}, b: {data.b}</h1>

<button
	class="refreshall"
	onclick={() => {
		window.promise = refreshAll();
	}}>refresh</button
>

<button
	class="goto"
	onclick={() => {
		window.promise = goto('/load/invalidation/forced?test', { invalidateAll: true });
	}}>goto</button
>
