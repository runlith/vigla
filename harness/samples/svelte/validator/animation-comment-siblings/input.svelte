<script>
	let { things } = $props();
	function foo() {}
</script>

{#each things as thing (thing)}
	<!-- some comment -->
	<div animate:foo></div>
{/each}