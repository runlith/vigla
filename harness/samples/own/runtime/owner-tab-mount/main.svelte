<script>
	import { getContext } from 'svelte';

	const id = $props.id();
</script>

<p>{getContext('scope') ?? 'none'} {id}</p>
