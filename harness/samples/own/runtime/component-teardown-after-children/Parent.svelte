<script>
	import { onDestroy } from 'svelte';
	import Child from './Child.svelte';
	import { held } from './held.svelte.js';
	held('parent module effect');
	onDestroy(() => console.log('parent onDestroy'));
	$effect(() => () => console.log('parent effect'));
</script>

<Child />
