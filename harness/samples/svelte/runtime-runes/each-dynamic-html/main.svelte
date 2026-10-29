<script>
	let items = $state([]);

	function add_item() {
		items.push({
			id: items.length,
			text: 'Item ' + (items.length + 1),
			html: '<div>Item ' + (items.length + 1) + '</div>',
			dom: null,
		})
	}

	function make_span() {
		items.forEach(item => {
			item.html = item.html.replace(/div/g, 'span')
		})
	}

	function reverse() {
		items.reverse();
	}
</script>

<button onclick={add_item}>add item</button>
<button onclick={make_span}>make span</button>
<button onclick={reverse}>reverse</button>

{#each items as item (item.id)}
	{@html item.html}
{/each}
