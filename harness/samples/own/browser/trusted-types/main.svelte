<script>
	import { createRawSnippet } from 'svelte';

	let { shown, markup } = $props();

	const raw = createRawSnippet(() => ({ render: () => '<b>raw</b>' }));
</script>

<p>hello</p>
<div>{@html markup}</div>
{@render raw()}
<select><option><span>rich</span></option></select>
{#if shown}<em>later</em>{/if}
