<script>
	import { beforeNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();
	let paths = $state([]);
	beforeNavigate(({ to }) => paths.push(to.url.pathname));
	onMount(() => {
		document.body.dataset.hydrated = 'yes';
	});
</script>

<a href="https://download.test/file.pdf">download</a>
<a href="/about">about</a>
<p id="paths">{paths.join('|')}</p>
{@render children()}
