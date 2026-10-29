<script>
	import { refreshAll } from '$app/navigation';

	let { data } = $props();
</script>

<button onclick={async () => await refreshAll()}>Refresh</button>

{#if data.request}
	<p>data request: {data.request}</p>
{/if}
