<script>
	import Frame from './Frame.svelte';
	let { model, held } = $props();
</script>

<p>{model.count}</p>
<Frame {model} {held} />
