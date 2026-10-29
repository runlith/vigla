<script>
  let count = $state(0);
  let double = $derived.by(() => count * 2);
</script>

<button onclick={() => count++}>{double}</button>
