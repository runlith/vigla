<script>
	import Child from './Child.svelte';
	let { value } = $props();
	let calls = 0;
	function tag(strings, next) {
		calls += 1;
		return { first: next, second: next };
	}
	export function count() { return calls; }
</script>

{#snippet row(arg)}<p>{arg.first}/{arg.second}</p>{/snippet}
{@render row(tag`${value}`)}
<Child {...tag`${value}`} />
