import cluster from 'node:cluster';
import process from 'node:process';

const workers = Number(process.env.WORKERS ?? 3);

if (cluster.isPrimary) {
	let listening = 0;
	cluster.on('listening', () => {
		listening++;
		if (listening === workers) console.log('ready');
		else cluster.fork();
	});
	cluster.fork();
} else {
	await import('../build/index.js');
}
