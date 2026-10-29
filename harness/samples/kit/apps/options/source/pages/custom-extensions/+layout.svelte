<script>
	import { goto, preloadCode, preloadData } from '$app/navigation';

	if (typeof window !== 'undefined') {
		Object.assign(window, { goto, preloadCode, preloadData });
	}
	let { children } = $props();
</script>

{@render children?.()}

<footer>Custom layout</footer>
