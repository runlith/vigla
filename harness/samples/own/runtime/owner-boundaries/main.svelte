<script>
	import Service from './Service.svelte';
	let { state } = $props();
</script>

<svelte:boundary onerror={(error) => state.reportOuter(error)}>
	<Service {state} />
</svelte:boundary>
