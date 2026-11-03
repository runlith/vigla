<script>
	import { onMount } from 'svelte';

	onMount(() => {
		if (location.search === '?auto=1') document.querySelector('#slug-link').click();
	});
</script>

<p>home page</p>
