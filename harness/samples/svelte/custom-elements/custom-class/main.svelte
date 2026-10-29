<svelte:options
	customElement={{
		tag: 'custom-element',
		extend: (CeClass) => {
			return class extends CeClass {
				updateFoo(value) {
					this.foo = value;
				}
			};
		}
	}}
/>

<script>
	export function updateFoo(value) {
		foo = value;
	}

	let { foo } = $props();
</script>

<p>{foo}</p>
