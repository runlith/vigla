<script>
	import { onDestroy } from 'svelte';
	import { held } from './held.svelte.js';
	onDestroy(() => console.log('child onDestroy'));
	held('child module effect');
	$effect(() => () => console.log('child effect'));
</script>
