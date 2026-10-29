<svelte:options customElement="custom-element" />

<script>
	let { name, events = [] } = $props();

	function action(_node, name) {
		events.push(name);
		return {
			update(name) {
				events.push(name);
			},
			destroy() {
				events.push("destroy");
			},
		};
	}
</script>

<div use:action={name}>action</div>
