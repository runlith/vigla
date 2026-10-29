<script>
	import Row from './Row.svelte';

	let { host, tick } = $props();
</script>

<Row active={host.active} {tick} />
