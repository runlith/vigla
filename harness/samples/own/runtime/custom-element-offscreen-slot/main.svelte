<script module>
	if (!customElements.get('offscreen-host')) {
		customElements.define(
			'offscreen-host',
			class extends HTMLElement {
				constructor() {
					super();
					this.attachShadow({ mode: 'open' }).innerHTML =
						'<slot>fallback</slot><slot name="named"></slot>';
				}
			}
		);
	}
</script>

<script>
	let release = () => {};
	const hold = new Promise((resolve) => {
		release = resolve;
	});
	const ready = Promise.resolve('ready');
</script>

<button onclick={() => release('held')}>release</button>
<offscreen-host><svelte:boundary>{#await ready then value}<span slot="named">{value}</span>{/await}<span slot="named">{await hold}</span>{#snippet pending()}<span slot="named">pending</span>{/snippet}</svelte:boundary></offscreen-host>
