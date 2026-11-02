<script>
	import Leaf from './Leaf.svelte';
	let { children } = $props();
	let local = 0;
</script>

<aside><Leaf bind:value={local} />{@render children()}</aside>
