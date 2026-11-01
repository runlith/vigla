<script>
	import { store } from './word.svelte.js';
	let { word } = $props();
	$effect(() => {
		store.set(word);
		return () => store.clear();
	});
</script>
