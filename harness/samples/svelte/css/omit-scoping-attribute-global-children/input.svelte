<script>
	let { unknown1 = 'root', unknown2 = 'whatever' } = $props();

</script>

<style>
	.root :global(p) {
		color: red;
	}
</style>

<div class={unknown1}>
	<section class={unknown2}>
		<!-- injected somehow -->
	</section>
</div>
