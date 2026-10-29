<svelte:options customElement="my-app" />

<script>
	import { onMount } from "svelte";

	let { prop = false, propsInitialized = $bindable(), wasCreated = $bindable() } = $props();

	onMount(() => {
		propsInitialized = prop !== false;
		wasCreated = true;
	});
</script>
