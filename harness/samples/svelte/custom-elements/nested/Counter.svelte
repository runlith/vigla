<svelte:options customElement="my-counter" />

<script>
	import { getContext } from "svelte";

	let { count = $bindable(0) } = $props();

	const context = getContext("context");
</script>

<slot />
<button onclick={() => (count += 1)}>count: {count}</button>
<p>Context {context}</p>

<style>
	button {
		color: red;
	}
</style>
