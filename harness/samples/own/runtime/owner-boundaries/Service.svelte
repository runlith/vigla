<script>
	import { getOwner } from 'vigla';
	import Failure from './Failure.svelte';
	let { state } = $props();
	state.register(getOwner());
</script>

<svelte:boundary>
	<Failure {state} />
</svelte:boundary>
