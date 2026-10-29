<script>
  let { id } = $props();
</script>

<div {id}>
  <p>Slider</p>
  <span>Track</span>
</div>

<style>
  p {
    color: var(--rail-color);
  }
  span {
    color: var(--track-color);
  }
</style>