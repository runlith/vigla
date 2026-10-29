<script lang="ts">
	let { backgroundColor = 255, ...rest } = $props();
</script>

<div style:background-color="rgb({backgroundColor}, 0, 0)" {...rest}></div>
