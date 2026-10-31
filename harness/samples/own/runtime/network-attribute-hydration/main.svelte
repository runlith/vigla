<script>
	let { src, srcset, ignored } = $props();
</script>

<img {...{ src, srcset }} alt="" />
<!-- svelte-ignore hydration_attribute_changed -->
<img {...{ src: ignored }} alt="" />
