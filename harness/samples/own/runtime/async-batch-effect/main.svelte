<script>
	import Async from './Async.svelte';
	import Sync from './Sync.svelte';
	let x = $state(0);
	let y = $state(0);
</script>

<button onclick={() => { x++; queueMicrotask(() => queueMicrotask(() => y++)); }}>increment</button>
<Async {x} />
<Sync {y} />
