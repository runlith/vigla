<script>
    let items = $state([{a: 0}]);
    let start = $state.snapshot(items);
</script>

{JSON.stringify(start)}
<button onclick={() => items.push({a: items.length})}>{JSON.stringify(structuredClone($state.snapshot(items)))}</button>
