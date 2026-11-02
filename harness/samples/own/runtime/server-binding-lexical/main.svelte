<script>
	import Leaf from './Leaf.svelte';
	import Wrapper from './Wrapper.svelte';
	let label = 'ok';
	let value;
	const picked = content;
</script>

{#snippet content()}<p>{label}:{value}</p>{/snippet}
<div>{@render picked()}</div>
<Wrapper><Leaf bind:value /></Wrapper>
<p>{value}</p>
