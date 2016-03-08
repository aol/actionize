import expect from 'expect';
import Immutable from 'immutable';
import * as actionize from '../src/index';

describe('actionize', () => {

	describe('reducer', () => {

		it('defaults to initial state', () => {
			const initialState = { foo: 'bar' };
			const reducer = actionize.reducer('reducer1', initialState, {});
			const value = reducer();
			expect(value).toEqual(initialState);
		});

		it('rejects invalid names', () => {
			const action = (state, action) => state;
			const actions = { action };
			expect(() => actionize.reducer({}, {}, actions)).toThrow(/namespace must be a string/);
			expect(() => actionize.reducer('|foo', {}, actions)).toThrow(/namespace cannot contain characters/);
			expect(() => actionize.reducer('foo:bar', {}, actions)).toThrow(/namespace cannot contain characters/);
			expect(() => actionize.reducer('foo#bar', {}, actions)).toThrow(/namespace cannot contain characters/);
			expect(() => actionize.reducer('red1', {}, {'foo:bar':action})).toThrow(/key cannot contain characters/);
			expect(() => actionize.reducer('red2', {}, {'foo#bar':action})).toThrow(/key cannot contain characters/);
			expect(() => actionize.reducer('red3', {}, {'foo.bar':action})).toThrow(/key cannot contain characters/);
		});

		it('handles actions properly', () => {
			const initialState = { foo: 'bar' };
			const reducer = actionize.reducer('reducer2', initialState, {
				setBaz: (state, action) => ({ ...state, baz: action.baz })
			});
			const value = reducer(initialState, { type: reducer.setBaz.type, baz: 'something' });
			expect(value).toEqual({ foo: 'bar', baz: 'something' });
		});

		it('exposes direct action handlers', () => {
			const initialState = { foo: 'bar' };
			const reducer = actionize.reducer('reducer3', initialState, {
				setBaz: (state, action) => ({ ...state, baz: action.baz })
			});
			expect(reducer.setBaz).toBeA('function');
			expect(reducer.setBaz(initialState, { baz: 'something' })).toEqual({ foo: 'bar', baz: 'something' });
		});

		it('ensures action types do not collide', () => {
			const initialState = { foo: 'bar' };
			const reducer1 = actionize.reducer('reducer.dupe', initialState, { foo: (state, action) => state });
			const reducer2 = actionize.reducer('reducer.dupe', initialState, { foo: (state, action) => state });
			expect(reducer1.foo.type).toNotBe(reducer2.foo.type)
		});

		it('allows handling external actions', () => {
			const initialState = { foo: 'bar' };
			const reducer1 = actionize.reducer('reducer.ext1', initialState, {
				foo: (state, action) => state
			});
			const reducer2 = actionize.reducer('reducer.ext2', initialState, {
				[reducer1.foo.type]: (state, action) => ({ ...state, baz: action.baz })
			});
			const value = reducer2(undefined, { type: reducer1.foo.type, baz: 'something' });
			expect(value).toEqual({ foo: 'bar', baz: 'something' });
		});

		it('allows handling multiple external actions', () => {
			const initialState = { foo: 'bar' };
			const reducer1 = actionize.reducer('reducer.ext1', initialState, {
				foo1: (state, action) => state,
				foo2: (state, action) => state
			});
			const reducer2 = actionize.reducer('reducer.ext2', initialState, {
				[reducer1.foo1.type + reducer1.foo2.type]: (state, action) => ({ ...state, baz: action.baz })
			});
			const value1 = reducer2(undefined, { type: reducer1.foo1.type, baz: 'val1' });
			const value2 = reducer2(undefined, { type: reducer1.foo1.type, baz: 'val2' });
			expect(value1).toEqual({ foo: 'bar', baz: 'val1' });
			expect(value2).toEqual({ foo: 'bar', baz: 'val2' });
		});
	});

	describe('dispatcher', () => {

		it('works with a reducer', () => {
			const reducer = actionize.reducer('dispatcher1', {}, {
				foo: (state, action) => 'foo' + action.text,
				bar: (state, action) => 'bar' + action.text
			});
			const dispatched = [];
			const dispatcher = actionize.dispatcher(
				reducer,
				action => dispatched.push(reducer('state', action))
			);
			dispatcher.foo({ text: 'baz' });
			dispatcher.bar({ text: 'qux' });
			expect(dispatched).toEqual(['foobaz', 'barqux']);
		});

		it('works with actions and objects', () => {
			const reducer = actionize.reducer('dispatcher2', {}, {
				foo: (state, action) => 'foo' + action.text,
				bar: (state, action) => 'bar' + action.text
			});
			const dispatched = [];
			const dispatcher = actionize.dispatcher(
				{
					r1: reducer,
					customName1: reducer.foo,
					customName2: {
						customName3: reducer.bar
					}
				},
				action => dispatched.push(reducer('state', action))
			);
			dispatcher.r1.foo({ text: '1' });
			dispatcher.r1.bar({ text: '2' });
			dispatcher.customName1({ text: '3' });
			dispatcher.customName2.customName3({ text: '4' });
			expect(dispatched).toEqual(['foo1', 'bar2', 'foo3', 'bar4']);
		});
	});

	describe('handle', () => {

		it('works with strings', () => {
			const reducer = actionize.reducer('handle1', {}, {
				foo: (state, action) => state,
				bar: (state, action) => state
			});
			const value = actionize.handle(reducer.foo.type, reducer.bar.type);
			expect(value).toEqual('|handle1:foo|handle1:bar');
		});

		it('works with action handlers', () => {
			const reducer = actionize.reducer('handle2', {}, {
				foo: (state, action) => state,
				bar: (state, action) => state
			});
			const value = actionize.handle(reducer.foo, reducer.bar);
			expect(value).toEqual('|handle2:foo|handle2:bar');
		});

		it('works with reducers', () => {
			const reducer1 = actionize.reducer('h3', {}, {
				foo: (state, action) => state,
				bar: (state, action) => state
			});
			const reducer2 = actionize.reducer('h4', {}, {
				baz: (state, action) => state,
				qux: (state, action) => state
			});
			const value = actionize.handle(reducer1, reducer2);
			expect(value).toEqual('|h3:foo|h3:bar|h4:baz|h4:qux');
		});
	});

	describe('combine', () => {

		const reducerPlain1 = actionize.reducer('c1', { c1: true }, {
			foo: (state, action) => ({ ...state, foo: true })
		});
		const reducerPlain2 = actionize.reducer('c2', { c2: true }, {
			bar: (state, action) => ({ ...state, bar: true })
		});

		function testCombinedPlain(combinedReducer) {
			let state = combinedReducer();
			expect(state).toEqual({ r1: { c1: true }, r2: { c2: true } });
			state = combinedReducer(state, { type: reducerPlain1.foo.type });
			expect(state).toEqual({ r1: { c1: true, foo: true }, r2: { c2: true } });
			state = combinedReducer(state, { type: reducerPlain2.bar.type });
			expect(state).toEqual({ r1: { c1: true, foo: true }, r2: { c2: true, bar: true } });
			state = combinedReducer(state, { type: '|no-handler' });
			expect(state).toBe(state);
		}

		const reducerImmutable1 = actionize.reducer('ci1', Immutable.Map({ c1: true }), {
			foo: (state, action) => state.set('foo', true)
		});
		const reducerImmutable2 = actionize.reducer('ci2', Immutable.Map({ c2: true }), {
			bar: (state, action) => state.set('bar', true)
		});

		function testCombinedImmutable(combinedReducer) {
			let state = combinedReducer();
			expect(state.toJS()).toEqual({ r1: { c1: true }, r2: { c2: true } });
			state = combinedReducer(state, { type: reducerImmutable1.foo.type });
			expect(state.toJS()).toEqual({ r1: { c1: true, foo: true }, r2: { c2: true } });
			state = combinedReducer(state, { type: reducerImmutable2.bar.type });
			expect(state.toJS()).toEqual({ r1: { c1: true, foo: true }, r2: { c2: true, bar: true } });
			state = combinedReducer(state, { type: '|no-handler' });
			expect(state).toBe(state);
		}

		it('works', () => {
			testCombinedPlain(actionize.combine(
				{ r1: reducerPlain1, r2: reducerPlain2 },
				(state, key) => state && state[key],
				(state, values) => values
			));
		});

		it('(plain) works', () => {
			testCombinedPlain(actionize.combine.plain({
				r1: reducerPlain1,
				r2: reducerPlain2
			}));
		});

		it('(immutable) works', () => {
			testCombinedImmutable(actionize.combine.immutable({
				r1: reducerImmutable1,
				r2: reducerImmutable2
			}, Immutable.Map));
		});

		it('(immutable) throws error without structure', () => {
			expect(() => {
				actionize.combine.immutable({
					r1: reducerImmutable1,
					r2: reducerImmutable2
				})
			}).toThrow(/requires an immutable structure/i);
		});
	});

	describe('nest', () => {

		const reducerPlain1 = actionize.reducer('n1', { n1: true }, {
			foo: (state, action) => ({ ...state, foo: true })
		});
		const reducerPlain2 = actionize.reducer('n2', { n2: true }, {
			bar: (state, action) => ({ ...state, bar: true })
		});

		function testNestPlain(nestedReducer) {
			let state = nestedReducer();
			expect(state).toEqual({ n1: true, r2: { n2: true } });
			state = nestedReducer(state, { type: reducerPlain1.foo.type });
			expect(state).toEqual({ n1: true, foo: true, r2: { n2: true } });
			state = nestedReducer(state, { type: reducerPlain2.bar.type });
			expect(state).toEqual({ n1: true, foo: true, r2: { n2: true, bar: true } });
			state = nestedReducer(state, { type: '|no-handler' });
			expect(state).toBe(state);
		}

		const reducerImmutable1 = actionize.reducer('ni1', Immutable.Map({ n1: true }), {
			foo: (state, action) => state.set('foo', true)
		});
		const reducerImmutable2 = actionize.reducer('ni2', Immutable.Map({ n2: true }), {
			bar: (state, action) => state.set('bar', true)
		});

		function testNestImmutable(nestedReducer) {
			let state = nestedReducer();
			expect(state.toJS()).toEqual({ n1: true, r2: { n2: true } });
			state = nestedReducer(state, { type: reducerImmutable1.foo.type });
			expect(state.toJS()).toEqual({ n1: true, foo: true, r2: { n2: true } });
			state = nestedReducer(state, { type: reducerImmutable2.bar.type });
			expect(state.toJS()).toEqual({ n1: true, foo: true, r2: { n2: true, bar: true } });
			state = nestedReducer(state, { type: '|no-handler' });
			expect(state).toBe(state);
		}

		it('works', () => {
			testNestPlain(actionize.nest(
				reducerPlain1,
				{ r2: reducerPlain2 },
				(state, key) => state && state[key],
				(state, values) => Object.assign({}, state, values)
			));
		});

		it('(plain) works', () => {
			testNestPlain(actionize.nest.plain(reducerPlain1, {  r2: reducerPlain2 }));
		});

		it('(immutable) works', () => {
			testNestImmutable(actionize.nest.immutable(reducerImmutable1, { r2: reducerImmutable2 }));
		});
	});

});