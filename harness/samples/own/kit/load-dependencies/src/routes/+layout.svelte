<script>
	import { afterNavigate } from '$app/navigation';
	let { children } = $props();
	let ready = $state(false);
	afterNavigate(() => { ready = true; });
</script>

<main data-ready={ready}>
	{@render children()}
</main>
