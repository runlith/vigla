<script>
	import { aboutData } from '../about.remote.js';
</script>

<p id="value">{await aboutData()}</p>
