<script>
	let { readonly, readonlyWithDefault = 1, binding = $bindable() } = $props();
</script>

<p>
	readonly: {readonly}
	readonlyWithDefault: {readonlyWithDefault}
	binding: {binding}
</p>

<button onclick={() => {
	binding = 5;
}}>set bindings to 5</button>

<button onclick={() => {
	binding = undefined;
}}>set bindings to undefined</button>
