<script>
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { children } = $props();
	beforeNavigate(({ to }) => sessionStorage.setItem('before', to?.url.pathname ?? ''));
	onMount(() => {
		document.body.dataset.hydrated = 'yes';
	});
</script>

<a id="slug-link" href="/slug/1">slug</a>
<p id="route">{page.route.id}</p>
{@render children()}
