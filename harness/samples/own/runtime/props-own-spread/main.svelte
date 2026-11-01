<script>
	import Child from './Child.svelte';
</script>

<Child {...{}} />
<Child toString="provided" {...{ extra: 1 }} />
