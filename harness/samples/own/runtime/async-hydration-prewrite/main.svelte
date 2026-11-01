<script>
	import Layout from './Layout.svelte';
	let { data } = $props();
</script>

<div>{await Promise.resolve('ok')}</div>
<svelte:boundary>
	{#snippet pending()}<span>pending</span>{/snippet}
	<Layout {data} />
</svelte:boundary>
