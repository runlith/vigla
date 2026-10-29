<script>
	import Component from './Component.svelte';

	let props = $state({
		propA: true,
		propB: undefined
	});
</script>

<button onclick={() => {props.propA = !props.propA}}>change propA</button>
<button onclick={() => {props.propB = props.propB ? undefined : 'defined'}}>change propB</button>
<Component {...props}/>
