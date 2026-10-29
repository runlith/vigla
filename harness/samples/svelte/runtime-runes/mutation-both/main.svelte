<script>
  let count = $state(0);
  const multiplier = () => {
    let multiplier = $state(2);
    let multiple = $derived(count * multiplier);

    return {
      get count() {
        return multiple;
      },
      get multiplier() {
        return multiplier;
      },
      inc: () => multiplier++,
    };
  };
  const multiplied = multiplier();
</script>

<span>{count} * {multiplied.multiplier} = {multiplied.count}</span>
<button onclick={multiplied.inc}>Increase multiplier</button>
<button onclick={() => count++}>Increase count</button>
