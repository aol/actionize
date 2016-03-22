import expect from 'expect';
import Immutable from 'immutable';
import ActionizeBuild from '../src/ActionizeBuild';

describe('ActionizeBuild', () => {

	describe('reducer', () => {

		it('creates new action handlers properly', () => {
			const b = new ActionizeBuild('foo');
			const r = b.reducer(null, { a1: state => state });
			expect(r.a1).toBeA('function');
			expect(r.a1.type).toEqual('|foo:a1');
		});

		it('uses existing action handlers properly', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => state });
			const r2 = b.reducer(null, { [r1.a1.type]: (state, action) => action.x });
			expect(r2(null, { type: r1.a1.type, x: 'foo' })).toEqual('foo');
		});

		it('returns given state when there are no matching handlers', () => {
			const b = new ActionizeBuild('foo');
			const r = b.reducer('init', { a: state => 'mod' });
			expect(r('given', { type: '|foo:b' })).toEqual('given');
		});

		it('receives context correctly', () => {
			const b = new ActionizeBuild('foo', { context: () => ({ yo: 'sup' }) });
			const r = b.reducer(null, { a() { return this.yo; } });
			expect(r.a()).toEqual('sup');
		});

		it('ignores non-function properties on reducer', () => {
			const b = new ActionizeBuild('foo');

			const r = b.reducer({ r1: true }, {
				setBar: (state, action) => Object.assign({}, state, { bar: action.bar }),
				notAFunction1: 123,
				notAFunction2: {},
				notAFunction3: true,
				notAFunction4: 'yo'
			});

			expect(r).toBeA('function');
			expect(r.setBar).toBeA('function');
			expect(r.setBar.type).toBeA('string');
			expect(r.notAFunction1).toNotExist();
			expect(r.notAFunction2).toNotExist();
			expect(r.notAFunction3).toNotExist();
			expect(r.notAFunction4).toNotExist();
		});

	});

	describe('handle', () => {

		it('allows handling one external action', () => {
			const b1 = new ActionizeBuild('foo');
			const b2 = new ActionizeBuild('bar');
			const r1 = b1.reducer(null, {
				a1: state => 'r1a1'
			});
			const r2 = b2.reducer(null, {
				a2: state => 'r2a2',
				[b2.handle(r1.a1)]: state => 'r2a1'
			});
			expect(r2(null, { type: r1.a1.type })).toEqual('r2a1');
			expect(r2(null, { type: r2.a2.type })).toEqual('r2a2');
		});

		it('allows handling many external actions', () => {
			const b1 = new ActionizeBuild('foo');
			const b2 = new ActionizeBuild('bar');
			const b3 = new ActionizeBuild('baz');
			const r1 = b1.reducer(null, { a1: state => 'r1a1' });
			const r2 = b2.reducer(null, { a2: state => 'r2a2' });
			const r3 = b3.reducer(null, {
				a3: state => 'r3a3',
				[b3.handle(r1.a1, r2.a2.type)]: state => 'r3handle'
			});
			expect(r3(null, { type: r1.a1.type })).toEqual('r3handle');
			expect(r3(null, { type: r2.a2.type })).toEqual('r3handle');
			expect(r3(null, { type: r3.a3.type })).toEqual('r3a3');
		});

		it('allows handling all external reducer actions', () => {
			const b1 = new ActionizeBuild('foo');
			const b2 = new ActionizeBuild('bar');
			const r1 = b1.reducer(null, {
				a1: state => 'r1a1',
				a2: state => 'r1a2'
			});
			const r2 = b2.reducer(null, {
				a2: state => 'r2a2',
				[b2.handle(r1)]: state => 'r2handle'
			});
			expect(r2(null, { type: r1.a1.type })).toEqual('r2handle');
			expect(r2(null, { type: r1.a2.type })).toEqual('r2handle');
		});

		it('ignores functions without actions', () => {
			const b = new ActionizeBuild('foo');
			const r = b.reducer(null, {
				a: state => 'a',
				[b.handle(() => null)]: state => 'x'
			});
			expect(r).toBeA('function');
			expect(r.a).toBeA('function');
			expect(r.a.type).toBeA('string');
			expect(Object.keys(r)).toEqual(['a']);
		});

		it('ignores non-functions', () => {
			const b = new ActionizeBuild('foo');
			const r = b.reducer(null, {
				a: state => 'a',
				[b.handle(123)]: state => 'x'
			});
			expect(r).toBeA('function');
			expect(r.a).toBeA('function');
			expect(r.a.type).toBeA('string');
			expect(Object.keys(r)).toEqual(['a']);
		});

	});

	describe('combine', () => {

		it('combines reducers correctly', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => 'r1a1' });
			const r2 = b.reducer(null, { a2: state => 'r2a2' });
			const c = b.combine({ r1, r2 }, (state, key) => state && state[key], (state, values) => values);
			expect(c(null, { type: r1.a1.type })).toEqual({ r1: 'r1a1', r2: null });
			expect(c(null, { type: r2.a2.type })).toEqual({ r1: null, r2: 'r2a2' });
		});

		it('does not change state if action was not called', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => 'r1a1' });
			const r2 = b.reducer(null, { a2: state => 'r2a2' });
			const c = b.combine({ r1, r2 }, (state, key) => state && state[key], () => 'not-called');
			const state = { r1: null, r2: null };
			expect(c(state, { type: '|bar:x' })).toBe(state);
		});

	});


	describe('combinePlain', () => {

		it('combines reducers correctly', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => 'r1a1' });
			const r2 = b.reducer(null, { a2: state => 'r2a2' });

			const c1 = b.combine(
				{ r1, r2 },
				(state, key) => state && state[key],
				(state, values) => values
			);
			const c2 = b.combinePlain({ r1, r2 });

			[
				{ type: r1.a1.type },
				{ type: r2.a2.type }
			].forEach((action, index) => {
				const state = { r1: null, r2: null };
				expect(c1(state, action)).toEqual(c2(state, action), 'Failed at test #' + index);
			});
		});

	});


	describe('combineImmutable', () => {

		it('combines reducers correctly', () => {
			const b = new ActionizeBuild('foo', { Immutable });
			const r1 = b.reducer(null, { a1: state => 'r1a1' });
			const r2 = b.reducer(null, { a2: state => 'r2a2' });

			let customStructureCalled = false;

			const c1 = b.combine(
				{ r1, r2 },
				(state, key) => state && state.get(key),
				(state, values) => Immutable.Map(values)
			);
			const c2 = b.combineImmutable({ r1, r2 });
			const c3 = b.combineImmutable({ r1, r2 }, values => {
				customStructureCalled = true;
				return Immutable.Map(values);
			});

			[
				{ type: r1.a1.type },
				{ type: r2.a2.type }
			].forEach((action, index) => {
				const state = Immutable.Map({ r1: null, r2: null });
				const v1 = c1(state, action).toJS();
				const v2 = c2(state, action).toJS();
				const v3 = c3(state, action).toJS();
				expect(v1).toEqual(v2, 'Failed at test #' + index);
				expect(v1).toEqual(v3, 'Failed at test #' + index);
			});

			expect(customStructureCalled).toEqual(true);
		});

		it('throws an error with no given immutable structure', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => 'r1a1' });
			const r2 = b.reducer(null, { a2: state => 'r2a2' });
			expect(() => {
				const c2 = b.combineImmutable({ r1, r2 });
			}).toThrow(/requires an immutable structure/i);
		});

	});

	describe('nest', () => {

		it('nests reducers correctly', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => ({ r1v: 'r1a1' }) });
			const r2 = b.reducer(null, { a2: state => ({ r2v: 'r2a2' }) });
			const c = b.nest(
				r1,
				{ r2 },
				(state, key) => state && state[key],
				(state, values) => Object.assign({}, state, values)
			);
			expect(c(null, { type: r1.a1.type })).toEqual({ r1v: 'r1a1', r2: null });
			expect(c(null, { type: r2.a2.type })).toEqual({ r2: { r2v: 'r2a2' } });
			expect(c({ r1v: 'r1a1' }, { type: r2.a2.type })).toEqual({ r1v: 'r1a1', r2: { r2v: 'r2a2' } });
		});

		it('does not copy non-actions from parent to new reducer', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => 'x' });
			const r2 = b.reducer(null, { a2: state => 'y' });
			r1.noCopy1 = 123;
			r1.noCopy2 = function () { };
			const c = b.nest(
				r1,
				{ r2 },
				(state, key) => state && state[key],
				(state, values) => Object.assign({}, state, values)
			);
			expect(c.noCopy1).toNotExist();
			expect(c.noCopy2).toNotExist();
			expect(c.a1).toBeA('function');
		});

	});

	describe('nestPlain', () => {

		it('nests reducers correctly', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => ({ r1v: 'r1a1' }) });
			const r2 = b.reducer(null, { a2: state => ({ r2v: 'r2a2' }) });
			const c1 = b.nest(
				r1,
				{ r2 },
				(state, key) => state && state[key],
				(state, values) => Object.assign({}, state, values)
			);
			const c2 = b.nestPlain(r1, { r2 });

			[
				{ type: r1.a1.type },
				{ type: r2.a2.type }
			].forEach((action, index) => {
				const state = { r1: null, r2: null };
				expect(c1(state, action)).toEqual(c2(state, action), 'Failed at test #' + index);
			});
		});

	});


	describe('nestImmutable', () => {

		it('nests reducers correctly', () => {
			const b = new ActionizeBuild('foo');
			const r1 = b.reducer(null, { a1: state => Immutable.Map({ r1v: 'r1a1' }) });
			const r2 = b.reducer(null, { a2: state => Immutable.Map({ r2v: 'r2a2' }) });
			const c1 = b.nest(
				r1,
				{ r2 },
				(state, key) => state && state.get(key),
				(state, values) => state.merge(values)
			);
			const c2 = b.nestImmutable(r1, { r2 });

			[
				{ type: r1.a1.type },
				{ type: r2.a2.type }
			].forEach((action, index) => {
				const state = Immutable.Map({ r1: null, r2: null });
				const v1 = c1(state, action).toJS();
				const v2 = c2(state, action).toJS();
				expect(v1).toEqual(v2, 'Failed at test #' + index);
			});
		});

	});

});
