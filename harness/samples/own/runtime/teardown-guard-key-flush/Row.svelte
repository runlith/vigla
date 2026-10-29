<script>
	let { active, tick } = $props();
</script>

<b class={active === 'one' ? 'on' : 'off'}>{tick}</b>
