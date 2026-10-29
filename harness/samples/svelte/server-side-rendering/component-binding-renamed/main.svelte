<script>
	import Foo from './Foo.svelte';

	let { x, y } = $props();
</script>

{y}<Foo bind:x={y}/>{y}
