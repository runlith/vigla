<script>
	import Grandchild from './Grandchild.svelte';
	let { value = $bindable() } = $props();
</script>

<Grandchild bind:value />
