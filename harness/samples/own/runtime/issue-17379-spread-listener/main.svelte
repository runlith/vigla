<script>
	let show = $state(true);
	let revision = $state(0);
	let count = $state(0);
	const a = () => count += 1;
	const b = () => count += 10;
	const explicit = () => count += 100;
	const dynamic = () => count += 1000;
	const handlers = [a, a, b, a, undefined, a];
</script>

<button data-control="update" onclick={() => revision++}>update</button>
<button data-control="hide" onclick={() => show = false}>hide</button>
<p>{count}</p>
{#if show}
	<button data-item="spread" {...{ onclick: handlers[revision], title: revision }}>spread</button>
	<button data-item="explicit" {...{ title: revision }} onclick={explicit}>explicit</button>
	<svelte:element this="button" data-item="dynamic" onclick={dynamic}>dynamic</svelte:element>
{/if}
