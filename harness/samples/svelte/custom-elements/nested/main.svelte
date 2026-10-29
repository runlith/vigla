<svelte:options customElement="my-app" />

<script>
	import { setContext } from "svelte";
	import Counter from "./Counter.svelte";

	let { count = 0, counter } = $props();

	setContext("context", "works");
</script>

<Counter bind:count bind:this={counter}>
	<span>slot {count}</span>
</Counter>
<p>clicked {count} times</p>
