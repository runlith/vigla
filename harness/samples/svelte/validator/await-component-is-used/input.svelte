<script>
	import Component from './Component.svelte';

	let { promise } = $props();
</script>

{#await promise}
	<p>Loading</p>
{:then data}
	<Component {data} />
{:catch err}
	<p>Error: {err}</p>
{/await}
