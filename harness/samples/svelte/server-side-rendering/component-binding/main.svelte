<script>
	import Foo from './Foo.svelte';

	let { x } = $props();
</script>

{x}<Foo bind:x/>{x}
