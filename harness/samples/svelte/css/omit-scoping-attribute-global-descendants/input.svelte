<script>
	let { unknown1 = 'root', unknown2 = 'whatever' } = $props();

</script>

<style>
	:global(html) :global(body) .root p {
		color: red;
	}
</style>

<div class={unknown1}>
	<section class={unknown2}>
		<p>hello</p>
	</section>
</div>
