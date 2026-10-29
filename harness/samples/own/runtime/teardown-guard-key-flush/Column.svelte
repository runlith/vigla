<script>
	import { flushSync, onDestroy } from 'svelte';
	import Row from './Row.svelte';

	let { host, tick } = $props();

	onDestroy(() => flushSync());
</script>

<Row active={host.active} {tick} />
