<script>
	import { afterNavigate } from '$app/navigation';

	let count = $state(0);

	afterNavigate(() => {
		count += 1;
	});
</script>

<!-- svelte-ignore a11y_missing_attribute -->
<a data-testid="count">count: {count}</a>
