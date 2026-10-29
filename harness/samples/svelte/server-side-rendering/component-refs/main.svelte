<script>
	let { widget } = $props();

	import Widget from './Widget.svelte';
</script>

<div><Widget bind:this={widget}/></div>
