<svelte:options customElement="custom-element" />

<script>
	import "./my-widget.svelte";

	let { items = ["a", "b", "c"], flagged = false } = $props();
</script>

<my-widget class="foo" {items} flag1={flagged} flag2></my-widget>
