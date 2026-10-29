<script>

	import Widget from './Widget.svelte';

	let { widget, foo = 42 } = $props();
</script>

<div><Widget bind:this={widget} foo='{foo}'/></div>
