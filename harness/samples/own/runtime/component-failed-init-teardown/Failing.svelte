<script>
	import { onDestroy } from 'svelte';
	onDestroy(() => console.log('released'));
	throw new Error('init failed');
</script>
