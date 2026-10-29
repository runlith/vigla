<script>
	import Component from "./Component.svelte";
	import Button from "./Button.svelte";
</script>

<Component onclick={() => console.log('outer div onclick')}>
	<Component onclick={() => console.log('inner div on:click')}>
		<Button onclick={() => { console.log('button on:click'); console.log('button onclick'); }}>main</Button>
	</Component>
</Component>
