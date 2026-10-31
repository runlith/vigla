<script>
	import { writable } from 'svelte/store';
	import Child from './Child.svelte';
	const value = writable({ n: 0 });
</script>

<Child bind:value={$value} />
<p>{$value.n}</p>
