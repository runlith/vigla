import {
	cell,
	derived,
	effect,
	external,
	pending,
	resource,
	root,
	state,
	type Subscribable
} from 'vigla';
import { h, section } from './dom.ts';
import { api, openRequest } from './services.ts';

const app = root();
const target = document.getElementById('app')!;

target.append(
	h('h1', {}, 'App on the vigla core'),
	h(
		'p',
		{ className: 'muted' },
		'No component compiler and no svelte package: plain TypeScript over vigla.'
	)
);

app.run(() => {
	const count = cell(0);
	const double = derived(() => count.current * 2);
	const button = h('button', { onclick: () => count.current++ });
	const label = h('span', { className: 'muted' });
	effect(() => {
		button.textContent = `clicked ${count.current}`;
		label.textContent = `double: ${double.current}`;
		document.title = `count ${count.current}`;
	});
	target.append(section('cell, derived, effect', button, label));
});

app.run(() => {
	const todos = state([
		{ id: 1, text: 'port the scheduler', done: true },
		{ id: 2, text: 'pass upstream tests', done: true },
		{ id: 3, text: 'ship native TSX', done: false }
	]);
	let next = 4;
	const left = derived(() => todos.current.filter((todo) => !todo.done).length);
	const input = h('input', { placeholder: 'new todo' });
	const form = h(
		'form',
		{
			onsubmit: (event: SubmitEvent) => {
				event.preventDefault();
				if (!input.value.trim()) return;
				todos.current.push({ id: next++, text: input.value.trim(), done: false });
				input.value = '';
			}
		},
		input,
		h('button', {}, 'add')
	);
	const list = h('ul');
	const summary = h('p', { className: 'muted' });
	effect(() => {
		list.replaceChildren(
			...todos.current.map((todo) => {
				const box = h('input', { type: 'checkbox', checked: todo.done });
				box.onchange = () => (todo.done = box.checked);
				const remove = h(
					'button',
					{
						onclick: () => (todos.current = todos.current.filter((other) => other !== todo))
					},
					'×'
				);
				return h(
					'li',
					{},
					h('label', {}, box, h('span', { className: todo.done ? 'done' : '' }, todo.text)),
					remove
				);
			})
		);
		summary.textContent = `${left.current} left`;
	});
	target.append(section('state: a deep reactive list', form, list, summary));
});

const query = cell('s');
const hits = await app.run(() => resource(() => api.search(query.current)));

app.run(() => {
	const input = h('input', { value: query.current, placeholder: 'search' });
	input.oninput = () => (query.current = input.value);
	const status = h('p', { className: 'muted' });
	const list = h('ul');
	effect(() => {
		status.textContent = pending() > 0 ? 'searching…' : 'idle';
		const words = hits.current;
		list.replaceChildren(
			...(words.length === 0
				? [h('li', { className: 'muted' }, 'nothing')]
				: words.map((word) => h('li', {}, word)))
		);
	});
	target.append(section('resource: async values outside components', input, status, list));
});

app.run(() => {
	const ticker: Subscribable<Date> = {
		subscribe(run) {
			run(new Date());
			const id = setInterval(() => run(new Date()), 1000);
			return () => clearInterval(id);
		}
	};
	const time = external(() => ticker);
	const clock = h('p');
	effect(() => {
		clock.textContent = time.current.toLocaleTimeString();
	});
	target.append(section('external: a subscribable source under an owner', clock));
});

app.run(() => {
	const lines = state<string[]>([]);
	const journal = { write: (line: string) => lines.current.push(line) };
	let opened: { id: number; owner: ReturnType<typeof openRequest> }[] = [];
	let id = 0;
	const log = h('pre');
	const open = h(
		'button',
		{
			onclick: () => {
				id++;
				opened = [...opened, { id, owner: openRequest(app, id, journal) }];
			}
		},
		'open request (10 service layers)'
	);
	const close = h(
		'button',
		{
			onclick: () => {
				const last = opened.at(-1);
				if (last === undefined) return;
				opened = opened.slice(0, -1);
				last.owner.dispose();
			}
		},
		'dispose newest request'
	);
	const clear = h('button', { onclick: () => (lines.current = []) }, 'clear log');
	effect(() => {
		log.textContent = lines.current.join('\n') || 'empty';
		log.scrollTop = log.scrollHeight;
	});
	target.append(
		section('owners and context: request scopes over a service graph', open, close, clear, log)
	);
});

app.run(() => {
	const fault = cell(false);
	const ticks = cell(0);
	const status = h('p');
	const sibling = h('p', { className: 'muted' });
	const failing = app.root(() => {
		effect(() => {
			if (fault.current) throw new Error('boom');
		});
	});
	failing.onError((error) => {
		status.textContent = `caught by the owner: ${(error as Error).message}`;
	});
	effect(() => {
		sibling.textContent = `sibling effect still runs: ${ticks.current}`;
	});
	target.append(
		section(
			'failure isolation: an owner handler catches, siblings keep working',
			h('button', { onclick: () => (fault.current = true) }, 'make the effect throw'),
			h('button', { onclick: () => ticks.current++ }, 'tick the sibling'),
			status,
			sibling
		)
	);
});
